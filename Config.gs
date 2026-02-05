/**
 * Configuration Constants
 *
 * This file contains all configuration settings for the QuickBooks integration.
 */

const CONFIG = {
  // Environment setting - toggle between 'SANDBOX' and 'PRODUCTION'
  ENVIRONMENT: 'SANDBOX',

  // QuickBooks API Base URLs
  SANDBOX_BASE_URL: 'https://sandbox-quickbooks.api.intuit.com',
  PRODUCTION_BASE_URL: 'https://quickbooks.api.intuit.com',

  // OAuth URLs
  OAUTH_AUTHORIZE_URL: 'https://appcenter.intuit.com/connect/oauth2',
  OAUTH_TOKEN_URL: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  OAUTH_REVOKE_URL: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',

  // OAuth Scopes
  OAUTH_SCOPES: [
    'com.intuit.quickbooks.accounting'
  ],

  // Color Codes for Sheet Formatting
  COLORS: {
    MATCHED: '#6AA84F',        // Green - matched in both CSV and QB
    CSV_ONLY: '#F1C232',       // Yellow - in CSV only
    QB_ONLY: '#CC4125',        // Red - in QB only
    HEADER: '#4A86E8'          // Blue - header row
  },

  // Matching Tolerance
  AMOUNT_TOLERANCE: 0.01,      // ±$0.01 for amount matching

  // API Rate Limiting
  MAX_REQUESTS_PER_MINUTE: 500,

  // Column Indices (0-based for sheet operations, but displayed as 1-based)
  COLUMNS: {
    AMOUNT: 7,          // Column H (8th column, index 7)
    COMMENT1: 10        // Column K (11th column, index 10)
  },

  // New columns to add for QB data
  NEW_COLUMNS: [
    'QB Transaction ID',
    'QB Transaction Type',
    'QB Transaction Date',
    'QB Total Amount',
    'QB Customer Email',
    'QB Customer Name',
    'Match Status'
  ],

  /**
   * Get the current base URL based on environment setting
   */
  getBaseUrl: function() {
    return this.ENVIRONMENT === 'SANDBOX'
      ? this.SANDBOX_BASE_URL
      : this.PRODUCTION_BASE_URL;
  },

  /**
   * Get environment display name
   */
  getEnvironmentName: function() {
    return this.ENVIRONMENT === 'SANDBOX' ? '🧪 Sandbox' : '🏭 Production';
  }
};

/**
 * Property Keys for storing configuration and tokens
 */
const PROPERTY_KEYS = {
  // OAuth Credentials (set by user)
  CLIENT_ID_SANDBOX: 'QB_CLIENT_ID_SANDBOX',
  CLIENT_SECRET_SANDBOX: 'QB_CLIENT_SECRET_SANDBOX',
  CLIENT_ID_PRODUCTION: 'QB_CLIENT_ID_PRODUCTION',
  CLIENT_SECRET_PRODUCTION: 'QB_CLIENT_SECRET_PRODUCTION',

  // Redirect URI (manual override)
  REDIRECT_URI: 'QB_REDIRECT_URI',

  // OAuth Tokens (auto-managed)
  ACCESS_TOKEN: 'QB_ACCESS_TOKEN',
  REFRESH_TOKEN: 'QB_REFRESH_TOKEN',
  TOKEN_EXPIRY: 'QB_TOKEN_EXPIRY',
  REALM_ID: 'QB_REALM_ID',

  // Environment setting
  CURRENT_ENVIRONMENT: 'QB_ENVIRONMENT',

  // Deposit account selection
  DEPOSIT_ACCOUNT_ID: 'QB_DEPOSIT_ACCOUNT_ID',
  DEPOSIT_ACCOUNT_NAME: 'QB_DEPOSIT_ACCOUNT_NAME'
};
