# Sample CSV Data

This document shows example CSV data format for testing the matching application.

## CSV Format

Your Google Sheet should have these columns (at minimum):

| # | Transaction Id | Time | Type | Tender Type | Account Number | Expires | Amount | Result Code | Response Msg | Comment1 | Comment2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | AW3A1B323FD4 | 1/16/2026 13:20 | Sale | American Express | 1566 | 26-Jan | $189.10 | 0 | Approved | Robert Poole andy@phreshpicks.com | 965919 |
| 2 | AD3A1B358673 | 1/16/2026 15:10 | Sale | American Express | 1028 | 31-Jan | $823.50 | 0 | Approved | Dean Chamberlain dean@shopthecanyon.com | 965922 |
| 3 | AK3A1B445821 | 1/17/2026 09:30 | Sale | Visa | 4532 | 28-Feb | $156.75 | 0 | Approved | Sarah Johnson sarah@example.com | 965923 |
| 4 | AL3A1B567234 | 1/17/2026 11:45 | Sale | Mastercard | 5421 | 30-Mar | $492.00 | 0 | Approved | Mike Davis mike@testcompany.com | 965924 |

## Key Columns for Matching

### Column H (8): Amount
- **Format**: Dollar sign + amount (e.g., "$189.10")
- **Required**: Yes
- **Notes**: Will be parsed to remove "$" and "," for comparison

### Column K (11): Comment1
- **Format**: "Customer Name email@domain.com"
- **Required**: Yes
- **Email extraction**: App extracts email using regex pattern
- **Examples**:
  - ✓ "Robert Poole andy@phreshpicks.com" → Extracts: `andy@phreshpicks.com`
  - ✓ "Dean Chamberlain dean@shopthecanyon.com" → Extracts: `dean@shopthecanyon.com`
  - ✗ "Robert Poole" → No email found (will skip)
  - ✗ "robert.poole" → Invalid email format (will skip)

## Creating Test Data in QuickBooks Sandbox

To test matching, create sales receipts in QuickBooks Sandbox that match your CSV:

### Example 1: Match for Row 1

**In QuickBooks Sandbox:**
1. Create/find customer: "Robert Poole" or "Andy"
2. Set customer email: `andy@phreshpicks.com`
3. Create Sales Receipt:
   - Customer: Robert Poole (or Andy)
   - Date: Around 1/16/2026
   - Amount: **$189.10** (exact match)
   - Payment method: Any
   - Save the receipt

**Expected Result:**
- CSV row 1 will match this sales receipt
- Row will turn GREEN
- QB columns will populate

### Example 2: Match for Row 2

**In QuickBooks Sandbox:**
1. Create/find customer: "Dean Chamberlain"
2. Set customer email: `dean@shopthecanyon.com`
3. Create Sales Receipt:
   - Customer: Dean Chamberlain
   - Date: Around 1/16/2026
   - Amount: **$823.50** (exact match)
   - Save the receipt

**Expected Result:**
- CSV row 2 will match
- Row will turn GREEN

### Example 3: No Match (CSV Only)

**CSV Row:**
```
5 | AX3A1B789456 | 1/18/2026 14:20 | Sale | Visa | 4111 | 31-May | $299.99 | 0 | Approved | John Smith john@nowhere.com | 965925
```

**In QuickBooks:**
- Don't create a sales receipt for john@nowhere.com

**Expected Result:**
- CSV row will NOT match
- Row will turn YELLOW
- Status: "⚠ In CSV only"

### Example 4: No Match (QB Only)

**In QuickBooks Sandbox:**
1. Create customer: "Jane Doe"
2. Set customer email: `jane@example.com`
3. Create Sales Receipt:
   - Customer: Jane Doe
   - Amount: $500.00
   - Save the receipt

**CSV:**
- Don't add a row for jane@example.com

**Expected Result:**
- This sales receipt will NOT match
- It won't appear in the sheet (QB-only items not added by default)

## Matching Rules

