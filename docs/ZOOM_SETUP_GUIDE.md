# Zoom OAuth App Setup Guide

This guide walks you through setting up a new Zoom OAuth app for the Rosie Scheduler.

## Step 1: Create a Zoom App

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** → **Build App**
3. Choose **OAuth** as the app type
4. Click **Create**

## Step 2: App Information

Fill in the basic info:

| Field | Value |
|-------|-------|
| App Name | `Rosie Scheduler` (or your preferred name) |
| App Type | **User-managed** (individual users authorize) |
| Developer Contact Email | Your email |

## Step 3: OAuth Configuration

### Redirect URLs

Add these OAuth Redirect URLs:

```
https://rosielessons.com/api/auth/zoom/callback
```

For local development (optional):
```
http://localhost:3000/api/auth/zoom/callback
```

### Settings
- **Strict Mode for Redirect URLs**: Leave OFF for easier testing
- **Subdomain Check**: Leave OFF

## Step 4: Scopes (Permissions)

Add these scopes to your app:

### Required Scopes

| Scope | Why Needed |
|-------|------------|
| `meeting:write:meeting` | Create Zoom meetings for lessons |
| `meeting:read:meeting` | Read meeting details |
| `meeting:delete:meeting` | Delete/cancel meetings |
| `user:read:user` | Get user info for the meeting host |

### How to Add Scopes
1. Go to **Scopes** tab
2. Click **+ Add Scopes**
3. Search for each scope above
4. Select and add them

## Step 5: Get Your Credentials

1. Go to **App Credentials** section
2. Copy the **Client ID**
3. Copy the **Client Secret**

## Step 6: Add to Vercel Environment Variables

In your Vercel project dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `ZOOM_CLIENT_ID` | Your Client ID from Step 5 |
| `ZOOM_CLIENT_SECRET` | Your Client Secret from Step 5 |
| `NEXT_PUBLIC_BASE_URL` | `https://rosielessons.com` |

## Step 7: Activate for Beta Testing

1. Go to **Activation** tab (or **Beta Test** tab)
2. Click **Add app** to authorize it for your own Zoom account
3. Complete the OAuth flow

## Step 8: Test the Integration

1. Go to your admin dashboard: `https://rosielessons.com/admin`
2. Look for the Zoom connection section
3. Click **Connect Zoom**
4. Authorize the app
5. You should see "Zoom Connected" ✅

## Step 9: Adding Other Users (Beta)

To let others use the Zoom integration:

1. Go to **Beta Test** tab in Zoom Marketplace
2. Under "Share this app" → Add their email
3. They'll receive an invite to authorize

---

## Troubleshooting

### "Invalid redirect" error
- Make sure the redirect URL in Zoom exactly matches: `https://rosielessons.com/api/auth/zoom/callback`
- No trailing slash
- Check it's in the OAuth Redirect URL field, not just Allow List

### "App not activated" error
- Go to Activation/Beta Test tab and click "Add app"

### Tokens not saving
- Check that `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET` are set in Vercel
- Redeploy after adding env vars

### Meetings not being created
- Check Vercel logs for errors
- Verify the scopes include `meeting:write:meeting`

---

## Environment Variables Summary

```bash
# Required for Zoom integration
ZOOM_CLIENT_ID=your_client_id_here
ZOOM_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_BASE_URL=https://rosielessons.com
```

---

## Quick Reference: OAuth Flow

```
1. User clicks "Connect Zoom" on admin page
2. Redirects to: /api/auth/zoom
3. Redirects to: zoom.us/oauth/authorize?redirect_uri=...
4. User authorizes on Zoom
5. Zoom redirects to: /api/auth/zoom/callback?code=XXXXX
6. Our callback exchanges code for tokens
7. Tokens saved to zoom_tokens table
8. User redirected back to /admin with success message
```
