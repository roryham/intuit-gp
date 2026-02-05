/**
 * Debug: List all accounts to verify IDs
 */
function debugListAllAccounts() {
  try {
    showToast('Fetching all accounts...', 'Debug');

    // Get ALL accounts
    const query = "SELECT * FROM Account MAXRESULTS 1000";
    const endpoint = `query?query=${encodeURIComponent(query)}`;
    const response = makeQBApiRequest(endpoint, 'GET');

    if (!response.QueryResponse || !response.QueryResponse.Account) {
      showAlert('No accounts found!');
      return;
    }

    const accounts = response.QueryResponse.Account;

    // Log all accounts
    Logger.log('ALL ACCOUNTS:');
    accounts.forEach(acc => {
      Logger.log(`ID: ${acc.Id} | Name: ${acc.Name} | Type: ${acc.AccountType} | SubType: ${acc.AccountSubType || 'N/A'} | Active: ${acc.Active}`);
    });

    // Find bank accounts
    const bankAccounts = accounts.filter(acc => acc.AccountType === 'Bank' && acc.Active);
    const undepositedFunds = accounts.filter(acc => acc.Name === 'Undeposited Funds' || (acc.AccountSubType && acc.AccountSubType.includes('Undeposited')));

    let message = `All Accounts Debug\n\n`;
    message += `Total accounts: ${accounts.length}\n\n`;

    message += `BANK ACCOUNTS (for deposits):\n`;
    if (bankAccounts.length === 0) {
      message += `  ⚠️ NO BANK ACCOUNTS FOUND!\n`;
      message += `  You need to create a bank account in QuickBooks.\n\n`;
    } else {
      bankAccounts.forEach(acc => {
        message += `  • ${acc.Name} (ID: ${acc.Id})\n`;
        message += `    Type: ${acc.AccountType}\n`;
        if (acc.AccountSubType) {
          message += `    SubType: ${acc.AccountSubType}\n`;
        }
        message += `\n`;
      });
    }

    message += `UNDEPOSITED FUNDS:\n`;
    if (undepositedFunds.length === 0) {
      message += `  ⚠️ NOT FOUND!\n\n`;
    } else {
      undepositedFunds.forEach(acc => {
        message += `  • ${acc.Name} (ID: ${acc.Id})\n`;
        message += `    Type: ${acc.AccountType}\n`;
        if (acc.AccountSubType) {
          message += `    SubType: ${acc.AccountSubType}\n`;
        }
        message += `\n`;
      });
    }

    // Check currently selected account
    try {
      const selectedId = getDepositAccountRef();
      const selectedAccount = accounts.find(acc => acc.Id === selectedId);

      message += `CURRENTLY SELECTED:\n`;
      if (selectedAccount) {
        message += `  • ${selectedAccount.Name} (ID: ${selectedAccount.Id})\n`;
        message += `    Type: ${selectedAccount.AccountType}\n`;
        if (selectedAccount.AccountType !== 'Bank') {
          message += `    ⚠️ WARNING: This is NOT a Bank account!\n`;
        }
      } else {
        message += `  ⚠️ Account ID ${selectedId} NOT FOUND in QuickBooks!\n`;
      }
    } catch (e) {
      message += `CURRENTLY SELECTED: None\n`;
    }

    message += `\nCheck the execution log for full account list.`;

    showAlert(message, 'Account Debug');

  } catch (error) {
    showAlert(`Error: ${error.message}`);
    Logger.log('Debug error: ' + error.toString());
  }
}
