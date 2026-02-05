/**
 * Test: Create a deposit WITH LinkedTxn (linking to sales receipt)
 */
function testLinkedDeposit() {
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

    // Get first matched receipt ID and amount
    let receiptId = null;
    let amount = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][qbIdColIndex]) {
        receiptId = String(data[i][qbIdColIndex]);
        amount = parseCurrency(data[i][CONFIG.COLUMNS.AMOUNT]);
        break;
      }
    }

    if (!receiptId) {
      showAlert('No matched sales receipts found.');
      return;
    }

    const depositAccountId = getDepositAccountRef();
    const bankAccounts = getBankAccounts();
    const depositAccount = bankAccounts.find(acc => acc.Id === depositAccountId);

    if (!depositAccount) {
      throw new Error('Selected deposit account not found.');
    }

    // Linked deposit with TxnLineId
    const depositData = {
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: receiptId,
              TxnType: 'SalesReceipt',
              TxnLineId: '0'  // Line ID within the sales receipt (usually 0)
            }
          ]
        }
      ],
      DepositToAccountRef: {
        name: depositAccount.Name,
        value: String(depositAccount.Id)
      }
    };

    Logger.log('Testing LINKED deposit (no AccountRef): ' + JSON.stringify(depositData, null, 2));

    const endpoint = 'deposit';
    const response = makeQBApiRequest(endpoint, 'POST', depositData);

    showAlert(
      `✓ LINKED Deposit test successful!\n\n` +
      `Deposit ID: ${response.Deposit.Id}\n` +
      `Amount: ${formatCurrency(amount)}\n` +
      `Linked Receipt: ${receiptId}\n` +
      `To: ${depositAccount.Name}\n\n` +
      `SUCCESS! Sales Receipts CAN be linked!`,
      'Test Successful'
    );

  } catch (error) {
    showAlert(`Linked deposit test failed:\n\n${error.message}\n\nTrying alternative approach...`);
    Logger.log('Linked deposit error: ' + error.toString());

    // If this fails, we know linking sales receipts doesn't work
  }
}
