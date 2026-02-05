/**
 * Utility Functions
 *
 * Helper functions for token management, logging, and common operations.
 */

/**
 * Get Script Properties Service
 */
function getScriptProperties() {
  return PropertiesService.getScriptProperties();
}

/**
 * Get current environment from stored properties or default to SANDBOX
 */
function getCurrentEnvironment() {
  const props = getScriptProperties();
  const env = props.getProperty(PROPERTY_KEYS.CURRENT_ENVIRONMENT);
  return env || 'SANDBOX';
}

/**
 * Set current environment
 */
function setCurrentEnvironment(environment) {
  if (environment !== 'SANDBOX' && environment !== 'PRODUCTION') {
    throw new Error('Invalid environment. Must be SANDBOX or PRODUCTION');
  }
  const props = getScriptProperties();
  props.setProperty(PROPERTY_KEYS.CURRENT_ENVIRONMENT, environment);
  CONFIG.ENVIRONMENT = environment;
}

/**
 * Get OAuth credentials for current environment
 */
function getOAuthCredentials() {
  const props = getScriptProperties();
  const env = getCurrentEnvironment();

  const clientIdKey = env === 'SANDBOX'
    ? PROPERTY_KEYS.CLIENT_ID_SANDBOX
    : PROPERTY_KEYS.CLIENT_ID_PRODUCTION;

  const clientSecretKey = env === 'SANDBOX'
    ? PROPERTY_KEYS.CLIENT_SECRET_SANDBOX
    : PROPERTY_KEYS.CLIENT_SECRET_PRODUCTION;

  const clientId = props.getProperty(clientIdKey);
  const clientSecret = props.getProperty(clientSecretKey);

  if (!clientId || !clientSecret) {
    throw new Error(
      `OAuth credentials not found for ${env} environment. ` +
      'Please run "QuickBooks → Setup → Configure OAuth Credentials"'
    );
  }

  return {
    clientId: clientId,
    clientSecret: clientSecret
  };
}

/**
 * Get redirect URI
 * Returns manual override if set, otherwise tries to get from ScriptApp
 */
function getRedirectUri() {
  const props = getScriptProperties();

  // First check if user manually set redirect URI
  const manualUri = props.getProperty(PROPERTY_KEYS.REDIRECT_URI);
  if (manualUri) {
    return manualUri;
  }

  // Fallback to ScriptApp (may not be reliable)
  return ScriptApp.getService().getUrl();
}

/**
 * Set redirect URI manually
 */
function setRedirectUri(uri) {
  const props = getScriptProperties();
  props.setProperty(PROPERTY_KEYS.REDIRECT_URI, uri);
  logWithTimestamp('Redirect URI set manually: ' + uri);
}

/**
 * Store OAuth tokens
 */
function storeTokens(accessToken, refreshToken, expiresIn, realmId) {
  const props = getScriptProperties();
  const expiryTime = new Date().getTime() + (expiresIn * 1000);

  props.setProperties({
    [PROPERTY_KEYS.ACCESS_TOKEN]: accessToken,
    [PROPERTY_KEYS.REFRESH_TOKEN]: refreshToken,
    [PROPERTY_KEYS.TOKEN_EXPIRY]: expiryTime.toString(),
    [PROPERTY_KEYS.REALM_ID]: realmId
  });

  Logger.log('Tokens stored successfully');
}

/**
 * Get stored access token
 */
function getAccessToken() {
  const props = getScriptProperties();
  const token = props.getProperty(PROPERTY_KEYS.ACCESS_TOKEN);
  const expiry = props.getProperty(PROPERTY_KEYS.TOKEN_EXPIRY);

  if (!token) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date().getTime();
  const expiryTime = parseInt(expiry);

  if (now >= expiryTime - (5 * 60 * 1000)) {
    // Token expired or about to expire, refresh it
    Logger.log('Access token expired, refreshing...');
    return refreshAccessToken();
  }

  return token;
}

