# Project Summary

## QuickBooks Deposit Matching Application

A Google Apps Script application that matches CSV deposit data from Google Sheets with QuickBooks Online sales receipts and refund receipts, then automatically creates bank deposits in QuickBooks.

---

## Project Files

### Google Apps Script Files (Copy to Apps Script Editor)

#### Core Application Files

1. **`Code.gs`** - Main Entry Point
   - OAuth 2.0 flow management
   - Menu creation (`onOpen()`)
   - Authorization handling (`doGet()` callback)
   - Environment switching (Sandbox ↔ Production)
   - Credential configuration dialogs
   - ~350 lines

2. **`Config.gs`** - Configuration Constants
   - Environment settings (SANDBOX/PRODUCTION)
   - QuickBooks API URLs
   - OAuth endpoints and scopes
   - Color codes for sheet formatting
   - Column mappings
   - Property key definitions
   - ~100 lines

3. **`QuickBooksAPI.gs`** - QuickBooks API Wrapper
   - API request handling with authentication
   - Sales receipt queries and reads
   - Customer data fetching and caching
   - Deposit creation
   - Connection testing
   - Token refresh handling
   - ~250 lines

4. **`MatchingLogic.gs`** - Matching Algorithm
   - Main matching orchestration
   - CSV deposit parsing
   - Email extraction from Comment1 field
   - Sales receipt enrichment with customer data
   - Matching logic (email + amount)
   - Match result generation
   - ~250 lines

5. **`SheetsUI.gs`** - Google Sheets UI Management
   - Sheet column management
   - Color coding (GREEN/YELLOW/RED)
   - Match data display
   - Deposit creation dialog
   - Data clearing
   - Sheet formatting
   - ~200 lines

6. **`Utils.gs`** - Utility Functions
   - Script Properties management
   - Token storage and retrieval
   - Environment getters/setters
   - OAuth credential helpers
   - Currency parsing and formatting
   - Email extraction
   - Amount comparison (with tolerance)
   - Toast/alert helpers
   - ~250 lines

7. **`appsscript.json`** - Apps Script Manifest
   - Project configuration
   - OAuth scopes
   - Runtime version (V8)
   - Exception logging

**Total Code:** ~1,400 lines of JavaScript

---

### Documentation Files

1. **`README.md`** - Main Documentation
   - Project overview and features
   - Installation instructions
   - Complete usage guide
   - Matching logic explanation
   - Menu reference
   - Troubleshooting
   - Security and performance notes

2. **`SETUP_OAUTH.md`** - OAuth Setup Guide
   - Step-by-step QuickBooks app creation
   - Redirect URI configuration
   - Credential management
   - Authorization walkthrough
   - Environment switching guide
   - Detailed troubleshooting
   - Security best practices

3. **`QUICK_START.md`** - Quick Start Guide
   - 10-minute setup guide
   - Essential steps only
   - Quick troubleshooting
   - Perfect for first-time users

4. **`SAMPLE_DATA.md`** - Sample Data & Testing
   - CSV format examples
   - Test data creation guide
   - Matching scenarios
   - Expected results
   - Common issues and solutions

5. **`PROJECT_SUMMARY.md`** - This File
   - Project overview
   - File structure
   - Technical architecture
   - Features summary

---

### Configuration Files

1. **`.gitignore`**
   - Excludes sensitive files (.clasp.json, credentials)
   - Ignores logs, IDE files, test data

2. **`.clasp.json.template`**
   - Template for local development with clasp
   - Copy to `.clasp.json` and add your script ID

---

### Original Specification Files

1. **`INSTRUCTIONS.org`** - Development instructions
2. **`SPECIFICATION.org`** - Original project requirements

---

## Technical Architecture

### Technology Stack
- **Platform**: Google Apps Script (JavaScript ES6+)
- **Sheet Integration**: Google Sheets API (built-in)
- **External API**: QuickBooks Online API v3
- **Authentication**: OAuth 2.0
- **Storage**: Properties Service (Script Properties)
- **Runtime**: V8 Engine

### Key Features

#### 1. OAuth 2.0 Authentication
- Secure token storage in Script Properties
- Automatic token refresh (expires every 60 minutes)
- Refresh token valid for 100 days
- Support for both Sandbox and Production environments
- Separate credentials per environment

#### 2. Intelligent Matching
- **Dual criteria**: Email AND amount must match
- **Email extraction**: Regex-based from Comment1 field
- **Case-insensitive**: Email comparison
- **Amount tolerance**: ±$0.01 for floating-point precision
- **Customer caching**: Optimizes API calls (1 vs N queries)

