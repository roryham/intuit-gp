/**
 * Matching Logic
 *
 * Core matching algorithm for comparing CSV deposits with QuickBooks sales receipts.
 */

/**
 * Main matching function
 * Matches deposits from Google Sheet with QuickBooks sales receipts
 */
function matchDepositsWithSalesReceipts() {
  try {
    showToast('Starting matching process...', 'QuickBooks Matching');

    // Get active sheet
    const sheet = SpreadsheetApp.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      showAlert('No data found in sheet. Please ensure your CSV data is loaded.');
      return;
    }

    // Parse CSV data
    const csvDeposits = parseCSVDeposits(data);
    logWithTimestamp(`Parsed ${csvDeposits.length} deposits from CSV`);

    if (csvDeposits.length === 0) {
      showAlert('No valid deposits found in sheet.');
      return;
    }

    // Determine date range from CSV
    const dateRange = getDateRangeFromDeposits(csvDeposits);
    logWithTimestamp(`Date range: ${dateRange.start.toDateString()} to ${dateRange.end.toDateString()}`);

    // Fetch QuickBooks data
    showToast('Fetching QuickBooks data...', 'QuickBooks Matching');

    // Cache all customers first (optimization)
    const customerCache = getAllCustomers();

    // Get sales receipts in date range
    const salesReceipts = getSalesReceiptsByDateRange(dateRange.start, dateRange.end);
    logWithTimestamp(`Fetched ${salesReceipts.length} sales receipts from QuickBooks`);

    if (salesReceipts.length === 0) {
      showAlert('No sales receipts found in QuickBooks for this date range.');
      return;
    }

    // Enrich sales receipts with customer data
    const enrichedReceipts = enrichSalesReceiptsWithCustomerData(salesReceipts, customerCache);

    // Perform matching
    showToast('Matching deposits with sales receipts...', 'QuickBooks Matching');
    const matchResults = performMatching(csvDeposits, enrichedReceipts);

    // Update sheet with results
    showToast('Updating spreadsheet...', 'QuickBooks Matching');
    updateSheetWithMatchResults(sheet, matchResults);

    // Show summary
    const summary = generateMatchSummary(matchResults);
    showAlert(summary, 'Matching Complete');

    logWithTimestamp('Matching process completed successfully');

  } catch (error) {
    Logger.log('Error in matching process: ' + error.toString());
    showAlert(`Error during matching: ${error.message}`);
  }
}

/**
 * Parse CSV deposits from sheet data
 */
function parseCSVDeposits(data) {
  const deposits = [];
  const headers = data[0];

  // Find column indices
  const amountColIndex = CONFIG.COLUMNS.AMOUNT;
  const comment1ColIndex = CONFIG.COLUMNS.COMMENT1;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows
    if (!row[amountColIndex] || !row[comment1ColIndex]) {
      continue;
    }

    const amountStr = row[amountColIndex];
    const comment1 = row[comment1ColIndex];

    // Parse amount
    const amount = parseCurrency(amountStr);
    if (isNaN(amount) || amount <= 0) {
      continue;
    }

    // Extract email
    const email = extractEmail(comment1);
    if (!email) {
      Logger.log(`Row ${i + 1}: Could not extract email from "${comment1}"`);
      continue;
    }

    deposits.push({
      rowIndex: i,
      amount: amount,
      email: email,
      comment1: comment1,
      rawData: row
    });
  }

  return deposits;
}

/**
 * Get date range from CSV deposits
 * Expands by 7 days on each side to catch near matches
 */
function getDateRangeFromDeposits(deposits) {
  const now = new Date();

  // Default: last 30 days
  let startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  let endDate = new Date();

  // Try to extract dates from first column if they exist
  // For now, use a safe default range
  // Expand by 7 days on each side
  startDate.setDate(startDate.getDate() - 7);
  endDate.setDate(endDate.getDate() + 7);

  return {
    start: startDate,
    end: endDate
  };
}

/**
 * Enrich sales receipts with customer email data
 */
