# Reddit Comments Overkill

A browser userscript that automatically deletes all your Reddit comments. It's designed to be reliable and respect Reddit's rate limits while ensuring complete coverage of your comment history. Reddit has a lot of protections in place to throttle requests. This script does NOT try to be the fastest but instead tries to ensure ALL comments will eventually be gone without requiring user interaction.

## Features

- **Complete Coverage**: Cycles through all 4 sort types (`new`, `hot`, `top`, `controversial`) to find every comment. However due to the way Reddit caches comments, you may have to run the script again after some hours.

- **Date Protection**: By default, comments from the last 10 days are preserved. This is configurable in the script.
- **Dot Preservation**: If you want to keep a particular comment, first make sure it has a single dot at the end of the comment on its own line and then make sure this feature is enabled. (Default: enabled)
- **Dry-Run Mode**: Log actions without actually deleting comments. Useful for testing dot detection and previewing deletions.
- **Rate Limit Handling**:
    - Automatically detects rate limits (429 errors) from both `fetch` and `XMLHttpRequest`.
    - Implements exponential backoff, doubling the wait time after each rate limit detection (e.g., 60s, 120s, 240s) up to a maximum of 30 minutes.
- **Detailed Logging**: All actions, including deletions, sort changes, and rate limit warnings, are logged to the browser's developer console (F12).

## Installation

### Step-by-Step Guide

1. **Install a userscript manager** (if you don't have one):
   - **Primary recommendation**: [Violentmonkey](https://violentmonkey.github.io/) (tested and confirmed working)
   - Alternative options:
     - [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Firefox/Edge)
     - [Greasemonkey](https://www.greasespot.net/) (Firefox only)

2. **Install the script**:
   - Click on the `reddit-comments-overkill.user.js` file in this repository
   - Click the "Raw" button to view the raw script
   - Your userscritp manager should prompt you to install it, if it doesn't, copy the entire script content (Ctrl+A, Ctrl+C)
   - Open your userscript manager's dashboard
   - Click "Create a new script" or the "+" button
   - Paste the copied script
   - Save (Ctrl+S or click Save)

4. **Verify installation**:
   - Go to your Reddit user comments page (see Usage below)
   - You should see a "Reddit Comments Overkill" button in the bottom-right corner

## Usage

1. Navigate to your Reddit user comments page: (note that these urls are both for "old" reddit. It won't work on the new NEW reddit which has different frontend code.)
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
const DAYS_TO_PRESERVE = 10;        // Keep comments from last 10 days (set to 0 to delete all comments regardless of age)

// Dot preservation - preserve comments ending with dot (.) on their own line
let preserveDotComments = true; // Set to false to disable preserving comments ending with a dot on their own line
// Dry-run mode - log actions without actually deleting
let dryRun = false; // Set to true to enable dry-run mode
```

## Troubleshooting

### Script not starting
- Ensure you're on your user comments page (URL should contain `/user/yourusername/comments/`)
- Check that Tampermonkey/Greasemonkey is enabled and the script is active
- Look for the "Reddit Comments Overkill" button in the bottom-right corner
- Open browser console (F12) to see if script is loading

### Comments not being deleted
- Check if comments are newer than 10 days (they're preserved by default)
- Open browser console (F12) to see script activity and error messages
- Check if rate limiting is active (script will wait automatically)

### Contributing
1. Not at this time

## AI Authorship Disclosure

Please note that a significant portion of this codebase, including its core logic and structure, has been generated by an AI. The functionality has been manually tested using Violentmonkey.

## License

This project is licensed under the GNU General Public License v2.0 (GPL v2).

Copyright (C) 2025 xpufx 

## Disclaimer

This script modifies your Reddit account by permanently deleting comments. Use at your own risk. The authors are not responsible for any data loss or account issues. Always consider the implications of bulk deleting your comment history.