/**
 * Get stored realm ID (QuickBooks company ID)
 */
function getRealmId() {
  const props = getScriptProperties();
  return props.getProperty(PROPERTY_KEYS.REALM_ID);
}

/**
 * Refresh the access token using the refresh token
 */
function refreshAccessToken() {
  const props = getScriptProperties();
  const refreshToken = props.getProperty(PROPERTY_KEYS.REFRESH_TOKEN);

  if (!refreshToken) {
    throw new Error('No refresh token found. Please re-authorize the application.');
  }

  const credentials = getOAuthCredentials();
  const authHeader = Utilities.base64Encode(
    credentials.clientId + ':' + credentials.clientSecret
  );

  const payload = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Basic ' + authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.OAUTH_TOKEN_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const result = JSON.parse(responseText);
      const realmId = getRealmId();

      // Store new tokens
      storeTokens(
        result.access_token,
        result.refresh_token,
        result.expires_in,
        realmId
      );

      Logger.log('Access token refreshed successfully');
      return result.access_token;
    } else {
      Logger.log('Failed to refresh token. Response: ' + responseText);
      throw new Error('Failed to refresh access token. Please re-authorize the application.');
    }
  } catch (error) {
    Logger.log('Error refreshing token: ' + error.toString());
    throw new Error('Failed to refresh access token: ' + error.message);
  }
}

/**
 * Clear all stored tokens and credentials
 */
function clearAllTokens() {
  const props = getScriptProperties();
  props.deleteProperty(PROPERTY_KEYS.ACCESS_TOKEN);
  props.deleteProperty(PROPERTY_KEYS.REFRESH_TOKEN);
  props.deleteProperty(PROPERTY_KEYS.TOKEN_EXPIRY);
  props.deleteProperty(PROPERTY_KEYS.REALM_ID);
  Logger.log('All tokens cleared');
}

/**
 * Check if the app is authorized
 */
function isAuthorized() {
  const props = getScriptProperties();
  const token = props.getProperty(PROPERTY_KEYS.ACCESS_TOKEN);
  const realmId = props.getProperty(PROPERTY_KEYS.REALM_ID);
  return !!(token && realmId);
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  return '$' + parseFloat(amount).toFixed(2);
}

/**
 * Parse currency string to number
 */
function parseCurrency(currencyString) {
  if (typeof currencyString === 'number') {
    return currencyString;
  }
  return parseFloat(currencyString.replace(/[$,]/g, ''));
}

/**
 * Extract email address from text using regex
 */
function extractEmail(text) {
  if (!text) return null;

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);

  return match ? match[0].toLowerCase() : null;
}

/**
 * Compare two amounts with tolerance
 * For refunds, compares absolute values since QB refunds are negative but CSV may have positive
 */
function amountsMatch(amount1, amount2, tolerance = CONFIG.AMOUNT_TOLERANCE) {
  // Direct comparison (handles normal sales receipts)
  const directDiff = Math.abs(amount1 - amount2);
  if (directDiff <= tolerance) {
    return true;
  }

  // Absolute value comparison (handles refunds where one is negative, one is positive)
  const absDiff = Math.abs(Math.abs(amount1) - Math.abs(amount2));
  return absDiff <= tolerance;
}

/**
 * Log with timestamp
 */
function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  Logger.log(`[${timestamp}] ${message}`);
}

/**
 * Show toast notification in spreadsheet
 */
function showToast(message, title = 'QuickBooks Integration', timeout = 5) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    ss.toast(message, title, timeout);
  }
}

/**
 * Show alert dialog
 */
function showAlert(message, title = 'QuickBooks Integration') {
  const ui = SpreadsheetApp.getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
}

/**
 * Show confirmation dialog
 */
function showConfirmation(message, title = 'QuickBooks Integration') {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(title, message, ui.ButtonSet.YES_NO);
  return result === ui.Button.YES;
}
