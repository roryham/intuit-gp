/**
 * Matching Logic
 *
 * Core matching algorithm for comparing CSV deposits with QuickBooks sales receipts.
 */

/**
 * Main matching function
 * Matches deposits from Google Sheet with QuickBooks receipts (sales receipts and refund receipts)
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

    // Get both sales receipts and refund receipts in date range
    const salesReceipts = getSalesReceiptsByDateRange(dateRange.start, dateRange.end);
    logWithTimestamp(`Fetched ${salesReceipts.length} sales receipts from QuickBooks`);

    const refundReceipts = getRefundReceiptsByDateRange(dateRange.start, dateRange.end);
    logWithTimestamp(`Fetched ${refundReceipts.length} refund receipts from QuickBooks`);

    const totalReceipts = salesReceipts.length + refundReceipts.length;

    if (totalReceipts === 0) {
      showAlert('No sales receipts or refund receipts found in QuickBooks for this date range.');
      return;
    }

    // Enrich both types with customer data
    const enrichedSalesReceipts = enrichReceiptsWithCustomerData(salesReceipts, customerCache, 'SalesReceipt');
    const enrichedRefundReceipts = enrichReceiptsWithCustomerData(refundReceipts, customerCache, 'RefundReceipt');

    // Combine all receipts for matching
    const allEnrichedReceipts = [...enrichedSalesReceipts, ...enrichedRefundReceipts];
    logWithTimestamp(`Total enriched receipts: ${allEnrichedReceipts.length} (${enrichedSalesReceipts.length} sales, ${enrichedRefundReceipts.length} refunds)`);

    // Perform matching
    showToast('Matching deposits with receipts...', 'QuickBooks Matching');
    const matchResults = performMatching(csvDeposits, allEnrichedReceipts);

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

    // Parse amount (allow negative amounts for refunds)
    const amount = parseCurrency(amountStr);
    if (isNaN(amount)) {
      continue;
    }

    // Extract email
    const email = extractEmail(comment1);
    if (!email) {
      Logger.log(`Row ${i + 1}: Could not extract email from "${comment1}"`);
      continue;
    }

    Logger.log(`CSV Row ${i + 1}: Email=${email}, Amount=${amount}`);

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
 * Enrich receipts (sales receipts or refund receipts) with customer email data
 * @param {Array} receipts - Array of receipts (SalesReceipt or RefundReceipt objects)
 * @param {Object} customerCache - Map of customer ID to customer object
 * @param {string} txnType - Transaction type ('SalesReceipt' or 'RefundReceipt')
 * @returns {Array} Enriched receipts with customer data and transaction type
 */
function enrichReceiptsWithCustomerData(receipts, customerCache, txnType) {
  const enriched = [];

  receipts.forEach(receipt => {
    const customerId = receipt.CustomerRef ? receipt.CustomerRef.value : null;

    if (!customerId) {
      Logger.log(`${txnType} ${receipt.Id}: No customer reference`);
      return;
    }

    // PRIORITY 1: Check PrivateNote field first (primary source in production)
    let email = null;
    if (receipt.PrivateNote) {
      const extractedEmail = extractEmail(receipt.PrivateNote);
      if (extractedEmail) {
        email = extractedEmail;
        Logger.log(`${txnType} ${receipt.Id}: Email extracted from PrivateNote: ${email}`);
      }
    }

    // PRIORITY 2: Fallback to BillEmail field if PrivateNote doesn't have email
    if (!email && receipt.BillEmail && receipt.BillEmail.Address) {
      email = receipt.BillEmail.Address.toLowerCase();
      Logger.log(`${txnType} ${receipt.Id}: Email found in BillEmail.Address: ${email}`);
    }

    // PRIORITY 3: Final fallback to customer lookup (for sandbox or older data)
    if (!email) {
      const customer = customerCache[customerId];
      if (!customer) {
        Logger.log(`${txnType} ${receipt.Id}: Customer ${customerId} not found in cache, skipping`);
        return;
      }

      email = getCustomerEmail(customer);
      if (!email) {
        Logger.log(`${txnType} ${receipt.Id}: Customer ${customerId} has no email anywhere, skipping`);
        return;
      }
      Logger.log(`${txnType} ${receipt.Id}: Email found via customer lookup: ${email}`);
    }

    // Check deposit status
    const depositAccountRef = receipt.DepositToAccountRef || null;
    const depositAccountName = depositAccountRef ? depositAccountRef.name : 'Unknown';
    const isInUndepositedFunds = depositAccountName.toLowerCase().includes('undeposited funds');

    const enrichedReceipt = {
      id: receipt.Id,
      txnType: txnType,  // Keep original QB entity type
      txnDate: receipt.TxnDate,
      totalAmt: receipt.TotalAmt,
      customerName: receipt.CustomerRef.name,
      customerEmail: email,
      customerId: customerId,
      depositAccountRef: depositAccountRef,
      depositAccountName: depositAccountName,
      isInUndepositedFunds: isInUndepositedFunds,
      rawReceipt: receipt
    };

    Logger.log(`Enriched ${txnType}: ID=${enrichedReceipt.id}, Email=${enrichedReceipt.customerEmail}, Amount=${enrichedReceipt.totalAmt}, DepositTo=${depositAccountName}`);
    enriched.push(enrichedReceipt);
  });

  logWithTimestamp(`Enriched ${enriched.length} ${txnType}s with customer data`);
  return enriched;
}

