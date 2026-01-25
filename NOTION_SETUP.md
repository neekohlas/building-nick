# Notion Integration Setup for Building Nick

This guide walks you through setting up Notion integration to manage your activities from a Notion database.

## Overview

The Notion integration allows you to:
- Define and edit activities in a Notion database
- Add videos, links, and detailed instructions
- Activities sync to the app when you refresh

## Step 1: Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Fill in the details:
   - **Name**: Building Nick
   - **Associated workspace**: Select your workspace
   - **Capabilities**: Select **Read content** (only this is needed)
4. Click **Submit**
5. Copy the **Internal Integration Secret** (starts with `secret_...`)
   - Save this - you'll need it for Vercel

## Step 2: Create the Activities Database

Create a new database in Notion with these exact property names:

| Property Name | Type | Description |
|--------------|------|-------------|
| Name | Title | Activity name (required) |
| ID | Text | Unique identifier (e.g., `breathing`, `biking`) |
| Description | Text | Short description of the activity |
| Category | Select | One of: `mind_body`, `physical`, `mindfulness`, `professional` |
| Duration | Number | Duration in minutes |
| Instructions | Text | HTML-formatted instructions |
| Link | URL | External link (optional) |
| Video | URL | YouTube or Vimeo URL (optional) |
| Quick | Checkbox | Is this a quick (under 5 min) activity? |
| Weather Dependent | Checkbox | Does this require good weather? |
| Outdoor | Checkbox | Is this an outdoor activity? |
| Weekday Only | Checkbox | Only show on weekdays? |
| Pairs With | Text | ID of paired activity (optional) |
| Frequency | Select | Options: `daily`, `every_2_3_days`, `weekly` |

### Example Entry

| Property | Value |
|----------|-------|
| Name | Breathing Exercises |
| ID | breathing |
| Description | Focused breathing for calm and presence |
| Category | mind_body |
| Duration | 3 |
| Instructions | `<ol><li>Find a comfortable position</li><li>Breathe in for 4 counts</li><li>Hold for 4 counts</li><li>Exhale for 6-8 counts</li></ol>` |
| Quick | ✓ |

## Step 3: Share Database with Integration

1. Open your Activities database in Notion
2. Click **...** (menu) in the top right
3. Click **+ Add connections**
4. Find and select **Building Nick** (your integration)
5. Click **Confirm**

## Step 4: Get the Database ID

1. Open your database in Notion as a full page
2. Look at the URL: `https://notion.so/yourworkspace/DATABASE_ID?v=...`
3. Copy the 32-character ID (the part before the `?`)
   - Example: `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`

## Step 5: Deploy to Vercel

### Option A: Deploy from GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click **Import Project**
4. Select your GitHub repository
5. Add Environment Variables:
   - `NOTION_API_KEY`: Your integration secret
   - `NOTION_DATABASE_ID`: Your database ID
6. Click **Deploy**

### Option B: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project directory)
vercel

# Set environment variables
vercel env add NOTION_API_KEY
vercel env add NOTION_DATABASE_ID

# Redeploy
vercel --prod
```

## Step 6: Update Your App URL

After deploying to Vercel, your app will be available at a URL like:
`https://your-project.vercel.app`

Update your bookmarks/home screen to use this new URL instead of GitHub Pages.

## Troubleshooting

### API returns 500 error
- Check that environment variables are set correctly in Vercel
- Verify the database is shared with your integration

### Activities not loading
- Check browser console for errors
- Verify database property names match exactly (case-sensitive)
- Ensure at least one activity has a Name value

### Changes not appearing
- The API caches for 5 minutes
- Try a hard refresh (Cmd+Shift+R on Mac)

## Testing the API

You can test the API directly:
```
https://your-project.vercel.app/api/notion-activities
```

This should return JSON with your activities.

## Notes

- The app falls back to local activity definitions if Notion is unavailable
- Activities from Notion merge with (and override) local definitions
- You can keep local definitions as a backup for offline use
