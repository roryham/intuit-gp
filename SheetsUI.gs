/**
 * Google Sheets UI Functions
 *
 * Functions for formatting sheets, adding columns, and color coding.
 */

/**
 * Update sheet with match results
 */
function updateSheetWithMatchResults(sheet, matchResults) {
  // Add new columns if they don't exist
  ensureMatchingColumnsExist(sheet);

  // Get header row to find column indices
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const colIndices = {
    qbId: headers.indexOf('QB Transaction ID'),
    qbType: headers.indexOf('QB Transaction Type'),
    qbDate: headers.indexOf('QB Transaction Date'),
    qbAmount: headers.indexOf('QB Total Amount'),
    qbEmail: headers.indexOf('QB Customer Email'),
    qbName: headers.indexOf('QB Customer Name'),
    status: headers.indexOf('Match Status')
  };

  // Support legacy column name for backward compatibility
  if (colIndices.qbId === -1) {
    colIndices.qbId = headers.indexOf('QB Sales Receipt ID');
  }

  // Update matched rows
  matchResults.matched.forEach(match => {
    updateRowWithMatchData(sheet, match, colIndices, 'matched');
  });

  // Update CSV-only rows
  matchResults.csvOnly.forEach(match => {
    updateRowWithMatchData(sheet, match, colIndices, 'csv_only');
  });

  // Optionally add QB-only rows at the bottom (commented out for now)
  // addQBOnlyRows(sheet, matchResults.qbOnly, colIndices);

  logWithTimestamp('Sheet updated with match results');
}

/**
 * Ensure matching columns exist in the sheet
 */
function ensureMatchingColumnsExist(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Check if columns already exist
  const existingColumns = new Set(headers);
  const columnsToAdd = CONFIG.NEW_COLUMNS.filter(col => !existingColumns.has(col));

  if (columnsToAdd.length === 0) {
    return; // Columns already exist
  }

  // Add new columns
  const lastCol = sheet.getLastColumn();
  const newColStart = lastCol + 1;

  columnsToAdd.forEach((columnName, index) => {
    const colNum = newColStart + index;
    sheet.getRange(1, colNum).setValue(columnName);
  });

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground(CONFIG.COLORS.HEADER);
  headerRange.setFontWeight('bold');
  headerRange.setFontColor('#FFFFFF');

  logWithTimestamp(`Added ${columnsToAdd.length} new columns to sheet`);
}

/**
 * Update a single row with match data
 */
function updateRowWithMatchData(sheet, match, colIndices, matchType) {
  const rowNum = match.csvData.rowIndex + 1; // +1 for 1-based indexing

  if (matchType === 'matched') {
    // Update QB data columns
    sheet.getRange(rowNum, colIndices.qbId + 1).setValue(match.qbData.id);

    // Add transaction type if column exists
    if (colIndices.qbType !== -1) {
      sheet.getRange(rowNum, colIndices.qbType + 1).setValue(match.qbData.txnType);
    }

    sheet.getRange(rowNum, colIndices.qbDate + 1).setValue(match.qbData.txnDate);
    sheet.getRange(rowNum, colIndices.qbAmount + 1).setValue(formatCurrency(match.qbData.totalAmt));
    sheet.getRange(rowNum, colIndices.qbEmail + 1).setValue(match.qbData.customerEmail);
    sheet.getRange(rowNum, colIndices.qbName + 1).setValue(match.qbData.customerName);
    sheet.getRange(rowNum, colIndices.status + 1).setValue(match.status);

    // Color code row GREEN (all matches are valid due to optimized matching)
    const rowRange = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn());
    rowRange.setBackground(CONFIG.COLORS.MATCHED);

  } else if (matchType === 'csv_only') {
    // Update status only
    sheet.getRange(rowNum, colIndices.status + 1).setValue(match.status);

    // Color code row YELLOW
    const rowRange = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn());
    rowRange.setBackground(CONFIG.COLORS.CSV_ONLY);
  }
}

/**
 * Add QB-only rows at the bottom of the sheet
 * (Optional - currently not used)
 */