#### 3. Visual Feedback
- **GREEN rows**: Matched (both email and amount)
- **YELLOW rows**: CSV only (no QB match)
- **RED rows**: QB only (optional, not currently displayed)
- **New columns**: QB Sales Receipt ID, Date, Amount, Email, Name, Status

#### 4. Deposit Creation
- Links matched sales receipts to a QuickBooks deposit
- Requires deposit account selection (Bank type only)
- User confirmation before creation
- Summary display (count, total amount, deposit account)
- Custom deposit date selection (with default to today)
- Optional deposit memo/reference (stored in PrivateNote field)
- Error handling and logging
- LinkedTxn structure with TxnLineId for linking sales receipts

#### 5. Performance Optimization
- Customer data caching (reduces API calls by ~50%)
- Date range filtering (reduces data payload)
- Efficient matching algorithm (O(n*m) with early termination)
- Batch operations where possible

### Data Flow

```
1. User loads CSV data into Google Sheet
   ↓
2. User runs "Match Deposits"
   ↓
3. Script parses CSV data (email extraction, amount parsing)
   ↓
4. Script queries QuickBooks API:
   - Fetch all customers (cache)
   - Fetch sales receipts in date range
   ↓
5. Script enriches sales receipts with customer emails
   ↓
6. Matching algorithm compares:
   - CSV email vs QB customer email
   - CSV amount vs QB sales receipt amount
   ↓
7. Results written to sheet:
   - Add new columns
   - Populate QB data
   - Color code rows
   ↓
8. User reviews matches
   ↓
9. User selects deposit account (one-time setup)
   - Queries Bank type accounts
   - Stores selection
   ↓
10. User runs "Create Deposit in QB" (optional)
    ↓
11. Script prompts for:
    - Deposit confirmation (receipts, amount, account)
    - Deposit date (default: today)
    - Deposit memo (optional reference)
    ↓
12. Script creates QuickBooks deposit:
    - Builds LinkedTxn structure with TxnLineId
    - Links matched sales receipts
    - Sets deposit date and memo (PrivateNote)
    - Creates deposit via API
```

### API Endpoints Used

1. **Query Sales Receipts**
   ```
   GET /v3/company/{realmId}/query?query=SELECT * FROM SalesReceipt WHERE...
   ```

2. **Query Refund Receipts**
   ```
   GET /v3/company/{realmId}/query?query=SELECT * FROM RefundReceipt WHERE...
   ```

3. **Read Sales Receipt**
   ```
   GET /v3/company/{realmId}/salesreceipt/{id}
   ```

4. **Query Customers** (for caching)
   ```
   GET /v3/company/{realmId}/query?query=SELECT * FROM Customer MAXRESULTS 1000
   ```

5. **Read Customer**
   ```
   GET /v3/company/{realmId}/customer/{id}
   ```

6. **Query Bank Accounts** (for deposit account selection)
   ```
   GET /v3/company/{realmId}/query?query=SELECT * FROM Account WHERE AccountType = 'Bank'...
   ```

7. **Create Deposit**
   ```
   POST /v3/company/{realmId}/deposit
   ```

8. **Get Company Info** (for testing)
   ```
   GET /v3/company/{realmId}/companyinfo/{realmId}
   ```

### OAuth 2.0 Flow

```
1. User clicks "Authorize QuickBooks"
   ↓
2. Script generates authorization URL
   ↓
3. User redirected to Intuit login
   ↓
4. User signs in and approves access
   ↓
5. Intuit redirects back to script URL with code
   ↓
6. Script exchanges code for tokens (doGet callback)
   ↓
7. Tokens stored in Script Properties
   ↓
8. Future API calls use access token
   ↓
9. Token auto-refreshes when expired
```

---

## Menu Structure

```
QuickBooks
├── 🧪 Current: SANDBOX (or 🏭 PRODUCTION)
├── ─────────────
├── Setup
│   ├── 0. Show Deployment Info
│   ├── 0b. Set Redirect URI
│   ├── 1. Configure OAuth Credentials
│   ├── 2. Authorize QuickBooks
│   ├── 3. Test Connection
│   ├── 4. Select Deposit Account
│   ├── ─────────────
│   ├── Switch Environment
│   └── Clear Authorization
├── ─────────────
├── Match Deposits
├── Create Deposit in QB
├── ─────────────
├── Clear Match Data
├── Format Sheet
└── Debug (Optional Troubleshooting Tools)
    ├── Debug Sales Receipt
    ├── Debug List All Accounts
    ├── Test Simple Deposit
    └── Test Linked Deposit
```

---

## Installation Steps

### Quick Version
1. Copy all `.gs` files to Apps Script Editor
2. Copy `appsscript.json` content
3. Save and reload Google Sheet
4. Follow QuickBooks menu → Setup

### Detailed Version
See [QUICK_START.md](QUICK_START.md) or [README.md](README.md)

