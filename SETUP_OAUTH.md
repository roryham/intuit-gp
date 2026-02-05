# QuickBooks OAuth Setup Guide

This guide walks you through setting up OAuth authentication for the QuickBooks Deposit Matching application.

## Overview

The application uses OAuth 2.0 to securely access your QuickBooks Online data. You'll need to:

1. Create a QuickBooks app (Sandbox and/or Production)
2. Configure the redirect URI
3. Get your Client ID and Client Secret
4. Enter credentials in the Google Apps Script
5. Authorize the application

## Prerequisites

- A QuickBooks Online account
- Access to the [Intuit Developer Portal](https://developer.intuit.com/)
- The Google Apps Script installed in your Google Sheet

## Step 1: Create a QuickBooks App

### For Sandbox Development (Testing)

1. **Go to Intuit Developer Portal**
   - Visit: https://developer.intuit.com/
   - Sign in with your Intuit account

2. **Create a New App**
   - Click **"My Apps"** in the top navigation
   - Click **"Create an app"**
   - Select **"QuickBooks Online and Payments"**
   - Click **"Select scopes"**

3. **Configure Scopes**
   - Under **"QuickBooks Online"**, select:
     - ✓ Accounting
   - Click **"Create app"**

4. **Name Your App**
   - Enter a name (e.g., "Deposit Matcher - Sandbox")
   - Click **"Create app"**

5. **Your App is Created!**
   - You'll see the app dashboard
   - Note: The app is automatically in Sandbox mode

### For Production (Real Data)

You'll create a separate app or publish the sandbox app to production after testing.

## Step 2: Get Your Script URL (Redirect URI)

1. **Open Your Google Sheet**
   - The sheet with the Apps Script installed

2. **Get the Script URL**
   - Method 1: Through the menu
     - Go to **QuickBooks → Setup → 2. Authorize QuickBooks**
     - The Script URL will be shown in the dialog
     - Copy it (it looks like: `https://script.google.com/macros/s/...../exec`)

   - Method 2: Through Apps Script Editor
     - Go to **Extensions → Apps Script**
     - Click **Deploy → Test deployments**
     - Copy the Web App URL

3. **Save This URL**
   - You'll need this in the next step
   - Example: `https://script.google.com/macros/s/AKfycby.../exec`

## Step 3: Configure Redirect URI in QuickBooks App

1. **Go to Your App Settings**
   - Visit: https://developer.intuit.com/
   - Click **"My Apps"**
   - Select your app

2. **Add Redirect URI**
   - Scroll to **"Keys & OAuth"** section
   - Under **"Redirect URIs"**, click **"Add URI"**
   - Paste your Script URL from Step 2
   - Click **"Save"**

   **Important Notes:**
   - The URL must match EXACTLY (including https://)
   - Don't add a trailing slash
   - Each environment (Sandbox/Production) needs the same Redirect URI

3. **Save the App Settings**
   - Click **"Save"** at the bottom of the page

## Step 4: Get Client ID and Client Secret

1. **Navigate to Keys & OAuth**
   - In your app dashboard, find **"Keys & OAuth"** section

2. **For Sandbox:**
   - Find **"Sandbox"** keys
   - Copy **"Client ID"** (starts with `AB...`)
   - Click **"Show"** next to Client Secret
   - Copy **"Client Secret"** (long alphanumeric string)
   - **Keep these secure!**

3. **For Production (when ready):**
   - First publish your app to production
   - Find **"Production"** keys
   - Copy Client ID and Client Secret
   - **These are different from Sandbox keys!**

## Step 5: Configure OAuth in Google Apps Script

1. **Open Your Google Sheet**
   - Reload the page if needed to see the QuickBooks menu

2. **Configure Credentials**
   - Go to **QuickBooks → Setup → 1. Configure OAuth Credentials**
   - When prompted, enter:
     - **Client ID**: Paste from Step 4
     - **Client Secret**: Paste from Step 4

3. **Credentials Saved**
   - The credentials are stored securely in Script Properties
   - You only need to do this once per environment

## Step 6: Authorize the Application

1. **Start Authorization Flow**
   - Go to **QuickBooks → Setup → 2. Authorize QuickBooks**

2. **Verify Redirect URI**
   - A dialog will appear showing the Script URL
   - Verify this matches the URI you added to your QB app
   - If not, go back to Step 3 and add it

3. **Click Authorization Link**
   - Click **OK** in the dialog
   - Click the **"Authorize QuickBooks Access"** button
   - A new window will open

4. **Sign in to QuickBooks**
   - For **Sandbox**: Sign in with your Intuit Developer credentials
   - For **Production**: Sign in with your business QuickBooks account

5. **Select Company**
   - If you have multiple companies, select the one you want to connect
   - For Sandbox, you may need to create a test company first

6. **Approve Access**
   - Review the permissions requested (Accounting access)
   - Click **"Connect"** or **"Authorize"**

7. **Authorization Complete**
   - You'll be redirected back to a success page
   - Look for the green checkmark: **"Authorization Successful!"**
   - Note the Realm ID shown (this is your QuickBooks Company ID)
   - Close the window

8. **Test the Connection**
   - Back in your Google Sheet, go to **QuickBooks → Setup → 3. Test Connection**
   - You should see a success message with your company name

## Step 7: Switch to Production (When Ready)

After testing in Sandbox:

1. **Publish Your App to Production**
   - In Intuit Developer Portal, go to your app
   - Click **"Publish to Production"** (if available)
   - Or create a new Production app

2. **Get Production Credentials**
   - Copy Production Client ID and Client Secret
   - They are different from Sandbox!

3. **Switch Environment in Script**
   - In Google Sheet: **QuickBooks → Setup → Switch Environment**
   - Select **Production**
   - This will clear your Sandbox tokens

4. **Re-configure for Production**
   - Run **QuickBooks → Setup → 1. Configure OAuth Credentials**
   - Enter **Production** Client ID and Secret

5. **Re-authorize for Production**
   - Run **QuickBooks → Setup → 2. Authorize QuickBooks**
   - Sign in with your **real** QuickBooks account
   - Authorize access

## Troubleshooting

### "Invalid Redirect URI" Error

**Problem**: QuickBooks rejects the authorization because the redirect URI doesn't match.

**Solution**:
1. Check that the Redirect URI in your QB app settings matches EXACTLY
2. Copy the Script URL again (it may have changed if you redeployed)
3. Update the Redirect URI in QuickBooks app settings
4. Try authorizing again

### "Invalid Client" Error

**Problem**: Client ID or Client Secret is incorrect.

**Solution**:
1. Go to QuickBooks Developer Portal → My Apps → Your App → Keys & OAuth
2. Verify you're looking at the correct environment (Sandbox vs Production)
3. Copy the Client ID and Secret again
4. Run **QuickBooks → Setup → Configure OAuth Credentials** again
5. Enter the correct credentials

### Can't Find Script URL

**Solution**:
1. Go to **Extensions → Apps Script**
2. Click **Deploy → Test deployments**
3. If no deployment exists:
   - Click **Deploy → New deployment**
   - Click gear icon → Select **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
   - Copy the Web App URL

### Authorization Window Closes Immediately

**Problem**: Pop-up blockers may be blocking the authorization window.

**Solution**:
1. Allow pop-ups for Google Sheets
2. Try the authorization flow again
3. Or manually open the authorization URL in a new tab

### "Failed to Exchange Code for Tokens"

**Problem**: The OAuth callback failed.

**Solution**:
1. Check Script Properties have the correct credentials
2. Verify the Redirect URI matches exactly
3. Try clearing authorization: **QuickBooks → Setup → Clear Authorization**
4. Start fresh with authorization

### Token Expired After 100 Days

**Problem**: Refresh token expires after 100 days of inactivity.

**Solution**:
1. Run **QuickBooks → Setup → Clear Authorization**
2. Run **QuickBooks → Setup → 2. Authorize QuickBooks** again
3. Re-authorize the app

### Sandbox vs Production Confusion

**Remember**:
- **Sandbox**: For testing, uses fake data, separate credentials
- **Production**: For real use, uses real data, separate credentials
- They are completely separate environments
- You need different Client ID/Secret for each
- Current environment shown in menu: 🧪 Sandbox or 🏭 Production

## Security Best Practices

1. **Never Share Your Client Secret**
   - It's like a password for your app
   - Don't commit it to version control
   - Don't share it in emails or chat

2. **Use Sandbox First**
   - Always test in Sandbox before Production
   - Sandbox data is isolated from your real books

3. **Review Permissions**
   - The app requests "Accounting" scope
   - This allows reading sales receipts and creating deposits
   - It cannot modify or delete existing data (except creating deposits)

4. **Refresh Tokens**
   - Tokens are stored in Script Properties (encrypted by Google)
   - They auto-refresh when expired
   - Re-authorize every 100 days if inactive

## Additional Resources

- **QuickBooks API Documentation**: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/salesreceipt
- **OAuth 2.0 Overview**: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- **Intuit Developer Portal**: https://developer.intuit.com/
- **QuickBooks Sandbox**: https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes

## Quick Reference

### Sandbox Setup Checklist
- [ ] Create QuickBooks app on developer.intuit.com
- [ ] Get Script URL from Google Apps Script
- [ ] Add Redirect URI to QuickBooks app
- [ ] Copy Sandbox Client ID and Secret
- [ ] Run "Configure OAuth Credentials" in sheet
- [ ] Run "Authorize QuickBooks" in sheet
- [ ] Test connection
- [ ] Run matching with test data

### Production Setup Checklist
- [ ] Publish app to Production (or create new Production app)
- [ ] Verify Redirect URI in Production app
- [ ] Copy Production Client ID and Secret
- [ ] Switch to Production environment in sheet
- [ ] Run "Configure OAuth Credentials" with Production keys
- [ ] Run "Authorize QuickBooks" with real QB account
- [ ] Test connection with real company
- [ ] Run matching with limited real data first
- [ ] Verify results before full deployment
