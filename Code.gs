/**
 * QuickBooks Deposit Matching Application
 * Google Apps Script for matching CSV deposits with QuickBooks sales receipts
 *
 * Main entry point and OAuth flow management
 */

/**
 * On spreadsheet open - create custom menu
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Get environment directly from properties (defensive coding)
    let env = 'SANDBOX';
    try {
      const props = PropertiesService.getScriptProperties();
      env = props.getProperty('QB_ENVIRONMENT') || 'SANDBOX';
    } catch (e) {
      Logger.log('Could not get environment from properties: ' + e.toString());
    }

    const envIcon = env === 'SANDBOX' ? '🧪' : '🏭';

    ui.createMenu('QuickBooks')
      .addItem(`${envIcon} Current: ${env}`, 'showEnvironmentInfo')
      .addSeparator()
      .addSubMenu(ui.createMenu('Setup')
        .addItem('0. Show Deployment Info', 'showDeploymentInfo')
        .addItem('0b. Set Redirect URI', 'configureRedirectUri')
        .addSeparator()
        .addItem('1. Configure OAuth Credentials', 'configureOAuthCredentials')
        .addItem('2. Authorize QuickBooks', 'startOAuthFlow')
        .addItem('3. Test Connection', 'testQuickBooksConnection')
        .addItem('4. Select Deposit Account', 'selectDepositAccount')
        .addSeparator()
        .addItem('Switch Environment', 'switchEnvironment')
        .addItem('Clear Authorization', 'clearAuthorization'))
      .addSeparator()
      .addItem('Match Deposits', 'matchDepositsWithSalesReceipts')
      .addItem('Create Deposit in QB', 'showDepositCreationDialog')
      .addSeparator()
      .addItem('Clear Match Data', 'clearMatchData')
      .addItem('Format Sheet', 'formatSheet')
      .addSeparator()
      .addItem('🔧 Debug Sales Receipt', 'debugSalesReceipt')
      .addItem('🔧 Debug List All Accounts', 'debugListAllAccounts')
      .addItem('🔧 Test Simple Deposit', 'testSimpleDepositWithoutLink')
      .addItem('🔧 Test Linked Deposit', 'testLinkedDeposit')
      .addToUi();
  } catch (error) {
    Logger.log('Error in onOpen: ' + error.toString());
    // Create a basic menu even if there's an error
    try {
      const ui = SpreadsheetApp.getUi();
      ui.createMenu('QuickBooks')
        .addItem('⚠ Error - Check Setup', 'showEnvironmentInfo')
        .addSeparator()
        .addSubMenu(ui.createMenu('Setup')
          .addItem('0. Show Deployment Info', 'showDeploymentInfo')
          .addItem('0b. Set Redirect URI', 'configureRedirectUri')
          .addSeparator()
          .addItem('1. Configure OAuth Credentials', 'configureOAuthCredentials')
          .addItem('2. Authorize QuickBooks', 'startOAuthFlow')
          .addItem('3. Test Connection', 'testQuickBooksConnection')
          .addItem('4. Select Deposit Account', 'selectDepositAccount'))
        .addSeparator()
        .addItem('🔧 Debug List All Accounts', 'debugListAllAccounts')
        .addItem('🔧 Test Linked Deposit', 'testLinkedDeposit')
        .addToUi();
    } catch (e) {
      // Silently fail - Apps Script will show error in execution log
      Logger.log('Failed to create menu: ' + e.toString());
    }
  }
}

/**
 * Show environment info
 */
function showEnvironmentInfo() {
  const env = getCurrentEnvironment();
  const authorized = isAuthorized();
  const realmId = getRealmId();

  let message = `Current Environment: ${env}\n`;
  message += `Base URL: ${CONFIG.getBaseUrl()}\n\n`;
  message += `Authorization Status: ${authorized ? '✓ Authorized' : '✗ Not Authorized'}\n`;

  if (realmId) {
    message += `Realm ID: ${realmId}\n`;
  }

  showAlert(message, 'Environment Info');
}

/**
 * Switch between Sandbox and Production environments
 */
function switchEnvironment() {
  const currentEnv = getCurrentEnvironment();
  const newEnv = currentEnv === 'SANDBOX' ? 'PRODUCTION' : 'SANDBOX';

  const confirmed = showConfirmation(
    `Switch from ${currentEnv} to ${newEnv}?\n\n` +
    `Note: You will need to re-authorize with the ${newEnv} credentials.`,
    'Switch Environment'
  );

  if (confirmed) {
    setCurrentEnvironment(newEnv);
    clearAllTokens();

    showAlert(
      `Environment switched to ${newEnv}.\n\n` +
      `Please run "Setup → Authorize QuickBooks" to connect to ${newEnv}.`,
      'Environment Switched'
    );

    // Refresh menu
    onOpen();
  }
}