---

## Configuration

### Script Properties (Stored Automatically)

**Sandbox Credentials:**
- `QB_CLIENT_ID_SANDBOX`
- `QB_CLIENT_SECRET_SANDBOX`

**Production Credentials:**
- `QB_CLIENT_ID_PRODUCTION`
- `QB_CLIENT_SECRET_PRODUCTION`

**OAuth Tokens (Auto-managed):**
- `QB_ACCESS_TOKEN`
- `QB_REFRESH_TOKEN`
- `QB_TOKEN_EXPIRY`
- `QB_REALM_ID`

**Environment:**
- `QB_ENVIRONMENT` (SANDBOX or PRODUCTION)

**Deposit Configuration:**
- `QB_DEPOSIT_ACCOUNT_ID` (Selected bank account ID)
- `QB_DEPOSIT_ACCOUNT_NAME` (Selected bank account name)
- `QB_REDIRECT_URI` (Manual redirect URI override)

---

## CSV Data Requirements

### Minimum Required Columns

- **Column H (index 7)**: Amount
  - Format: `"$189.10"`
  - Used for: Amount matching

- **Column K (index 10)**: Comment1
  - Format: `"Customer Name email@domain.com"`
  - Used for: Email extraction

### Example Row
```
1 | AW3A1B323FD4 | 1/16/2026 13:20 | Sale | AmEx | 1566 | 26-Jan | $189.10 | 0 | Approved | Robert Poole andy@phreshpicks.com | 965919
```

---

## Matching Algorithm Details

### Matching Criteria (Both Required)

1. **Email Match**
   - Extract email from CSV Comment1: `andy@phreshpicks.com`
   - Get customer email from QB sales receipt
   - Compare case-insensitive
   - Must match exactly

2. **Amount Match**
   - Parse CSV amount: `$189.10` → `189.10`
   - Get QB sales receipt TotalAmt: `189.10`
   - Compare with tolerance: `|amount1 - amount2| <= 0.01`
   - Must be within $0.01

### Result Categories

- **Matched**: Both criteria met → GREEN
- **CSV Only**: No matching QB receipt → YELLOW
- **QB Only**: QB receipt with no CSV match → (not displayed in sheet)

---

## Security Features

1. **Secure Token Storage**: Script Properties (encrypted by Google)
2. **Token Auto-Refresh**: Access tokens refresh automatically
3. **OAuth 2.0**: Industry-standard authentication
4. **No Hardcoded Credentials**: User provides their own QB app credentials
5. **Read-Only Access**: Only reads sales receipts and customers (plus creates deposits)
6. **Environment Isolation**: Sandbox and Production completely separate

---

## Performance Characteristics

### API Calls (for 100 deposits)
- **Without caching**: ~200 calls (~100 seconds)
- **With caching**: ~101 calls (~50 seconds)
- **Optimization**: 50% reduction in API calls

### Limits
- **QuickBooks API**: 500 requests/minute/company
- **Apps Script**: 6-minute execution timeout
- **Query limit**: 1000 records per query

### Typical Performance
- 50 deposits: ~30 seconds
- 100 deposits: ~50 seconds
- 200 deposits: ~100 seconds (may need to split)

---

## Error Handling

### OAuth Errors
- Invalid credentials → Clear error message
- Token expired → Auto-refresh
- Refresh token expired → Prompt to re-authorize

### API Errors
- Rate limiting → Error message with wait time
- Invalid query → Logged, user notified
- Network errors → Retry logic (built into UrlFetchApp)

### Data Errors
- No email in CSV → Row skipped, logged
- Invalid amount → Row skipped, logged
- No customer email in QB → Receipt skipped, logged

---

## Future Enhancements (Optional)

### Potential Features
1. **Configurable account**: Allow user to select deposit account
2. **Date range picker**: UI for selecting date range
3. **Batch processing**: Handle >1000 deposits
4. **Scheduled matching**: Auto-run daily/weekly
5. **Email notifications**: Send summary after matching
6. **Export report**: Generate PDF/Excel report
7. **Undo deposit**: Ability to delete created deposit
8. **Multi-currency**: Support for different currencies

### Code Improvements
1. **Unit tests**: Add automated testing
2. **Type checking**: Add JSDoc type annotations
3. **Error recovery**: More robust error handling
4. **Logging**: Enhanced logging with levels
5. **Performance**: Further optimize large datasets

---

## Deployment Environments

### Sandbox (🧪)
- **Purpose**: Testing and development
- **Data**: Fake/test data
- **Risk**: None (isolated)
- **Use when**: Developing, testing, learning

### Production (🏭)
- **Purpose**: Real business operations
- **Data**: Real QuickBooks data
- **Risk**: Creates real deposits
- **Use when**: After thorough sandbox testing