function enrichSalesReceiptsWithCustomerData(salesReceipts, customerCache) {
  const enriched = [];

  salesReceipts.forEach(receipt => {
    const customerId = receipt.CustomerRef ? receipt.CustomerRef.value : null;

    if (!customerId) {
      Logger.log(`Sales Receipt ${receipt.Id}: No customer reference`);
      return;
    }

    const customer = customerCache[customerId];
    if (!customer) {
      Logger.log(`Sales Receipt ${receipt.Id}: Customer ${customerId} not found in cache`);
      return;
    }

    const email = getCustomerEmail(customer);
    if (!email) {
      Logger.log(`Sales Receipt ${receipt.Id}: Customer ${customerId} has no email`);
      return;
    }

    enriched.push({
      id: receipt.Id,
      txnDate: receipt.TxnDate,
      totalAmt: receipt.TotalAmt,
      customerName: receipt.CustomerRef.name,
      customerEmail: email,
      customerId: customerId,
      rawReceipt: receipt
    });
  });

  logWithTimestamp(`Enriched ${enriched.length} sales receipts with customer data`);
  return enriched;
}

/**
 * Perform matching between CSV deposits and QB sales receipts
 */
function performMatching(csvDeposits, qbReceipts) {
  const matched = [];
  const csvOnly = [];
  const qbOnly = [...qbReceipts]; // Clone array

  csvDeposits.forEach(deposit => {
    let foundMatch = false;

    for (let i = 0; i < qbOnly.length; i++) {
      const receipt = qbOnly[i];

      // Check if email and amount match
      const emailMatch = deposit.email === receipt.customerEmail;
      const amountMatch = amountsMatch(deposit.amount, receipt.totalAmt);

      if (emailMatch && amountMatch) {
        matched.push({
          csvData: deposit,
          qbData: receipt,
          status: '✓ Matched'
        });

        // Remove from qbOnly array
        qbOnly.splice(i, 1);

        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      csvOnly.push({
        csvData: deposit,
        qbData: null,
        status: '⚠ In CSV only'
      });
    }
  });

  // Remaining items in qbOnly are unmatched QB receipts
  const qbOnlyResults = qbOnly.map(receipt => ({
    csvData: null,
    qbData: receipt,
    status: '⚠ In QB only'
  }));

  return {
    matched: matched,
    csvOnly: csvOnly,
    qbOnly: qbOnlyResults,
    all: [...matched, ...csvOnly, ...qbOnlyResults]
  };
}

/**
 * Generate match summary text
 */
function generateMatchSummary(matchResults) {
  const totalCSV = matchResults.matched.length + matchResults.csvOnly.length;
  const totalQB = matchResults.matched.length + matchResults.qbOnly.length;
  const matchedCount = matchResults.matched.length;
  const matchPercentage = totalCSV > 0 ? ((matchedCount / totalCSV) * 100).toFixed(1) : 0;

  const totalAmount = matchResults.matched.reduce((sum, match) => {
    return sum + match.csvData.amount;
  }, 0);

  return `Matching Complete!\n\n` +
    `✓ Matched: ${matchedCount} (${matchPercentage}%)\n` +
    `⚠ CSV Only: ${matchResults.csvOnly.length}\n` +
    `⚠ QB Only: ${matchResults.qbOnly.length}\n\n` +
    `Total Matched Amount: ${formatCurrency(totalAmount)}\n\n` +
    `Green rows are matched and ready for deposit creation.`;
}

/**
 * Get matched deposits ready for deposit creation
 */
function getMatchedDeposits() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();

  const matchedDeposits = [];

  // Find the QB Sales Receipt ID column
  const headers = data[0];
  let qbIdColIndex = -1;
  let statusColIndex = -1;

  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === 'QB Sales Receipt ID') {
      qbIdColIndex = i;
    }
    if (headers[i] === 'Match Status') {
      statusColIndex = i;
    }
  }

  if (qbIdColIndex === -1 || statusColIndex === -1) {
    throw new Error('Matching has not been run yet. Please run "Match Deposits" first.');
  }

  // Iterate through rows and find matched ones
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusColIndex];
    const qbId = row[qbIdColIndex];

    if (status === '✓ Matched' && qbId) {
      const amount = parseCurrency(row[CONFIG.COLUMNS.AMOUNT]);
      const email = extractEmail(row[CONFIG.COLUMNS.COMMENT1]);

      matchedDeposits.push({
        rowIndex: i,
        qbData: {
          Id: qbId,
          TotalAmt: amount
        }
      });
    }
  }

  return matchedDeposits;
}
