/**
 * QuickBooks API Wrapper
 *
 * Functions for interacting with the QuickBooks Online API.
 */

/**
 * Make an authenticated API request to QuickBooks
 */
function makeQBApiRequest(endpoint, method = 'GET', payload = null) {
  const accessToken = getAccessToken();
  const realmId = getRealmId();

  if (!accessToken || !realmId) {
    throw new Error('Not authorized. Please run "QuickBooks → Authorize" first.');
  }

  const baseUrl = CONFIG.getBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}/${endpoint}`;

  const options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  if (payload && (method === 'POST' || method === 'PUT')) {
    options.payload = JSON.stringify(payload);
  }

  logWithTimestamp(`API Request: ${method} ${endpoint}`);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200 || responseCode === 201) {
      return JSON.parse(responseText);
    } else {
      Logger.log(`API Error (${responseCode}): ${responseText}`);
      throw new Error(`QuickBooks API error (${responseCode}): ${responseText}`);
    }
  } catch (error) {
    Logger.log('API Request failed: ' + error.toString());
    throw error;
  }
}

/**
 * Query sales receipts from QuickBooks
 * @param {string} query - SQL-like query string
 * @returns {Array} Array of sales receipts
 */
function querySalesReceipts(query) {
  const endpoint = `query?query=${encodeURIComponent(query)}`;
  const response = makeQBApiRequest(endpoint, 'GET');

  if (response.QueryResponse && response.QueryResponse.SalesReceipt) {
    return response.QueryResponse.SalesReceipt;
  }

  return [];
}

/**
 * Get sales receipts within a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Array of sales receipts
 */
function getSalesReceiptsByDateRange(startDate, endDate) {
  const startDateStr = formatDateForQuery(startDate);
  const endDateStr = formatDateForQuery(endDate);

  const query = `SELECT * FROM SalesReceipt WHERE TxnDate >= '${startDateStr}' AND TxnDate <= '${endDateStr}' MAXRESULTS 1000`;

  logWithTimestamp(`Querying sales receipts from ${startDateStr} to ${endDateStr}`);
  return querySalesReceipts(query);
}

/**
 * Get all sales receipts (last 365 days by default)
 * @returns {Array} Array of sales receipts
 */
function getAllSalesReceipts() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365); // Last year

  return getSalesReceiptsByDateRange(startDate, endDate);
}

/**
 * Read a specific sales receipt by ID
 * @param {string} salesReceiptId - Sales receipt ID
 * @returns {Object} Sales receipt object
 */
function readSalesReceipt(salesReceiptId) {
  const endpoint = `salesreceipt/${salesReceiptId}`;
  const response = makeQBApiRequest(endpoint, 'GET');
  return response.SalesReceipt;
}

/**
 * Query customer by ID
 * @param {string} customerId - Customer ID
 * @returns {Object} Customer object
 */
function readCustomer(customerId) {
  const endpoint = `customer/${customerId}`;
  const response = makeQBApiRequest(endpoint, 'GET');
  return response.Customer;
}

/**
 * Get all customers (for caching)
 * @returns {Object} Map of customer ID to customer object
 */
function getAllCustomers() {
  const query = 'SELECT * FROM Customer MAXRESULTS 1000';
  const endpoint = `query?query=${encodeURIComponent(query)}`;
  const response = makeQBApiRequest(endpoint, 'GET');

  const customerMap = {};

  if (response.QueryResponse && response.QueryResponse.Customer) {
    response.QueryResponse.Customer.forEach(customer => {
      customerMap[customer.Id] = customer;
    });
  }

  logWithTimestamp(`Cached ${Object.keys(customerMap).length} customers`);
  return customerMap;
}

/**
 * Get customer email from customer object
 * @param {Object} customer - Customer object
 * @returns {string|null} Email address or null
 */
function getCustomerEmail(customer) {
  if (!customer) return null;

  // Try PrimaryEmailAddr first
  if (customer.PrimaryEmailAddr && customer.PrimaryEmailAddr.Address) {
    return customer.PrimaryEmailAddr.Address.toLowerCase();
  }

  // Try deprecated Email field
  if (customer.Email) {
    return customer.Email.toLowerCase();
  }

  return null;
}

/**
 * Create a deposit in QuickBooks
 * @param {Object} depositData - Deposit object to create
 * @returns {Object} Created deposit object
 */
function createDeposit(depositData) {
  const endpoint = 'deposit';

  // Log the deposit JSON for debugging
  Logger.log('Creating deposit with data: ' + JSON.stringify(depositData, null, 2));

  const response = makeQBApiRequest(endpoint, 'POST', depositData);

  logWithTimestamp(`Deposit created: ID ${response.Deposit.Id}`);
  return response.Deposit;
}

/**
 * Build deposit object from matched sales receipts
 * @param {Array} matchedReceipts - Array of matched sales receipt data
 * @param {string} depositToAccountRef - Account reference (e.g., "35" for Checking)
 * @param {Date} txnDate - Transaction date
 * @param {string} memo - Optional memo/note for the deposit
 * @returns {Object} Deposit object ready for API
 */
function buildDepositObject(matchedReceipts, depositToAccountRef, txnDate, memo) {
  // Get deposit account name
  const depositAccountName = getDepositAccountName();

  // Build lines with LinkedTxn (for sales receipts, we don't need AccountRef)
  const lines = matchedReceipts.map((receipt, index) => {
    return {
      Amount: receipt.qbData.TotalAmt,
      LinkedTxn: [
        {
          TxnId: String(receipt.qbData.Id),
          TxnType: 'SalesReceipt',
          TxnLineId: '0'  // Line ID within the sales receipt
        }
      ]
    };
  });

  const deposit = {
    DepositToAccountRef: {
      name: depositAccountName,
      value: String(depositToAccountRef)
    },
    TxnDate: formatDateForQuery(txnDate),
    Line: lines
  };

  // Add memo if provided
  if (memo) {
    deposit.PrivateNote = memo;
  }

  return deposit;  // Don't wrap in { Deposit: ... } - API expects direct object
}

/**
 * Format date for QuickBooks query (YYYY-MM-DD)
 */
function formatDateForQuery(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the Undeposited Funds account
 * @returns {Object} Undeposited Funds account with Id and Name
 */
function getUndepositedfundsAccount() {
  try {
    const query = "SELECT * FROM Account WHERE AccountType = 'Other Current Asset' AND Name = 'Undeposited Funds'";
    const endpoint = `query?query=${encodeURIComponent(query)}`;
    const response = makeQBApiRequest(endpoint, 'GET');

    if (response.QueryResponse && response.QueryResponse.Account && response.QueryResponse.Account.length > 0) {
      const account = response.QueryResponse.Account[0];
      return {
        Id: account.Id,
        Name: account.Name
      };
    }

    // Fallback: try to find by AccountSubType
    const query2 = "SELECT * FROM Account WHERE AccountSubType = 'UndepositedFunds'";
    const endpoint2 = `query?query=${encodeURIComponent(query2)}`;
    const response2 = makeQBApiRequest(endpoint2, 'GET');

    if (response2.QueryResponse && response2.QueryResponse.Account && response2.QueryResponse.Account.length > 0) {
      const account = response2.QueryResponse.Account[0];
      return {
        Id: account.Id,
        Name: account.Name
      };
    }

    throw new Error('Undeposited Funds account not found in QuickBooks');

  } catch (error) {
    Logger.log('Error getting Undeposited Funds account: ' + error.toString());
    throw error;
  }
}

/**
 * Get all bank accounts from QuickBooks
 * @returns {Array} Array of account objects
 */
function getBankAccounts() {
  // Query for Bank type accounts only (for deposits)
  const query = "SELECT * FROM Account WHERE AccountType = 'Bank' AND Active = true MAXRESULTS 1000";
  const endpoint = `query?query=${encodeURIComponent(query)}`;
  const response = makeQBApiRequest(endpoint, 'GET');

  if (response.QueryResponse && response.QueryResponse.Account) {
    return response.QueryResponse.Account;
  }

  return [];
}

/**
 * Get deposit account reference
 * Returns stored account ID or prompts user to select one
 */
function getDepositAccountRef() {
  const props = getScriptProperties();
  const accountId = props.getProperty(PROPERTY_KEYS.DEPOSIT_ACCOUNT_ID);

  if (accountId) {
    return accountId;
  }

  // No account configured - user needs to select one
  throw new Error(
    'No deposit account configured. Please run "QuickBooks → Setup → Select Deposit Account" first.'
  );
}

/**
 * Get deposit account name (for display)
 */
function getDepositAccountName() {
  const props = getScriptProperties();
  return props.getProperty(PROPERTY_KEYS.DEPOSIT_ACCOUNT_NAME) || 'Not set';
}

/**
 * Set deposit account
 */
function setDepositAccount(accountId, accountName) {
  const props = getScriptProperties();
  props.setProperties({
    [PROPERTY_KEYS.DEPOSIT_ACCOUNT_ID]: accountId,
    [PROPERTY_KEYS.DEPOSIT_ACCOUNT_NAME]: accountName
  });
  logWithTimestamp(`Deposit account set: ${accountName} (ID: ${accountId})`);
}

/**
 * Test API connection
 */
function testQuickBooksConnection() {
  try {
    const endpoint = 'companyinfo/' + getRealmId();
    const response = makeQBApiRequest(endpoint, 'GET');

    if (response.CompanyInfo) {
      const company = response.CompanyInfo;
      showAlert(
        `Successfully connected to QuickBooks!\n\n` +
        `Company: ${company.CompanyName}\n` +
        `Environment: ${CONFIG.getEnvironmentName()}\n` +
        `Realm ID: ${getRealmId()}`,
        'Connection Test'
      );
      return true;
    }
  } catch (error) {
    showAlert(
      `Failed to connect to QuickBooks:\n\n${error.message}`,
      'Connection Test Failed'
    );
    return false;
  }
}