---

## Technical Notes

### Deposit Creation Structure

The QuickBooks deposit creation required specific structure discovered through testing:

**Working Structure (Linked Deposits):**
```javascript
{
  DepositToAccountRef: {
    name: "Checking",  // Account name
    value: "35"        // Account ID (must be Bank type)
  },
  TxnDate: "2026-02-03",
  Line: [
    {
      Amount: 189.10,
      LinkedTxn: [
        {
          TxnId: "150",           // Sales receipt ID
          TxnType: "SalesReceipt",
          TxnLineId: "0"          // REQUIRED - usually "0" for sales receipts
        }
      ]
      // NO DepositLineDetail or AccountRef for linked transactions
    }
  ],
  PrivateNote: "Optional memo"  // Deposit memo/reference
}
```

**Key Learnings:**
- For linked deposits, **do not include** `DepositLineDetail` or `AccountRef` in the Line items
- `LinkedTxn.TxnLineId` is **required** (use "0" for sales receipts)
- `DepositToAccountRef` must be a **Bank type** account, not Other Current Asset
- Return direct object, **not wrapped** in `{ Deposit: ... }`
- Both `name` and `value` required in `DepositToAccountRef`

### OAuth Redirect URI Configuration

- Auto-detection via `ScriptApp.getService().getUrl()` can be unreliable
- Manual configuration added: Store redirect URI in Script Properties
- User must copy exact Web app URL from **Deploy → Manage deployments**
- URL must match exactly between QuickBooks app and Apps Script
- Browser caching can cause issues - use incognito or hard refresh

### Debug Tools

Several debug and test functions were created during development:
- **debugSalesReceipt()**: Inspects sales receipt structure from QuickBooks
- **debugListAllAccounts()**: Lists all accounts with types and details
- **testSimpleDeposit()**: Tests basic deposit creation without linking
- **testLinkedDeposit()**: Tests deposit creation with LinkedTxn

These tools remain in the codebase for troubleshooting production issues.

---

## Support & Resources

### Documentation
- [QUICK_START.md](QUICK_START.md) - 10-minute setup
- [README.md](README.md) - Complete documentation
- [SETUP_OAUTH.md](SETUP_OAUTH.md) - OAuth setup guide
- [SAMPLE_DATA.md](SAMPLE_DATA.md) - Test data examples

### External Resources
- QuickBooks API Docs: https://developer.intuit.com/app/developer/qbo/docs
- OAuth 2.0 Guide: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- Apps Script Docs: https://developers.google.com/apps-script

---

## License

This project is provided as-is for internal business use.

---

## Version History

### v1.2 (Phase 4 Production Preparation - 2026-02-04)
- Published app to Production environment
- Fixed environment detection bug in Config.gs (getBaseUrl, getEnvironmentName now read from stored properties)
- Successfully connected to Production QuickBooks (Realm ID: 9130355485784946)
- Ready for production data testing (read-only)

### v1.1 (Phase 3 Sandbox Validation Complete - 2026-02-04)
- **Added RefundReceipt support** (query, match, create deposits)
- Added "QB Transaction Type" column (SalesReceipt or RefundReceipt)
- Fixed CSV parser to accept negative amounts (removed `amount <= 0` check)
- Updated amountsMatch() to handle positive/negative comparisons
- Added extensive logging for debugging matches
- Tested deposits with mixed sales receipts and refund receipts
- All edge cases validated (no match, amount mismatch, email mismatch, special characters)
- Error handling validated (missing data, expired tokens)
- End-to-end workflow confirmed working

### v1.0 (Initial Release - 2026-02-02 to 2026-02-03)
- OAuth 2.0 integration (Sandbox + Production)
- CSV deposit matching with sales receipts
- QuickBooks sales receipt queries
- Customer data caching
- Visual color coding (GREEN/YELLOW/RED)
- Deposit creation with LinkedTxn
- Deposit account selection (Bank type accounts)
- Custom deposit date selection
- Deposit memo/reference field (PrivateNote)
- Manual redirect URI configuration
- Debug tools (sales receipts, accounts, deposit tests)
- Complete documentation

---

**Total Project Size:**
- Code: ~1,400 lines (6 .gs files)
- Documentation: ~2,000 lines (5 .md files)
- Configuration: 2 files

**Estimated Setup Time:**
- First time: 10-15 minutes
- Subsequent runs: 1-2 minutes

**Recommended Workflow:**
1. Start with Sandbox
2. Test with 2-3 records
3. Expand to full dataset
4. Switch to Production
5. Test with limited date range
6. Deploy for regular use

---

*Project created: 2026-02-02*
*Platform: Google Apps Script + QuickBooks Online API*
*Environment: Sandbox/Production toggle*
