# Reddit Comment Overkill

A browser userscript that automatically deletes all your Reddit comments. It's designed to be safe, reliable, and respect Reddit's rate limits while ensuring complete coverage of your comment history.

## ⚠️ Important Warnings

**Before using this script:**
- This will **permanently delete** your Reddit comments
- Comments from the last 10 days are preserved by default (configurable)
- Use at your own risk - always backup important comments
- The script includes safety features but cannot guarantee against account issues

## What This Script Does

This script helps you clean up your Reddit comment history by automatically finding and deleting your old comments. Here's how it works:

1. **Finds all your comments** - Searches through different sort views (new, hot, top, controversial) to ensure nothing is missed
2. **Deletes comments safely** - Each deletion requires confirmation, just like manual deletion
3. **Preserves recent comments** - Keeps comments from the last 10 days (you can change this)
4. **Handles rate limits** - Automatically detects when Reddit is limiting requests and waits appropriately
5. **Survives page reloads** - If you close the page or browser, it resumes where it left off
6. **Provides clear feedback** - Shows progress in browser console and has a visual button indicator

## Key Features

- **Complete coverage** - Cycles through all 4 sort types to find every comment
- **Safe timing** - 1-second delay between deletions to avoid rate limits
- **Date protection** - Never deletes comments newer than your configured threshold
- **Reliable recovery** - Automatically resumes after page reloads or crashes
- **Simple interface** - One button to start/stop, with visual feedback
- **Cross-platform** - Works on both old.reddit.com and new Reddit

## Installation

### Step-by-Step Guide

1. **Install a userscript manager** (if you don't have one):
   - For Chrome, Edge, or Firefox: Install [Tampermonkey](https://www.tampermonkey.net/)
   - For Firefox only: You can also use [Greasemonkey](https://www.greasespot.net/)
   - **Note**: Tested with Violentmonkey - should work with other userscript managers too

2. **Get the script**:
   - Click on the `reddit-comments-overkill.user.js` file in this repository
   - Click the "Raw" button to view the raw script
   - Copy the entire script content (Ctrl+A, Ctrl+C)

3. **Install the script**:
   - Your userscript manager should detect the script and offer to install it
   - If not, open your userscript manager's dashboard
   - Click "Create a new script" or the "+" button
   - Paste the copied script
   - Save (Ctrl+S or click Save)

4. **Verify installation**:
   - Go to your Reddit user comments page (see Usage below)
   - You should see a "Reddit Comment Overkill" button in the bottom-right corner

## Usage

1. Navigate to your Reddit user comments page:
   - `https://old.reddit.com/user/yourusername/comments/`
   - `https://www.reddit.com/user/yourusername/comments/`

2. Click the **"Start Deleting"** button in the bottom-right corner

3. A confirmation modal will appear warning about bulk deletion
4. The script will:
   - Begin deleting comments starting from the current page's sort
   - Process all 4 sort types automatically (new → hot → top → controversial)
   - Show progress in browser console
   - Handle rate limits and pagination automatically
   - Preserve comments from the last 10 days

5. To stop the process, click **"Stop Deleting"** (button turns red when running)

## Features

- **Automatic Sort Cycling** - Processes all 4 sort types (`new`, `hot`, `top`, `controversial`) automatically
- **URL State Persistence** - Single `comment_overkill_sort` parameter tracks progress across page reloads
- **Current Sort Detection** - Starts from current page's sort and cycles through remaining sorts
- **Dual Rate Limit Detection** - Monitors both fetch and XMLHttpRequest for 429 responses
- **Visual Button Feedback** - Button shows "Reddit Comment Overkill" branding with color changes (orange→red) and pulsing animation when running
- **Console Logging** - Detailed console output for monitoring without cluttered UI

## Configuration

Edit the following parameters in the script to customize behavior:

```javascript
// Sort types to cycle through (processes all 4 automatically)
const SORTS = ["new", "hot", "top", "controversial"];

// How long to wait for comments to load (milliseconds)
const WAIT_FOR_COMMENTS_MS = 8000;

// Rate limiting configuration
const RATE_LIMIT_MIN = 60000;      // 1 minute minimum wait
const RATE_LIMIT_MAX = 1800000;    // 30 minutes maximum wait
const BASE_RATE_LIMIT_WAIT = 60000; // Base wait time for rate limits

// Delay between deletion attempts (1 second)
const SHORT_DELAY_MIN = 1000;      // 1 second
const SHORT_DELAY_MAX = 1000;      // 1 second

// Long pause configuration (prevents rate limiting)
const LONG_DELAY_AFTER = [10, 20];    // Pause after 10-20 deletions
const LONG_DELAY_MS = [10000, 15000]; // Pause for 10-15 seconds

// Date filtering - preserve recent comments
const DAYS_TO_PRESERVE = 10;        // Keep comments from last 10 days
```

## Monitoring Progress

The script provides detailed console logging for monitoring:

- **Console Output** - All activity logged to browser console with `[Reddit Comment Overkill]` prefix
- **Button Visual Feedback** - Button changes from orange to red with pulsing animation when running
- **Rate Limit Detection** - Logs when 429 responses are detected via fetch or XMLHttpRequest
- **Sort Progress** - Logs when switching between sort types (new → hot → top → controversial)
- **Deletion Counts** - Logs number of comments found and deleted
- **Date Filtering** - Logs when comments are preserved due to being recent

Open browser developer tools (F12) and check the Console tab to monitor script activity.

## Rate Limiting

The script automatically handles Reddit's rate limiting:

- **Dual Detection** - Monitors both fetch and XMLHttpRequest for 429 responses
- **Exponential Backoff** - Doubles wait time each rate limit (60s → 120s → 240s, up to 30min max)
- **Automatic Resumption** - Continues automatically when rate limit period ends
- **Multiplier Reset** - Resets backoff multiplier after successful responses
- **Wait Checks** - Checks every 5 seconds if rate limit period has ended

## Safety Features

- **Date Protection** - Never deletes comments newer than configured threshold (last 10 days)
- **Confirmation Required** - Each deletion requires explicit "yes" confirmation
- **Initial Warning Modal** - Shows confirmation dialog before starting bulk deletion
- **Error Recovery** - Retries failed deletions with exponential backoff (5-30 seconds)
- **Manual Control** - Start/stop button for immediate control with visual feedback
- **URL State Tracking** - Can resume from interruption using URL parameter

## Troubleshooting

### Script not starting
- Ensure you're on your user comments page (URL should contain `/user/yourusername/comments/`)
- Check that Tampermonkey/Greasemonkey is enabled and the script is active
- Look for the "Reddit Comment Overkill" button in the bottom-right corner
- Open browser console (F12) to see if script is loading

### Comments not being deleted
- Check if comments are newer than 10 days (they're preserved by default)
- Verify you own the comments (can't delete others' comments)
- Open browser console (F12) to see script activity and error messages
- Check if rate limiting is active (script will wait automatically)

### Rate limiting issues
- The script automatically detects 429 responses and waits (60s → 120s → 240s, up to 30min)
- Check console for "RATE LIMIT detected" messages
- Script will resume automatically when rate limit period ends
- Consider increasing `SHORT_DELAY_MIN/MAX` for more conservative timing

### Contributing
1. Not at this time

## License

This project is licensed under the GNU General Public License v2.0 (GPL v2).

Copyright (C) 2025 xpufx 

## Disclaimer

This script modifies your Reddit account by permanently deleting comments. Use at your own risk. The authors are not responsible for any data loss or account issues. Always consider the implications of bulk deleting your comment history.