/**
 * Perform matching between CSV deposits and QB receipts
 */
function performMatching(csvDeposits, qbReceipts) {
  const matched = [];
  const csvOnly = [];
  const qbOnly = [...qbReceipts]; // Clone array

  csvDeposits.forEach(deposit => {
    let foundMatch = false;

    // OPTIMIZATION: Only search receipts with matching transaction type based on amount sign
    // Negative CSV amount → search RefundReceipts only
    // Positive CSV amount → search SalesReceipts only
    const expectedTxnType = deposit.amount < 0 ? 'RefundReceipt' : 'SalesReceipt';

    Logger.log(`\n--- Matching CSV Row ${deposit.rowIndex + 1}: Email=${deposit.email}, Amount=${deposit.amount} ---`);
    Logger.log(`  Expected transaction type: ${expectedTxnType} (based on amount sign)`);

    for (let i = 0; i < qbOnly.length; i++) {
      const receipt = qbOnly[i];

      // OPTIMIZATION: Skip receipts that don't match the expected type
      if (receipt.txnType !== expectedTxnType) {
        continue;  // Skip this receipt without logging
      }

      // Check if email and amount match
      const emailMatch = deposit.email === receipt.customerEmail;
      const amountMatch = amountsMatch(deposit.amount, receipt.totalAmt);

      Logger.log(`  Comparing with QB ${receipt.txnType} ${receipt.id}: Email=${receipt.customerEmail}, Amount=${receipt.totalAmt}`);
      Logger.log(`    Email Match: ${emailMatch} (CSV: "${deposit.email}" vs QB: "${receipt.customerEmail}")`);
      Logger.log(`    Amount Match: ${amountMatch} (CSV: ${deposit.amount} vs QB: ${receipt.totalAmt})`);

      if (emailMatch && amountMatch) {
        Logger.log(`  ✓ MATCH FOUND!`);

        matched.push({
          csvData: deposit,
          qbData: receipt,
          status: '✓ Matched',
          isInvalid: false  // Can't be invalid since we only matched correct types
        });

        // Remove from qbOnly array
        qbOnly.splice(i, 1);

        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      Logger.log(`  ✗ No match found for this CSV row`);
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
 * Validate that receipts can be deposited (not already deposited)
 * @param {Array} matchedDeposits - Array of matched deposits to validate
 * @returns {Object} Validation result with depositable and alreadyDeposited arrays
 */
function validateReceiptsForDeposit(matchedDeposits) {
  const depositable = [];
  const alreadyDeposited = [];
  const invalidAmount = [];
  const unknown = [];

  matchedDeposits.forEach(deposit => {
    const qbData = deposit.qbData;

    // VALIDATION 1: Check for invalid amount/type combinations
    // Based on CSV Amount vs QB Transaction Type
    // SalesReceipts should have positive CSV amounts, RefundReceipts should have negative CSV amounts
    const csvAmount = deposit.csvAmount || qbData.TotalAmt;  // Fall back to QB amount if CSV amount not available
    const txnType = qbData.txnType;

    if ((txnType === 'SalesReceipt' && csvAmount < 0) ||
        (txnType === 'RefundReceipt' && csvAmount > 0)) {
      const reason = txnType === 'SalesReceipt'
        ? `SalesReceipt cannot have negative amount: $${csvAmount}`
        : `RefundReceipt cannot have positive amount: $${csvAmount}`;
      invalidAmount.push({
        ...deposit,
        invalidReason: reason
      });
      Logger.log(`${txnType} ${qbData.Id}: INVALID - ${reason}`);
      return;  // Skip this receipt
    }

    // VALIDATION 2: Check if receipt is in Undeposited Funds
    const rawReceipt = qbData.rawReceipt || qbData;
    const depositAccountRef = rawReceipt.DepositToAccountRef || rawReceipt.depositAccountRef;
    const depositAccountName = depositAccountRef ? depositAccountRef.name : '';

    if (!depositAccountName) {
      // No deposit account info - can't determine status
      Logger.log(`Warning: ${qbData.txnType} ${qbData.Id} has no DepositToAccountRef - assuming depositable`);
      unknown.push(deposit);
      depositable.push(deposit);  // Include in depositable for now
      return;
    }

    const isInUndepositedFunds = depositAccountName.toLowerCase().includes('undeposited funds');

    if (isInUndepositedFunds) {
      depositable.push(deposit);
      Logger.log(`${qbData.txnType} ${qbData.Id}: In Undeposited Funds - DEPOSITABLE`);
    } else {
      alreadyDeposited.push({
        ...deposit,
        currentDepositAccount: depositAccountName
      });
      Logger.log(`${qbData.txnType} ${qbData.Id}: Already in ${depositAccountName} - ALREADY DEPOSITED`);
    }
  });

  logWithTimestamp(`Validation: ${depositable.length} depositable, ${alreadyDeposited.length} already deposited, ${invalidAmount.length} invalid amounts, ${unknown.length} unknown`);

  return {
    depositable: depositable,
    alreadyDeposited: alreadyDeposited,
    invalidAmount: invalidAmount,
    unknown: unknown,
    canProceed: alreadyDeposited.length === 0 && invalidAmount.length === 0
  };
}

/**
 * Get matched deposits ready for deposit creation
 */
function getMatchedDeposits() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();

  const matchedDeposits = [];

  // Find the required columns
  const headers = data[0];
  let qbIdColIndex = -1;
  let qbTypeColIndex = -1;
  let statusColIndex = -1;

  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === 'QB Transaction ID') {
      qbIdColIndex = i;
    }
    if (headers[i] === 'QB Transaction Type') {
      qbTypeColIndex = i;
    }
    if (headers[i] === 'Match Status') {
      statusColIndex = i;
    }
  }

  // Support legacy column name for backward compatibility
  if (qbIdColIndex === -1) {
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] === 'QB Sales Receipt ID') {
        qbIdColIndex = i;
      }
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
    const qbType = qbTypeColIndex !== -1 ? row[qbTypeColIndex] : 'SalesReceipt';  // Default to SalesReceipt for backward compatibility

    if (status === '✓ Matched' && qbId) {
      const amount = parseCurrency(row[CONFIG.COLUMNS.AMOUNT]);
      const email = extractEmail(row[CONFIG.COLUMNS.COMMENT1]);

      // Re-query the receipt to get current deposit status
      try {
        let rawReceipt = null;
        if (qbType === 'RefundReceipt') {
          const query = `SELECT * FROM RefundReceipt WHERE Id = '${qbId}'`;
          const receipts = queryRefundReceipts(query);
          rawReceipt = receipts.length > 0 ? receipts[0] : null;
        } else {
          // Default to SalesReceipt
          const query = `SELECT * FROM SalesReceipt WHERE Id = '${qbId}'`;
          const receipts = querySalesReceipts(query);
          rawReceipt = receipts.length > 0 ? receipts[0] : null;
        }

        if (rawReceipt) {
          matchedDeposits.push({
            rowIndex: i,
            csvAmount: amount,  // Include CSV amount for validation
            qbData: {
              Id: qbId,
              txnType: qbType,
              TotalAmt: amount,
              rawReceipt: rawReceipt,  // Include full receipt data for validation
              DepositToAccountRef: rawReceipt.DepositToAccountRef,
              depositAccountRef: rawReceipt.DepositToAccountRef
            }
          });
        } else {
          Logger.log(`Warning: Could not re-query ${qbType} ${qbId}`);
          // Add without rawReceipt - validation will handle it
          matchedDeposits.push({
            rowIndex: i,
            csvAmount: amount,  // Include CSV amount for validation
            qbData: {
              Id: qbId,
              txnType: qbType,
              TotalAmt: amount
            }
          });
        }
      } catch (error) {
        Logger.log(`Error re-querying ${qbType} ${qbId}: ${error.toString()}`);
        // Add without rawReceipt
        matchedDeposits.push({
          rowIndex: i,
          csvAmount: amount,  // Include CSV amount for validation
          qbData: {
            Id: qbId,
            txnType: qbType,
            TotalAmt: amount
          }
        });
      }
    }
  }

  return matchedDeposits;
}