function addQBOnlyRows(sheet, qbOnlyMatches, colIndices) {
  if (qbOnlyMatches.length === 0) return;

  const lastRow = sheet.getLastRow();

  qbOnlyMatches.forEach((match, index) => {
    const rowNum = lastRow + index + 1;
    const qbData = match.qbData;

    // Add QB data
    sheet.getRange(rowNum, colIndices.qbId + 1).setValue(qbData.id);

    // Add transaction type if column exists
    if (colIndices.qbType !== -1) {
      sheet.getRange(rowNum, colIndices.qbType + 1).setValue(qbData.txnType);
    }

    sheet.getRange(rowNum, colIndices.qbDate + 1).setValue(qbData.txnDate);
    sheet.getRange(rowNum, colIndices.qbAmount + 1).setValue(formatCurrency(qbData.totalAmt));
    sheet.getRange(rowNum, colIndices.qbEmail + 1).setValue(qbData.customerEmail);
    sheet.getRange(rowNum, colIndices.qbName + 1).setValue(qbData.customerName);
    sheet.getRange(rowNum, colIndices.status + 1).setValue(match.status);

    // Color code row RED
    const rowRange = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn());
    rowRange.setBackground(CONFIG.COLORS.QB_ONLY);
  });

  logWithTimestamp(`Added ${qbOnlyMatches.length} QB-only rows`);
}

/**
 * Clear all match data and formatting from sheet
 */
function clearMatchData() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const confirmed = showConfirmation(
    'This will clear all matching data and formatting. Continue?',
    'Clear Match Data'
  );

  if (!confirmed) return;

  try {
    // Clear background colors
    const dataRange = sheet.getDataRange();
    dataRange.setBackground(null);

    // Reformat header
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    headerRange.setBackground(CONFIG.COLORS.HEADER);

    // Clear QB columns if they exist
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    CONFIG.NEW_COLUMNS.forEach(colName => {
      const colIndex = headers.indexOf(colName);
      if (colIndex !== -1) {
        const colRange = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1);
        colRange.clearContent();
      }
    });

    showToast('Match data cleared', 'QuickBooks');
    logWithTimestamp('Match data cleared from sheet');

  } catch (error) {
    showAlert(`Error clearing data: ${error.message}`);
  }
}

/**
 * Show deposit creation dialog
 */