/**
 * Configure OAuth credentials
 */
function configureOAuthCredentials() {
  const ui = SpreadsheetApp.getUi();
  const env = getCurrentEnvironment();

  const message = `Configure OAuth Credentials for ${env}\n\n` +
    `You need to provide your QuickBooks app credentials.\n\n` +
    `To get these:\n` +
    `1. Go to developer.intuit.com\n` +
    `2. Sign in to your developer account\n` +
    `3. Go to "My Apps"\n` +
    `4. Select your app (or create one)\n` +
    `5. Copy the Client ID and Client Secret\n\n` +
    `Note: Use ${env} credentials!`;

  ui.alert('OAuth Setup', message, ui.ButtonSet.OK);

  // Get Client ID
  const clientIdPrompt = ui.prompt(
    'Client ID',
    `Enter your QuickBooks ${env} Client ID:`,
    ui.ButtonSet.OK_CANCEL
  );

  if (clientIdPrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const clientId = clientIdPrompt.getResponseText().trim();
  if (!clientId) {
    showAlert('Client ID is required.');
    return;
  }

  // Get Client Secret
  const clientSecretPrompt = ui.prompt(
    'Client Secret',
    `Enter your QuickBooks ${env} Client Secret:`,
    ui.ButtonSet.OK_CANCEL
  );

  if (clientSecretPrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const clientSecret = clientSecretPrompt.getResponseText().trim();
  if (!clientSecret) {
    showAlert('Client Secret is required.');
    return;
  }

  // Save credentials
  const props = getScriptProperties();
  const clientIdKey = env === 'SANDBOX'
    ? PROPERTY_KEYS.CLIENT_ID_SANDBOX
    : PROPERTY_KEYS.CLIENT_ID_PRODUCTION;
  const clientSecretKey = env === 'SANDBOX'
    ? PROPERTY_KEYS.CLIENT_SECRET_SANDBOX
    : PROPERTY_KEYS.CLIENT_SECRET_PRODUCTION;

  props.setProperty(clientIdKey, clientId);
  props.setProperty(clientSecretKey, clientSecret);

  showAlert(
    `OAuth credentials saved for ${env}!\n\n` +
    `Next step: Run "Setup → Authorize QuickBooks"`,
    'Credentials Saved'
  );

  logWithTimestamp(`OAuth credentials configured for ${env}`);
}

/**
 * Start OAuth flow
 */
function startOAuthFlow() {
  try {
    const credentials = getOAuthCredentials();
    const env = getCurrentEnvironment();
    const ui = SpreadsheetApp.getUi();

    // Get the redirect URI
    const redirectUri = getRedirectUri();

    // Check if script is deployed
    if (!redirectUri) {
      const deployMessage = `⚠️ Script Not Deployed\n\n` +
        `Before authorizing, you must:\n\n` +
        `1. Deploy this script as a web app:\n` +
        `   • Go to Extensions → Apps Script\n` +
        `   • Click "Deploy" → "New deployment"\n` +
        `   • Click gear icon (⚙️) → Select "Web app"\n` +
        `   • Execute as: "Me"\n` +
        `   • Who has access: "Anyone"\n` +
        `   • Click "Deploy"\n\n` +
        `2. Set the redirect URI:\n` +
        `   • Copy the Web app URL from deployment\n` +
        `   • Run "Setup → Set Redirect URI"\n` +
        `   • Paste the URL\n\n` +
        `After deploying, run this menu item again.`;

      ui.alert('Deployment Required', deployMessage, ui.ButtonSet.OK);
      return;
    }

    // Build authorization URL
    const state = Utilities.getUuid();

    const authUrl = CONFIG.OAUTH_AUTHORIZE_URL +
      '?client_id=' + encodeURIComponent(credentials.clientId) +
      '&redirect_uri=' + encodeURIComponent(redirectUri) +
      '&response_type=code' +
      '&scope=' + encodeURIComponent(CONFIG.OAUTH_SCOPES.join(' ')) +
      '&state=' + encodeURIComponent(state);

    // Store state for verification
    const props = getScriptProperties();
    props.setProperty('OAUTH_STATE', state);

    // Show instructions
    const message = `Authorization Setup\n\n` +
      `Step 1: Verify this Redirect URI is in QuickBooks:\n` +
      `${redirectUri}\n\n` +
      `Step 2: Add to QuickBooks if not already there:\n` +
      `- Go to developer.intuit.com → My Apps → Your App\n` +
      `- Under "Keys & OAuth", add the Redirect URI\n` +
      `- Save the app settings\n\n` +
      `Step 3: Click OK, then click the authorization button`;

    ui.alert('QuickBooks Authorization', message, ui.ButtonSet.OK);

    // Create HTML for authorization
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              text-align: center;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #2ca01c;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-size: 16px;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #248a16;
            }
            .info {
              background-color: #f0f0f0;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h2>QuickBooks Authorization</h2>
          <p>Environment: <strong>${env}</strong></p>
          <div class="info">
            <p>Click the button below to authorize this app to access your QuickBooks data.</p>
            <p>You will be redirected to Intuit's secure login page.</p>
          </div>
          <a href="${authUrl}" class="button" target="_blank">
            Authorize QuickBooks Access
          </a>
          <div class="info">
            <p><small>After authorizing, you will be redirected back to this script.<br>
            The authorization will be saved automatically.</small></p>
          </div>
        </body>
      </html>
    `;

    const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(500)
      .setHeight(400);

    ui.showModalDialog(htmlOutput, 'Authorize QuickBooks');

  } catch (error) {
    showAlert(`Error starting OAuth flow: ${error.message}`);
  }
}

/**
 * Handle OAuth callback (doGet)
 */
function doGet(e) {
  const params = e.parameter;

  // Check if this is an OAuth callback
  if (params.code && params.realmId) {
    return handleOAuthCallback(params);
  }

  // Default response
  return HtmlService.createHtmlOutput('<h2>QuickBooks Integration Script</h2><p>This is a Google Apps Script for QuickBooks integration.</p>');
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
function handleOAuthCallback(params) {
  const code = params.code;
  const realmId = params.realmId;
  const state = params.state;

  try {
    // Verify state
    const props = getScriptProperties();
    const savedState = props.getProperty('OAUTH_STATE');

    if (state !== savedState) {
      throw new Error('Invalid state parameter. Possible CSRF attack.');
    }

    // Exchange code for tokens
    const credentials = getOAuthCredentials();
    const redirectUri = getRedirectUri();

    const authHeader = Utilities.base64Encode(
      credentials.clientId + ':' + credentials.clientSecret
    );

    const payload = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
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

    const response = UrlFetchApp.fetch(CONFIG.OAUTH_TOKEN_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const result = JSON.parse(responseText);

      // Store tokens
      storeTokens(
        result.access_token,
        result.refresh_token,
        result.expires_in,
        realmId
      );

      // Clear state
      props.deleteProperty('OAUTH_STATE');

      logWithTimestamp('OAuth authorization successful');

      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
          <head>
            <base target="_top">
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                text-align: center;
              }
              .success {
                color: #2ca01c;
                font-size: 48px;
              }
              .message {
                font-size: 18px;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="success">✓</div>
            <h2>Authorization Successful!</h2>
            <div class="message">
              <p>Your QuickBooks account has been connected.</p>
              <p>Realm ID: ${realmId}</p>
              <p><strong>You can close this window and return to your spreadsheet.</strong></p>
            </div>
          </body>
        </html>
      `);

    } else {
      throw new Error(`Failed to exchange code for tokens: ${responseText}`);
    }

  } catch (error) {
    Logger.log('OAuth callback error: ' + error.toString());

    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              text-align: center;
            }
            .error {
              color: #cc0000;
              font-size: 48px;
            }
          </style>
        </head>
        <body>
          <div class="error">✗</div>
          <h2>Authorization Failed</h2>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
}

