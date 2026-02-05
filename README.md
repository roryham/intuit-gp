# QuickBooks Deposit Matching Application

A Google Apps Script application that matches deposits from Google Sheets with QuickBooks Online sales receipts and refund receipts, then creates bank deposits automatically.

## Features

- **OAuth 2.0 Integration**: Secure authentication with QuickBooks Online
- **Sandbox & Production Support**: Test in sandbox before going live
- **Intelligent Matching**: Matches deposits based on email address AND amount
- **Sales Receipt & Refund Receipt Support**: Handles both positive and negative transactions
- **Visual Feedback**: Color-coded rows (Green=Matched, Yellow=CSV Only, Red=QB Only)
- **Automatic Deposit Creation**: Creates QuickBooks deposits linking matched receipts
- **Custom Deposit Date & Memo**: Specify deposit date and reference notes
- **Performance Optimized**: Caches customer data to minimize API calls
- **Robust Error Handling**: Gracefully handles missing data and expired tokens

## Overview

This application helps reconcile credit card transactions (from CSV exports) with QuickBooks receipts by:

1. Extracting customer emails from CSV Comment field
2. Querying QuickBooks for sales receipts AND refund receipts in the date range
3. Matching based on email (case-insensitive) AND amount (±$0.01 tolerance, supports negative amounts)
4. Color-coding matched vs unmatched rows
5. Creating QuickBooks bank deposits for matched transactions (with custom dates and memos)

## Installation

### 1. Create a Google Sheet

1. Create a new Google Sheet or open an existing one with your transaction data
2. Your CSV data should have these columns:
   - **Column H (8)**: Amount (e.g., "$189.10")
   - **Column K (11)**: Comment1 (e.g., "Robert Poole andy@phreshpicks.com")

### 2. Add the Apps Script Code

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code in `Code.gs`
3. Create the following files and copy the code from this repository:
   - `Code.gs`
   - `Config.gs`
   - `QuickBooksAPI.gs`
   - `MatchingLogic.gs`
   - `SheetsUI.gs`
   - `Utils.gs`
   - `appsscript.json`

4. Save the project (Ctrl+S or Cmd+S)
5. Close the Apps Script editor and reload your Google Sheet

### 3. Set Up QuickBooks App

See [SETUP_OAUTH.md](SETUP_OAUTH.md) for detailed instructions on:
- Creating a QuickBooks app
- Configuring OAuth redirect URIs
- Getting your Client ID and Client Secret

## Usage

### Initial Setup

1. **Open the QuickBooks Menu**
   - After reloading your sheet, you'll see a "QuickBooks" menu in the menu bar

2. **Configure OAuth Credentials**
   - Go to **QuickBooks → Setup → 1. Configure OAuth Credentials**
   - Enter your QuickBooks Client ID and Client Secret
   - The app starts in SANDBOX mode by default

3. **Authorize QuickBooks**
   - Go to **QuickBooks → Setup → 2. Authorize QuickBooks**
   - Copy the Script URL (Redirect URI) shown
   - Add this Redirect URI to your QuickBooks app settings
   - Click the authorization link
   - Sign in to your QuickBooks account (Sandbox or Production)
   - Approve the access request

4. **Test Connection**
   - Go to **QuickBooks → Setup → 3. Test Connection**
   - Verify you can connect to QuickBooks

5. **Select Deposit Account**
   - Go to **QuickBooks → Setup → 4. Select Deposit Account**
   - Choose the bank account where deposits should be created
   - This is required before creating deposits

### Running the Matching Process

1. **Load Your CSV Data**
   - Paste your transaction CSV data into the sheet
   - Ensure columns H (Amount) and K (Comment1 with email) are populated

2. **Match Deposits**
   - Go to **QuickBooks → Match Deposits**
   - The app will:
     - Parse deposits from your sheet
     - Fetch sales receipts from QuickBooks
     - Match based on email and amount
     - Color-code the results
     - Add new columns with QuickBooks data

3. **Review Results**
   - **GREEN rows**: Matched successfully (ready for deposit)
   - **YELLOW rows**: In CSV only (no matching QuickBooks receipt)
   - Check the "Match Status" column for details

