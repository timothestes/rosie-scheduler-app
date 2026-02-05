# Zoom Server-to-Server OAuth Setup Guide

This guide walks you through setting up Zoom integration using Server-to-Server OAuth (no user authorization needed).

## Step 1: Create a Zoom Server-to-Server App

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** → **Build App**
3. Choose **Server-to-Server OAuth** as the app type
4. Click **Create**
5. Give it a name like `Rosie Scheduler`

## Step 2: Get Your Credentials

In the app dashboard, you'll see:

| Credential | Description |
|------------|-------------|
| **Account ID** | Your Zoom account ID |
| **Client ID** | OAuth client identifier |
| **Client Secret** | OAuth client secret |

Copy all three values.

## Step 3: Add Scopes (Permissions)

1. Go to **Scopes** tab
2. Click **+ Add Scopes**
3. Add these scopes:

| Scope | Why Needed |
|-------|------------|
| `meeting:write:meeting` | Create Zoom meetings for lessons |
| `meeting:read:meeting` | Read meeting details |
| `meeting:delete:meeting` | Delete/cancel meetings |
| `user:read:user` | Get user info for the meeting host |

4. Click **Done** and **Save**

## Step 4: Activate the App

1. Go to **Activation** tab
2. Click **Activate your app**
3. The app should show as "Activated"

## Step 5: Add to Vercel Environment Variables

In your Vercel project dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `ZOOM_ACCOUNT_ID` | Your Account ID from Step 2 |
| `ZOOM_CLIENT_ID` | Your Client ID from Step 2 |
| `ZOOM_CLIENT_SECRET` | Your Client Secret from Step 2 |

**Redeploy** after adding the variables.

## Step 6: Test the Integration

1. Go to your admin dashboard: `https://rosielessons.com/admin`
2. You should see "Zoom Connected" ✅
3. Book a test Zoom lesson to verify meetings are created

---

## How It Works

With Server-to-Server OAuth:
- No user authorization flow needed
- Tokens are generated automatically using your credentials
- All meetings are created on YOUR Zoom account
- Students just get a join link - they don't need Zoom accounts

---

## Troubleshooting

### "Zoom not configured" in admin panel
- Verify all three env vars are set in Vercel
- Redeploy after adding env vars
- Check for typos in the values

### Meetings not being created
- Check Vercel logs for errors
- Verify the scopes include `meeting:write:meeting`
- Make sure the app is activated in Zoom Marketplace

### Token errors in logs
- Verify Account ID, Client ID, and Client Secret are correct
- Make sure the app is activated (not just created)

---

## Environment Variables Summary

```bash
# Required for Zoom Server-to-Server OAuth
ZOOM_ACCOUNT_ID=your_account_id_here
ZOOM_CLIENT_ID=your_client_id_here
ZOOM_CLIENT_SECRET=your_client_secret_here
```

---

## Quick Reference: How Tokens Work

```
1. Lesson is booked with Zoom location
2. Server calls Zoom API with account credentials
3. Zoom returns access token (cached for ~1 hour)
4. Server creates meeting using token
5. Join URL saved to lesson record
6. Student receives email with join link
```

No redirect URLs, no user clicks, fully automatic!