/**
 * Select deposit account from QuickBooks
 */
function selectDepositAccount() {
  try {
    showToast('Fetching bank accounts from QuickBooks...', 'Account Selection');

    const accounts = getBankAccounts();

    if (accounts.length === 0) {
      showAlert(
        'No bank accounts found in QuickBooks.\n\n' +
        'Please create a bank account in QuickBooks first.',
        'No Accounts Found'
      );
      return;
    }

    // Build account list for display
    let message = 'Select Deposit Account\n\n';
    message += 'Available bank accounts in QuickBooks:\n\n';

    accounts.forEach((account, index) => {
      const balance = account.CurrentBalance || 0;
      message += `${index + 1}. ${account.Name}\n`;
      message += `   Type: ${account.AccountType}\n`;
      message += `   Balance: ${formatCurrency(balance)}\n\n`;
    });

    message += `Current selection: ${getDepositAccountName()}\n\n`;
    message += 'Enter the number of the account to use for deposits:';

    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Select Deposit Account', message, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const selection = parseInt(response.getResponseText().trim());

    if (isNaN(selection) || selection < 1 || selection > accounts.length) {
      showAlert('Invalid selection. Please enter a number between 1 and ' + accounts.length);
      return;
    }

    const selectedAccount = accounts[selection - 1];

    // Confirm selection
    const confirmMessage = `Confirm Deposit Account Selection\n\n` +
      `Account: ${selectedAccount.Name}\n` +
      `Type: ${selectedAccount.AccountType}\n` +
      `Balance: ${formatCurrency(selectedAccount.CurrentBalance || 0)}\n\n` +
      `All future deposits will be created to this account.\n\n` +
      `Continue?`;

    const confirmed = showConfirmation(confirmMessage, 'Confirm Selection');

    if (!confirmed) {
      return;
    }

    // Save selection
    setDepositAccount(selectedAccount.Id, selectedAccount.Name);

    showAlert(
      `Deposit account configured!\n\n` +
      `Account: ${selectedAccount.Name}\n` +
      `ID: ${selectedAccount.Id}\n\n` +
      `You can now create deposits.`,
      'Account Configured'
    );

  } catch (error) {
    Logger.log('Error selecting deposit account: ' + error.toString());
    showAlert(`Error: ${error.message}`);
  }
}