4. **Create Deposit in QuickBooks**
   - Go to **QuickBooks → Create Deposit in QB**
   - Review the summary (number of receipts, total amount, deposit account)
   - Confirm to create the deposit
   - Enter the deposit date (or use today's date)
   - Optionally enter a memo/reference for the deposit
   - A QuickBooks deposit will be created linking all matched sales receipts

### Switching Environments

To switch from Sandbox to Production (or vice versa):

1. Go to **QuickBooks → Setup → Switch Environment**
2. Confirm the switch
3. Re-configure OAuth credentials for the new environment
4. Re-authorize with the new environment

## How Matching Works

### Matching Criteria (BOTH must be true)

1. **Email Match**: Email extracted from CSV Comment1 field must match the customer email in QuickBooks
   - Comparison is case-insensitive
   - Email format: `"Customer Name email@domain.com"` → Extracts: `email@domain.com`

2. **Amount Match**: CSV Amount must match QuickBooks Receipt TotalAmt
   - Tolerance: ±$0.01 (handles floating point precision)
   - CSV format: `"$189.10"` → Parsed: `189.10`
   - Supports negative amounts for refunds: `"-$5400.00"` → Parsed: `-5400.00`
   - Matches both positive (sales receipts) and negative (refund receipts)

### Customer Email Resolution

The app fetches customer emails from QuickBooks by:
1. Caching all customers at startup (1 API call instead of N calls)
2. Looking up customer email from the receipt's CustomerRef (works for both SalesReceipt and RefundReceipt)
3. Using the customer's PrimaryEmailAddr or Email field

## CSV File Format

### Expected Columns

| # | Transaction Id | Time | Type | Tender Type | Account Number | Expires | Amount | Result Code | Response Msg | Comment1 | Comment2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | AW3A1B323FD4 | 1/16/2026 13:20 | Sale | American Express | 1566 | 26-Jan | $189.10 | 0 | Approved | Robert Poole andy@phreshpicks.com | 965919 |

### Key Columns

- **Column H (8)**: Amount - Dollar amount with $ sign
- **Column K (11)**: Comment1 - Customer name and email

## Added Columns

The app adds these columns to your sheet:

- **QB Transaction ID**: QuickBooks receipt ID
- **QB Transaction Type**: Either "SalesReceipt" or "RefundReceipt"
- **QB Transaction Date**: Transaction date from QuickBooks
- **QB Total Amount**: Amount from QuickBooks (can be negative for refunds)
- **QB Customer Email**: Customer email from QuickBooks
- **QB Customer Name**: Customer name from QuickBooks
- **Match Status**: Match result (✓ Matched, ⚠ In CSV only, ⚠ In QB only)

## Menu Reference

### QuickBooks Menu

- **🧪 Current: SANDBOX** / **🏭 Current: PRODUCTION**: Shows current environment
- **Setup**
  - **0. Show Deployment Info**: Display deployment and OAuth details
  - **0b. Set Redirect URI**: Manually configure OAuth redirect URI
  - **1. Configure OAuth Credentials**: Enter Client ID and Secret
  - **2. Authorize QuickBooks**: Connect to QuickBooks account
  - **3. Test Connection**: Verify API connection
  - **4. Select Deposit Account**: Choose bank account for deposits
  - **Switch Environment**: Toggle Sandbox/Production
  - **Clear Authorization**: Remove stored tokens
- **Match Deposits**: Run the matching process
- **Create Deposit in QB**: Create deposit from matched receipts
- **Clear Match Data**: Remove all matching data and formatting
- **Format Sheet**: Apply formatting to the sheet
- **Debug** (optional tools for troubleshooting)
  - **Debug Sales Receipt**: Inspect sales receipt structure
  - **Debug List All Accounts**: View all QuickBooks accounts
  - **Test Simple Deposit**: Test basic deposit creation
  - **Test Linked Deposit**: Test deposit with linked sales receipts

## Troubleshooting

### "OAuth credentials not found"
- Run **QuickBooks → Setup → 1. Configure OAuth Credentials**
- Make sure you're using credentials for the correct environment (Sandbox vs Production)

### "Not authorized"
- Run **QuickBooks → Setup → 2. Authorize QuickBooks**
- Make sure the Redirect URI is added to your QuickBooks app

### Redirect URI Mismatch / Google Drive Error
- The redirect URI must match exactly between your QuickBooks app and the deployed web app
- Go to **Extensions → Apps Script → Deploy → Manage deployments** and copy the Web app URL
- Use **QuickBooks → Setup → 0b. Set Redirect URI** to manually configure it
- Add the same URL to your QuickBooks app under **Keys & OAuth → Redirect URIs**
- If the web app works in incognito but not your main browser, do a hard refresh (Ctrl+Shift+R)

### "No deposit account configured"
- Run **QuickBooks → Setup → 4. Select Deposit Account**
- Select the bank account where you want deposits created
- Only Bank type accounts are shown for deposit selection

### "No matches found"
- Check that emails in Comment1 column match customer emails in QuickBooks exactly
- Verify amounts match within $0.01
- Ensure the date range includes your transactions

### "Failed to refresh access token"
- The refresh token expires every 100 days
- Run **QuickBooks → Setup → Clear Authorization**
- Run **QuickBooks → Setup → 2. Authorize QuickBooks** again

### Deposit Creation Errors
- **"Request has invalid or unsupported property"**: The deposit structure may be incorrect. This is handled automatically, but if you encounter it, check the execution logs.
- **"Select a bank account for this deposit"**: Make sure you've selected a Bank type account using **Setup → 4. Select Deposit Account**
- **"Required parameter LinkedTxn.TxnLineId is missing"**: This is handled automatically in the deposit creation code. If you see this error, the code may need updating.
- For debugging deposit issues, use the **Debug** menu tools to inspect sales receipts and test deposit creation

### API Rate Limiting
- QuickBooks allows 500 requests per minute per company
- The app is optimized with customer caching
- If you hit the limit, wait a minute and try again

## Performance Notes

- **100 deposits without caching**: ~200 API calls (~100 seconds)
- **100 deposits with caching**: ~101 API calls (~50 seconds)
- **Timeout limit**: 6 minutes per execution (Google Apps Script limit)

## Security

- Client ID and Client Secret stored in **Script Properties** (shared)
- Access tokens stored in **Script Properties** (shared)
- Refresh tokens automatically refresh expired access tokens
- Tokens are never exposed in the sheet or logs

## Limitations

- Read-only access to QuickBooks (creates deposits only)
- Maximum 1000 sales receipts per query
- 6-minute execution timeout (Google Apps Script)
- Refresh token expires every 100 days (requires re-authorization)

## Support

For issues or questions:
- Check [SETUP_OAUTH.md](SETUP_OAUTH.md) for setup help
- Review QuickBooks API documentation: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/salesreceipt
- Check the Apps Script execution log: **Extensions → Apps Script → Executions**

## License

This project is provided as-is for internal business use.
