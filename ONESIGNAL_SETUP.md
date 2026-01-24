# OneSignal Setup Guide for Building Nick

This guide walks you through setting up OneSignal for push notifications. You can use Claude's Chrome extension to help with these steps.

## Prerequisites

- The PWA must be deployed to a public URL (GitHub Pages, Vercel, or Netlify)
- HTTPS is required for push notifications

## Step 1: Create OneSignal Account

1. Go to https://onesignal.com
2. Click "Sign Up" and create a free account
3. Verify your email address

## Step 2: Create a New App

1. After logging in, click "New App/Website"
2. Enter app name: **Building Nick**
3. Select platform: **Web**
4. Click "Next: Configure Your Platform"

## Step 3: Configure Web Push

### Site Setup
- **Site Name:** Building Nick
- **Site URL:** Your deployed URL (e.g., `https://yourusername.github.io/building-nick`)
- **Auto Resubscribe:** Enabled
- **Default Icon URL:** `/icons/icon-192.png` (or your full URL to the icon)

### Permission Prompt Setup
Choose "Push Slide Prompt" and configure:
- **Action Message:** "We'd like to send you notifications for your daily habits"
- **Accept Button:** "Allow"
- **Cancel Button:** "Maybe Later"

Click "Save"

## Step 4: Get Your App ID

1. After saving, you'll see your OneSignal App ID
2. It looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
3. Copy this ID

## Step 5: Configure the App

1. Open `js/notifications.js` in your project
2. Find this line near the top:
   ```javascript
   const ONESIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID';
   ```
3. Replace `YOUR_ONESIGNAL_APP_ID` with your actual App ID

## Step 6: Safari (iOS) Configuration (Optional)

For iOS Safari push notifications:

1. In OneSignal dashboard, go to Settings > Platforms > Apple Safari
2. You'll need an Apple Developer account ($99/year)
3. Follow OneSignal's guide to create a Safari Push ID
4. Upload the required certificates

**Note:** iOS push notifications via PWA have limited support. The app will work without this step, but iOS users won't receive push notifications.

## Step 7: Test Notifications

1. Deploy your updated code
2. Install the PWA to your home screen
3. Open the app and allow notifications when prompted
4. Test with: Open browser console and run `BuildingNick.testNotification()`

## Scheduled Notifications

The app is configured to send notifications at these times:
- **7:45 AM** - Morning motivation and daily plan reminder
- **8:30 PM** - Evening preview of tomorrow's plan
- **4:00 PM on Sundays** - Weekly planning reminder

For server-side scheduled notifications, you'll need to:
1. Set up OneSignal's Automated Messages
2. Or use a serverless function (Vercel, Netlify) to trigger notifications via OneSignal API

## Troubleshooting

### Notifications not appearing?
1. Check browser notification settings
2. Ensure HTTPS is enabled
3. Verify App ID is correct
4. Check browser console for errors

### Not working on iOS?
- iOS PWA notifications require additional Safari Push setup
- Consider this a Phase 2 feature

### Permission denied?
- User may have blocked notifications
- They need to reset in browser settings

## OneSignal Dashboard Features

Useful features to explore:
- **Segments:** Create user segments for targeted notifications
- **A/B Testing:** Test different notification messages
- **Analytics:** Track notification delivery and opens
- **Templates:** Create reusable notification templates

## API Reference

For advanced usage, see:
- OneSignal Web SDK: https://documentation.onesignal.com/docs/web-sdk-reference
- REST API: https://documentation.onesignal.com/reference/create-notification
