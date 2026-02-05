# Quick Start Guide

Get up and running in 10 minutes!

## 1. Install the Code (5 minutes)

1. **Create or open a Google Sheet** with your transaction data

2. **Open Apps Script Editor**
   - In your sheet, go to **Extensions → Apps Script**

3. **Copy the code files**
   - Delete existing `Code.gs` content
   - Create these files and paste the code:
     - `Code.gs`
     - `Config.gs`
     - `QuickBooksAPI.gs`
     - `MatchingLogic.gs`
     - `SheetsUI.gs`
     - `Utils.gs`
   - Replace `appsscript.json` content

4. **Save and close**
   - Click the save icon
   - Close the Apps Script editor
   - Reload your Google Sheet

5. **Verify installation**
   - Look for "QuickBooks" menu in the menu bar
   - If you see it, installation successful! ✓

## 2. Set Up QuickBooks App (3 minutes)

1. **Go to Intuit Developer**
   - Visit: https://developer.intuit.com/
   - Sign in

2. **Create an app**
   - Click **My Apps → Create an app**
   - Select **QuickBooks Online and Payments**
   - Select scope: **Accounting**
   - Name it: "Deposit Matcher - Sandbox"

3. **Get your Script URL**
   - In Google Sheet: **QuickBooks → Setup → 2. Authorize QuickBooks**
   - Copy the Script URL shown (starts with `https://script.google.com/...`)
   - Click Cancel for now

4. **Add Redirect URI**
   - Back in Intuit Developer, go to your app
   - Under **Keys & OAuth**, click **Add URI**
   - Paste your Script URL
   - Click **Save**

5. **Copy credentials**
   - In the same page, find **Sandbox** keys
   - Copy **Client ID**
   - Click **Show** and copy **Client Secret**
   - Keep these handy!

## 3. Connect to QuickBooks (2 minutes)

1. **Configure credentials**
   - In Google Sheet: **QuickBooks → Setup → 1. Configure OAuth Credentials**
   - Paste your Client ID
   - Paste your Client Secret

2. **Authorize**
   - Go to **QuickBooks → Setup → 2. Authorize QuickBooks**
   - Click OK, then click the green **Authorize QuickBooks Access** button
   - Sign in to QuickBooks (use your Intuit Developer account for Sandbox)
   - Select your test company (or create one)
   - Click **Connect**
   - Look for "Authorization Successful!" ✓

3. **Test connection**
   - Go to **QuickBooks → Setup → 3. Test Connection**
   - Should show your company name ✓

4. **Select deposit account**
   - Go to **QuickBooks → Setup → 4. Select Deposit Account**
   - Choose the bank account for deposits
   - Required before creating deposits ✓

## 4. Run Your First Match! (1 minute)

1. **Prepare your data**
   - Make sure your sheet has:
     - Column H: Amount (e.g., "$189.10")
     - Column K: Comment1 (e.g., "Robert Poole andy@phreshpicks.com")

2. **Run matching**
   - Go to **QuickBooks → Match Deposits**
   - Wait for processing...
   - See results color-coded in your sheet!

3. **Review results**
   - **GREEN rows**: Matched! ✓
   - **YELLOW rows**: In CSV only (no QB match)
   - Check new columns for QB data

4. **Create deposit (optional)**
   - Go to **QuickBooks → Create Deposit in QB**
   - Review summary (receipts, total amount, deposit account)
   - Confirm creation
   - Enter deposit date (or press OK for today's date)
   - Enter optional memo/reference
   - Deposit created in QuickBooks! ✓

## 🎉 Done!

You're now matching deposits with QuickBooks!

## Next Steps

- **Review matches**: Check that emails and amounts match correctly
- **Investigate unmatched**: Look at yellow rows to see why they didn't match
- **Switch to Production**: When ready, see README.md for production setup

## Troubleshooting

### Can't see QuickBooks menu
- Reload your Google Sheet
- Check that all files were copied correctly
- Look for errors in **Extensions → Apps Script → Executions**

### "OAuth credentials not found"
- Make sure you ran **Setup → 1. Configure OAuth Credentials**
- Verify you're in SANDBOX mode (check menu: 🧪 Sandbox)
- Try entering credentials again

### "Not authorized"
- Run **Setup → 2. Authorize QuickBooks** again
- Make sure Redirect URI is added to QuickBooks app
- Check that you signed in to the correct QuickBooks account

### Redirect URI / Web app not working
- Go to **Extensions → Apps Script → Deploy → Manage deployments**
- Copy the Web app URL exactly
- Use **QuickBooks → Setup → 0b. Set Redirect URI** to configure it
- Add the same URL to QuickBooks app under **Keys & OAuth → Redirect URIs**
- Try opening the authorization link in incognito mode
- In main browser, do hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### "No deposit account configured"
- Run **Setup → 4. Select Deposit Account**
- Choose a Bank type account from the list

### No matches found
- Verify emails in Column K match customer emails in QuickBooks
- Check that amounts in Column H match QB sales receipt amounts
- Make sure sales receipts exist in QuickBooks for this date range

## Need More Help?

- **Detailed setup**: See [SETUP_OAUTH.md](SETUP_OAUTH.md)
- **Full documentation**: See [README.md](README.md)
- **QuickBooks API**: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/salesreceipt

## Environment Notes

- **Sandbox (🧪)**: Testing with fake data - **START HERE**
- **Production (🏭)**: Real QuickBooks data - use after testing

Current environment shown in QuickBooks menu.

---

**Pro Tip**: Always test in Sandbox first! Create test sales receipts in your QuickBooks Sandbox to practice matching before using real data.
