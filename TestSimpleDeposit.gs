/**
 * Test: Create a simple deposit - try with Unapplied Cash Payment Income
 */
function testSimpleDepositWithoutLink() {
  try {
    const depositAccountId = getDepositAccountRef();

    // Get the actual bank account details
    const bankAccounts = getBankAccounts();
    const depositAccount = bankAccounts.find(acc => acc.Id === depositAccountId);

    if (!depositAccount) {
      throw new Error('Selected deposit account not found. Please re-select it.');
    }

    // Get ALL accounts to find Unapplied Cash Payment Income
    const query = "SELECT * FROM Account WHERE Name = 'Unapplied Cash Payment Income'";
    const endpoint1 = `query?query=${encodeURIComponent(query)}`;
    const response1 = makeQBApiRequest(endpoint1, 'GET');

    let sourceAccount;
    if (response1.QueryResponse && response1.QueryResponse.Account && response1.QueryResponse.Account.length > 0) {
      sourceAccount = response1.QueryResponse.Account[0];
    } else {
      throw new Error('Unapplied Cash Payment Income account not found');
    }

    // Try exactly like the API example - using Unapplied Cash Payment Income
    const depositData = {
      Line: [
        {
          DetailType: 'DepositLineDetail',
          Amount: 20.0,
          DepositLineDetail: {
            AccountRef: {
              name: sourceAccount.Name,
              value: String(sourceAccount.Id)
            }
          }
        }
      ],
      DepositToAccountRef: {
        name: depositAccount.Name,
        value: String(depositAccount.Id)
      }
    };

    Logger.log('Testing deposit with Unapplied Cash Payment Income: ' + JSON.stringify(depositData, null, 2));

    const endpoint = 'deposit';
    const response = makeQBApiRequest(endpoint, 'POST', depositData);

    showAlert(
      `✓ Deposit test successful!\n\n` +
      `Deposit ID: ${response.Deposit.Id}\n` +
      `Amount: $20.00\n` +
      `From: ${sourceAccount.Name}\n` +
      `To: ${depositAccount.Name}\n\n` +
      `The structure works with the Income account!`,
      'Test Successful'
    );

  } catch (error) {
    showAlert(`Test failed: ${error.message}`);
    Logger.log('Test error: ' + error.toString());
  }
}
