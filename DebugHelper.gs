/**
 * Debug: Check a sales receipt structure
 */
function debugSalesReceipt() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find QB Sales Receipt ID column
    let qbIdColIndex = -1;
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] === 'QB Sales Receipt ID') {
        qbIdColIndex = i;
        break;
      }
    }

    if (qbIdColIndex === -1) {
      showAlert('No QB Sales Receipt ID column found. Run matching first.');
      return;
    }

    // Get first matched receipt ID
    let receiptId = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][qbIdColIndex]) {
        receiptId = data[i][qbIdColIndex];
        break;
      }
    }

    if (!receiptId) {
      showAlert('No sales receipt IDs found.');
      return;
    }

    showToast('Fetching sales receipt ' + receiptId + '...', 'Debug');

    // Fetch the full sales receipt
    const receipt = readSalesReceipt(receiptId);

    // Log the full structure
    Logger.log('Full Sales Receipt Structure:');
    Logger.log(JSON.stringify(receipt, null, 2));

    // Check deposit account
    let message = 'Sales Receipt Debug Info\n\n';
    message += `Receipt ID: ${receipt.Id}\n`;
    message += `Total Amount: ${receipt.TotalAmt}\n`;
    message += `Transaction Date: ${receipt.TxnDate}\n\n`;

    if (receipt.DepositToAccountRef) {
      message += `Deposited To Account:\n`;
      message += `  Name: ${receipt.DepositToAccountRef.name}\n`;
      message += `  ID: ${receipt.DepositToAccountRef.value}\n\n`;
      message += `⚠️ This sales receipt is already deposited!\n\n`;
      message += `QuickBooks sales receipts are deposited when created.\n`;
      message += `You cannot deposit them again into a bank deposit.`;
    } else {
      message += `✓ This receipt is in Undeposited Funds\n`;
      message += `It can be included in a deposit.`;
    }

    showAlert(message, 'Sales Receipt Info');

  } catch (error) {
    showAlert('Error: ' + error.message);
    Logger.log('Error in debugSalesReceipt: ' + error.toString());
  }
}
