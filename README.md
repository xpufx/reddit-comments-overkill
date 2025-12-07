# Reddit Comment Overkill

A browser userscript that automatically deletes all your Reddit comments across multiple sort types while conservatively adhering to Reddit's rate limits.

## **WARNING** 
**AI coding using LLM Agents**

## What It Does

- **Bulk comment deletion** - Automatically deletes all your Reddit comments
- **Smart sort cycling** - Cycles through `new → hot → top → controversial` to ensure complete coverage
- **Rate limit handling** - Detects 429 responses and implements exponential backoff
- **Recent comment protection** - Preserves comments from the last 10 days (configurable)
- **Cross-platform compatibility** - Works on both old.reddit.com and www.reddit.com
- **Real-time status display** - Shows progress, rate limit status, and recent activity

## What Makes It Unique

- **Intelligent rate limiting** - Exponential backoff with configurable multipliers
- **Date-based filtering** - Protects recent comments while deleting older ones
- **Comprehensive logging** - Real-time status display with newest messages first
- **Robust DOM detection** - Works with both infinite scroll and pagination
- **Error recovery** - Handles network errors and missing elements gracefully

## Installation

### Using Tampermonkey/Greasemonkey

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Firefox/Edge) or [Greasemonkey](https://www.greasespot.net/) (Firefox)
2. Click on `reddit-comments-overkill.user.js` in this repository
3. Copy the entire script content
4. Create a new userscript in your extension and paste the code
5. Save the script

## Usage

1. Navigate to your Reddit user comments page:
   - `https://old.reddit.com/user/yourusername/comments/`
   - `https://www.reddit.com/user/yourusername/comments/`

2. Click the **"Start Deleting"** button in the bottom-right corner

3. The script will:
   - Begin deleting comments starting with the "new" sort
   - Show real-time progress in the status display
   - Automatically cycle through all sort types
   - Handle rate limits and pagination automatically

4. To stop the process, click **"Stop Deleting"**

## Configuration

Edit the following parameters in the script to customize behavior:

```javascript
// Sort types to cycle through
const SORTS = ["new", "hot", "top", "controversial"];

// How long to wait for comments to load (milliseconds)
const WAIT_FOR_COMMENTS_MS = 8000;

// Rate limiting configuration
const RATE_LIMIT_MIN = 60000;      // 1 minute minimum wait
const RATE_LIMIT_MAX = 1800000;    // 30 minutes maximum wait
const BASE_RATE_LIMIT_WAIT = 60000; // Base wait time for rate limits

// Delays between deletions
const SHORT_DELAY_MIN = 2000;      // 2 seconds
const SHORT_DELAY_MAX = 2000;      // 2 seconds

// Long pause configuration (prevents rate limiting)
const LONG_DELAY_AFTER = [3, 6];    // Pause after 3-6 deletions
const LONG_DELAY_MS = [15000, 30000]; // Pause for 15-30 seconds

// Date filtering - preserve recent comments
const DAYS_TO_PRESERVE = 10;        // Keep comments from last 10 days
```

## Status Display

The script provides a real-time status display showing:

- **Status** - Current operation state
- **Current Sort** - Which sort type is being processed
- **Comments Found** - Number of deletable comments on current page
- **Comments Deleted** - Total comments deleted in current session
- **Recent Preserved** - Comments skipped due to date filtering
- **Rate Limit Status** - Current rate limiting state
- **Sort Progress** - Progress through sort types (e.g., "2/4")
- **Log Messages** - Recent activity (newest messages first)

## Rate Limiting

The script automatically handles Reddit's rate limiting:

- Detects 429 HTTP responses
- Implements exponential backoff (doubles wait time each rate limit)
- Waits between 1-30 minutes depending on rate limit frequency
- Continues automatically when rate limit period ends

## Safety Features

- **Date protection** - Never deletes comments newer than configured threshold
- **Confirmation required** - Each deletion requires explicit "yes" confirmation
- **Error recovery** - Retries failed deletions with exponential backoff
- **Manual control** - Start/stop button for immediate control

## Troubleshooting

### Script not starting
- Ensure you're on your user comments page
- Check that the userscript manager is enabled
- Verify the script matches the URL patterns in the header

### Comments not being deleted
- Check if comments are older than the `DAYS_TO_PRESERVE` threshold
- Verify you own the comments (can't delete others' comments)
- Check the status display for rate limiting messages

### Rate limiting issues
- The script will automatically wait and retry
- Consider increasing `SHORT_DELAY_*` values for more conservative timing
- Rate limit multiplier increases with each 429 response

### Contributing
1. Not at this time

## License

This project is licensed under the GNU General Public License v2.0 (GPL v2).

Copyright (C) 2025 xpufx 

## Disclaimer

This script modifies your Reddit account by permanently deleting comments. Use at your own risk. The authors are not responsible for any data loss or account issues. Always consider the implications of bulk deleting your comment history.