/**
 * Clear authorization and tokens
 */
function clearAuthorization() {
  const confirmed = showConfirmation(
    'This will clear all stored tokens and you will need to re-authorize.\n\nContinue?',
    'Clear Authorization'
  );

  if (confirmed) {
    clearAllTokens();
    showAlert('Authorization cleared. Run "Setup → Authorize QuickBooks" to reconnect.');
  }
}

/**
 * Debug: Show deployment info
 */
function showDeploymentInfo() {
  const redirectUri = getRedirectUri();
  const autoUri = ScriptApp.getService().getUrl();
  const env = getCurrentEnvironment();
  const props = getScriptProperties();
  const manualUri = props.getProperty(PROPERTY_KEYS.REDIRECT_URI);

  let message = `Deployment Information\n\n`;
  message += `Environment: ${env}\n\n`;
  message += `Current Redirect URI:\n`;
  message += `${redirectUri || 'NOT SET'}\n\n`;

  if (manualUri) {
    message += `✓ Using manually set URI\n\n`;
  } else if (autoUri) {
    message += `✓ Using auto-detected URI\n`;
    message += `⚠ WARNING: Auto-detected may not be reliable!\n`;
    message += `Recommended: Set manually via "Setup → Set Redirect URI"\n\n`;
  } else {
    message += `✗ No redirect URI found\n\n`;
    message += `You must:\n`;
    message += `1. Deploy as web app (Extensions → Apps Script → Deploy)\n`;
    message += `2. Run "Setup → Set Redirect URI"\n\n`;
  }

  message += `Auto-detected URI: ${autoUri || 'None'}\n`;
  message += `Manual URI: ${manualUri || 'None'}\n\n`;

  message += `To verify your deployment:\n`;
  message += `1. Extensions → Apps Script\n`;
  message += `2. Deploy → Manage deployments\n`;
  message += `3. Copy the Web app URL\n`;
  message += `4. Run "Setup → Set Redirect URI"\n`;
  message += `5. Paste that URL\n\n`;

  message += `Add to QuickBooks:\n`;
  message += `developer.intuit.com → My Apps → Your App\n`;
  message += `Keys & OAuth → Redirect URIs → Add URI`;

  showAlert(message, 'Deployment Info');

  // Log to console
  Logger.log('Redirect URI: ' + redirectUri);
  Logger.log('Auto URI: ' + autoUri);
  Logger.log('Manual URI: ' + manualUri);
}

/**
 * Manually set the redirect URI
 */
function configureRedirectUri() {
  const ui = SpreadsheetApp.getUi();
  const currentUri = getRedirectUri();

  const instructions = `Set Redirect URI\n\n` +
    `Get the Web app URL from:\n` +
    `Extensions → Apps Script → Deploy → Manage deployments\n\n` +
    `The URL should look like:\n` +
    `https://script.google.com/macros/s/AKfycby.../exec\n\n` +
    `Current URI: ${currentUri || 'Not set'}`;

  ui.alert('Redirect URI Setup', instructions, ui.ButtonSet.OK);

  const response = ui.prompt(
    'Set Redirect URI',
    'Paste your Web app URL (from Manage deployments):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const uri = response.getResponseText().trim();

  if (!uri) {
    showAlert('Redirect URI is required.');
    return;
  }

  // Validate URL format
  if (!uri.startsWith('https://script.google.com/macros/s/') || !uri.endsWith('/exec')) {
    const confirm = showConfirmation(
      `Warning: This doesn't look like a valid Web app URL.\n\n` +
      `Expected format:\n` +
      `https://script.google.com/macros/s/AKfycby.../exec\n\n` +
      `Your input:\n${uri}\n\n` +
      `Continue anyway?`,
      'Invalid Format'
    );

    if (!confirm) {
      return;
    }
  }

  setRedirectUri(uri);

  showAlert(
    `Redirect URI saved!\n\n` +
    `${uri}\n\n` +
    `Make sure to add this EXACT URL to QuickBooks:\n` +
    `developer.intuit.com → My Apps → Your App → Keys & OAuth → Redirect URIs`,
    'URI Saved'
  );
}
