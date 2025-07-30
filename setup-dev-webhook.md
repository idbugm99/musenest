# 🚨 DEVELOPMENT WEBHOOK SETUP (REMOVE BEFORE PRODUCTION)

This file explains how to set up ngrok for local development webhook testing.

## Quick Setup for Development Testing

### Option 1: Use ngrok (requires free account)

1. **Sign up for ngrok**: https://dashboard.ngrok.com/signup
2. **Get your authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Install authtoken**:
   ```bash
   ngrok authtoken YOUR_TOKEN_HERE
   ```
4. **Start ngrok tunnel**:
   ```bash
   ngrok http 3000
   ```
5. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)
6. **Set environment variable**:
   ```bash
   export NGROK_URL=https://abc123.ngrok.io
   ```
7. **Restart MuseNest server**:
   ```bash
   pkill -f "node.*server.js" && node server.js &
   ```

### Option 2: Test without webhooks (immediate mode)

Just test without setting NGROK_URL - webhooks will be disabled and you'll get immediate NudeNet results only.

## Current Behavior

- ✅ **With NGROK_URL set**: Full webhook workflow with BLIP descriptions
- ⚠️ **Without NGROK_URL**: NudeNet only, no BLIP webhooks

## 🚨 PRODUCTION DEPLOYMENT CHECKLIST

Before deploying to production, **REMOVE** these dev-only parts:

1. **Delete this file**: `setup-dev-webhook.md`
2. **Remove ngrok logic** from `ContentModerationService.js` (lines 23-35)
3. **Set production webhook URL** in environment variables
4. **Remove dev environment checks**

## Production Environment Variables

```bash
NODE_ENV=production
WEBHOOK_BASE_URL=https://musenest.com
```