function showDepositCreationDialog() {
  try {
    const ui = SpreadsheetApp.getUi();
    const matchedDeposits = getMatchedDeposits();

    if (matchedDeposits.length === 0) {
      showAlert('No matched deposits found. Please run "Match Deposits" first.');
      return;
    }

    // Check if deposit account is configured
    const accountName = getDepositAccountName();
    if (accountName === 'Not set') {
      showAlert(
        'No deposit account selected.\n\n' +
        'Please run "QuickBooks → Setup → 4. Select Deposit Account" first.',
        'Account Not Configured'
      );
      return;
    }

    // VALIDATE: Check if any receipts have already been deposited
    const validation = validateReceiptsForDeposit(matchedDeposits);

    if (!validation.canProceed) {
      // Some receipts have issues - build alert message
      let alertMessage = `⚠ WARNING: Some receipts cannot be deposited!\n\n`;

      // Show invalid amount receipts
      if (validation.invalidAmount.length > 0) {
        alertMessage += `Invalid Amount/Type (${validation.invalidAmount.length}):\n`;
        validation.invalidAmount.forEach((deposit, index) => {
          if (index < 5) {  // Show first 5
            const qbData = deposit.qbData;
            alertMessage += `  • ${qbData.txnType} ${qbData.Id}: $${qbData.TotalAmt} - ${deposit.invalidReason}\n`;
          }
        });
        if (validation.invalidAmount.length > 5) {
          alertMessage += `  ... and ${validation.invalidAmount.length - 5} more\n`;
        }
        alertMessage += `\n`;
      }

      // Show already deposited receipts
      if (validation.alreadyDeposited.length > 0) {
        alertMessage += `Already Deposited (${validation.alreadyDeposited.length}):\n`;
        validation.alreadyDeposited.forEach((deposit, index) => {
          if (index < 5) {  // Show first 5
            const qbData = deposit.qbData;
            alertMessage += `  • ${qbData.txnType} ${qbData.Id}: $${qbData.TotalAmt} → ${deposit.currentDepositAccount}\n`;
          }
        });
        if (validation.alreadyDeposited.length > 5) {
          alertMessage += `  ... and ${validation.alreadyDeposited.length - 5} more\n`;
        }
        alertMessage += `\n`;
      }

      alertMessage += `Depositable (${validation.depositable.length}): Valid and ready to deposit\n\n`;

      if (validation.invalidAmount.length > 0) {
        alertMessage += `Note: Invalid combinations detected (mismatched amount sign vs transaction type).\n`;
        alertMessage += `This may indicate manual edits to the sheet after matching.\n\n`;
      }

      if (validation.alreadyDeposited.length > 0) {
        alertMessage += `Already deposited receipts have been applied to deposits in QuickBooks.\n\n`;
      }

      alertMessage += `Would you like to proceed with the ${validation.depositable.length} depositable receipt(s)?`;

      const proceed = showConfirmation(alertMessage, 'Deposit Validation');

      if (!proceed) {
        return;  // User cancelled
      }

      // Continue with only depositable receipts
      if (validation.depositable.length === 0) {
        showAlert('No depositable receipts remaining.', 'Cannot Create Deposit');
        return;
      }

      // Update matchedDeposits to only include depositable ones
      matchedDeposits.length = 0;  // Clear array
      matchedDeposits.push(...validation.depositable);  // Add depositable ones
    }

    const totalAmount = matchedDeposits.reduce((sum, deposit) => {
      return sum + deposit.qbData.TotalAmt;
    }, 0);

    // Count transaction types
    const salesReceiptCount = matchedDeposits.filter(d => d.qbData.txnType === 'SalesReceipt').length;
    const refundReceiptCount = matchedDeposits.filter(d => d.qbData.txnType === 'RefundReceipt').length;

    // Step 1: Confirm deposit creation
    let message = `Create QuickBooks Deposit?\n\n` +
      `Matched Receipts: ${matchedDeposits.length}`;

    if (refundReceiptCount > 0) {
      message += ` (${salesReceiptCount} sales, ${refundReceiptCount} refunds)`;
    }

    message += `\n` +
      `Total Amount: ${formatCurrency(totalAmount)}\n` +
      `Deposit To: ${accountName}\n\n` +
      `This will create a deposit in QuickBooks linking these receipts.\n\n` +
      `Continue?`;

    const confirmed = showConfirmation(message, 'Create Deposit');

    if (!confirmed) return;

    // Step 2: Get deposit date
    const defaultDate = new Date();
    const dateStr = `${defaultDate.getMonth() + 1}/${defaultDate.getDate()}/${defaultDate.getFullYear()}`;

    const dateResponse = ui.prompt(
      'Deposit Date',
      `Enter the deposit date (MM/DD/YYYY):\n\nDefault: ${dateStr}`,
      ui.ButtonSet.OK_CANCEL
    );

    if (dateResponse.getSelectedButton() !== ui.Button.OK) return;

    let depositDate = defaultDate;
    const dateInput = dateResponse.getResponseText().trim();

    if (dateInput) {
      try {
        depositDate = new Date(dateInput);
        if (isNaN(depositDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (e) {
        showAlert(`Invalid date format. Using today's date instead.`);
        depositDate = defaultDate;
      }
    }

    // Step 3: Get deposit memo/reference
    const memoResponse = ui.prompt(
      'Deposit Memo',
      `Enter a memo/reference for this deposit (optional):\n\nExample: "Batch 2026-02-03" or "Weekly Deposit"`,
      ui.ButtonSet.OK_CANCEL
    );

    if (memoResponse.getSelectedButton() !== ui.Button.OK) return;

    const depositMemo = memoResponse.getResponseText().trim();

    // Create the deposit
    createQuickBooksDeposit(matchedDeposits, depositDate, depositMemo);

  } catch (error) {
    showAlert(`Error: ${error.message}`);
  }
}

/**
 * Create QuickBooks deposit from matched receipts
 */
function createQuickBooksDeposit(matchedDeposits, depositDate, depositMemo) {
  try {
    showToast('Creating deposit in QuickBooks...', 'QuickBooks');

    // Get deposit account reference
    const depositAccountRef = getDepositAccountRef();

    // Build deposit object
    const depositObject = buildDepositObject(matchedDeposits, depositAccountRef, depositDate, depositMemo);

    // Create deposit via API
    const createdDeposit = createDeposit(depositObject);

    let message = `Deposit Created Successfully!\n\n` +
      `Deposit ID: ${createdDeposit.Id}\n` +
      `Total Amount: ${formatCurrency(createdDeposit.TotalAmt)}\n` +
      `Transaction Date: ${createdDeposit.TxnDate}\n` +
      `Receipts Linked: ${matchedDeposits.length}`;

    if (depositMemo) {
      message += `\nMemo: ${depositMemo}`;
    }

    showAlert(message, 'Deposit Created');

    logWithTimestamp(`Deposit created successfully: ID ${createdDeposit.Id}`);

  } catch (error) {
    Logger.log('Error creating deposit: ' + error.toString());
    showAlert(`Failed to create deposit:\n\n${error.message}`, 'Error');
  }
}

/**
 * Format sheet for better readability
 */
function formatSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();

  try {
    // Freeze header row
    sheet.setFrozenRows(1);

    // Auto-resize columns
    const lastCol = sheet.getLastColumn();
    for (let i = 1; i <= lastCol; i++) {
      sheet.autoResizeColumn(i);
    }

    // Format header
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    headerRange.setBackground(CONFIG.COLORS.HEADER);
    headerRange.setFontWeight('bold');
    headerRange.setFontColor('#FFFFFF');

    showToast('Sheet formatted', 'QuickBooks');

  } catch (error) {
    showAlert(`Error formatting sheet: ${error.message}`);
  }
}