### ✓ Will Match When:
1. **Email matches** (case-insensitive)
   - CSV: `andy@phreshpicks.com`
   - QB: `andy@phreshpicks.com` or `Andy@PhreshPicks.com`

2. **Amount matches** (within $0.01)
   - CSV: `$189.10`
   - QB: `189.10` or `189.09` or `189.11` (within tolerance)

### ✗ Will NOT Match When:
- Email differs:
  - CSV: `andy@phreshpicks.com`
  - QB: `robert@phreshpicks.com` ✗

- Amount differs (beyond $0.01):
  - CSV: `$189.10`
  - QB: `189.20` ✗ (difference > $0.01)

- Either field missing:
  - CSV has no email extracted ✗
  - QB customer has no email ✗

## Test Scenarios

### Scenario 1: Perfect Match
```
CSV: "Robert Poole andy@phreshpicks.com" | $189.10
QB:  Customer email: andy@phreshpicks.com | TotalAmt: 189.10
Result: ✓ MATCH (GREEN)
```

### Scenario 2: Email Mismatch
```
CSV: "Robert Poole andy@phreshpicks.com" | $189.10
QB:  Customer email: different@email.com | TotalAmt: 189.10
Result: ✗ NO MATCH (YELLOW)
```

### Scenario 3: Amount Mismatch
```
CSV: "Robert Poole andy@phreshpicks.com" | $189.10
QB:  Customer email: andy@phreshpicks.com | TotalAmt: 189.99
Result: ✗ NO MATCH (YELLOW - amount differs by $0.89)
```

### Scenario 4: Floating Point Precision
```
CSV: "Robert Poole andy@phreshpicks.com" | $189.10
QB:  Customer email: andy@phreshpicks.com | TotalAmt: 189.0999999
Result: ✓ MATCH (GREEN - within $0.01 tolerance)
```

### Scenario 5: Case Insensitive Email
```
CSV: "Robert Poole ANDY@PHRESHPICKS.COM" | $189.10
QB:  Customer email: andy@phreshpicks.com | TotalAmt: 189.10
Result: ✓ MATCH (GREEN - emails compared case-insensitive)
```

## Common Issues

### Issue: No email extracted from Comment1

**CSV Data:**
```
Comment1: "Robert Poole"  ✗ No email
```

**Solution:**
- Ensure Comment1 contains email: "Robert Poole andy@phreshpicks.com"

### Issue: Customer has no email in QuickBooks

**QuickBooks:**
- Customer: Robert Poole
- Email: (blank) ✗

**Solution:**
- Add email to customer in QuickBooks
- Go to Customers → Edit → Add PrimaryEmailAddr

### Issue: Amount formatting problem

**CSV Data:**
```
Amount: "189.10"  ✗ Missing $
Amount: 189.10    ✗ Not a string
```

**Expected:**
```
Amount: "$189.10" ✓
```

**Note:** The script can handle various formats, but "$189.10" is safest.

## Pro Tips

1. **Start Small**: Test with 2-3 rows first
2. **Verify Emails**: Check customer emails in QB before matching
3. **Check Amounts**: Ensure QB receipt amounts match exactly
4. **Date Range**: Script queries sales receipts from last 30 days by default
5. **Customer Cache**: Script caches all customers for performance

## After Running Match

Your sheet will look like this:

| # | ... | Amount | ... | Comment1 | QB Sales Receipt ID | QB Transaction Date | QB Total Amount | QB Customer Email | QB Customer Name | Match Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ... | $189.10 | ... | Robert Poole andy@phreshpicks.com | 101 | 2026-01-16 | $189.10 | andy@phreshpicks.com | Robert Poole | ✓ Matched |
| 2 | ... | $823.50 | ... | Dean Chamberlain dean@shopthecanyon.com | 102 | 2026-01-16 | $823.50 | dean@shopthecanyon.com | Dean Chamberlain | ✓ Matched |
| 3 | ... | $299.99 | ... | John Smith john@nowhere.com | | | | | | ⚠ In CSV only |

**Color Coding:**
- Row 1: GREEN background
- Row 2: GREEN background
- Row 3: YELLOW background

Happy testing! 🎉
