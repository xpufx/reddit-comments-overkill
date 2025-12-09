// ==UserScript==
// @name         Reddit Comment Overkill
// @namespace    https://github.com/xpufx/reddit-comments-overkill
// @version      2.21
// @description  Deletes all comments by cycling sorts reliably, retrying on rate limits, waiting for comments, handling infinite scroll & next page, with Start/Stop control.
// @downloadURL  https://github.com/xpufx/reddit-comments-overkill/raw/refs/heads/main/reddit-comments-overkill.user.js
// @updateURL    https://github.com/xpufx/reddit-comments-overkill/raw/refs/heads/main/reddit-comments-overkill.user.js
// Old Reddit
// @match        https://old.reddit.com/user/*/comments*
// STILL Old Reddit but with RES etc that displays all reddit on the normal address
// @match        https://www.reddit.com/user/*/comments*
// @grant        none
// @run-at       document-idle
// ==/UserScript==


/*
 CORE RULES IMPLEMENTED:

 1. Script cycles sorts (new → top → controversial → old) ONLY AFTER each sort is fully processed.
 2. It DOES NOT reload the same sort repeatedly.
 3. It WAITS for comments to appear (up to 8 seconds) before declaring a sort empty.
 4. Deletions use DOM-based detection ("delete" text in buttons/links).
 5. Rate-limit (429) detected by monkey-patching fetch → script waits & retries.
 6. Next-page handled on old Reddit. Infinite scroll handled on new Reddit.
 7. Script loops forever until all sorts are empty.
 8. Manual Start/Stop button provided.
*/

(function() {
	"use strict";

	/***********************
	 * CONFIG
	 ************************/
	const SCRIPT_NAME = "Reddit Comment Overkill";
	const LOGGING_ENABLED = true; // Set to false to disable console logging
	const SORTS = ["new", "hot", "top", "controversial"];
	const WAIT_FOR_COMMENTS_MS = 8000;
	const RATE_LIMIT_MIN = 60000;
	const RATE_LIMIT_MAX = 1800000;
	const SHORT_DELAY_MIN = 1000;
	const SHORT_DELAY_MAX = 1000;
	const LONG_DELAY_AFTER = [10, 20];
	const LONG_DELAY_MS = [10000, 15000];
	let daysToPreserve = 10; // Keep comments from the last N days (set to 0 to delete all comments regardless of age)

	// Logging function to consistently identify our script
	function log(message, ...args) {
		if (LOGGING_ENABLED) {
			const logMessage = "[" + SCRIPT_NAME + "] " + message;
			console.log(logMessage, ...args);
		}
	}

	// Use URL parameter to maintain state across page reloads
	// comment_overkill_sort presence indicates script is running
	function getRunningStateFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get('comment_overkill_sort') !== null;
	}

	function getSortFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get('comment_overkill_sort');
	}

	function getDaysFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const daysParam = urlParams.get('comment_overkill_days');
		if (daysParam !== null) {
			const days = parseInt(daysParam, 10);
			return !isNaN(days) && days >= 0 ? days : 10; // default 10 if invalid
		}
		return 10; // default
	}

	function updateUrlState(isRunning, sortName, daysToPreserve) {
		const urlParams = new URLSearchParams(window.location.search);

		if (isRunning && sortName) {
			// Set comment_overkill_sort parameter
			urlParams.set('comment_overkill_sort', sortName);
			// Set comment_overkill_days parameter if provided
			if (daysToPreserve !== undefined) {
				urlParams.set('comment_overkill_days', daysToPreserve.toString());
			}
		} else {
			// Remove parameters when not running
			urlParams.delete('comment_overkill_sort');
			urlParams.delete('comment_overkill_days');
		}

		// Update URL without reloading
		const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
		history.replaceState({}, document.title, newUrl);
	}

	// Initialize running state from URL
	let running = getRunningStateFromUrl();
	daysToPreserve = getDaysFromUrl();

	// Debug logging
	log("Script loaded - URL parameters:", window.location.search);
	log("Running state from URL:", running);
	log("Current sort from URL:", getSortFromUrl());
	log("Days to preserve from URL:", daysToPreserve);

	// Progress tracking is no longer needed since we use URL parameters


	/***********************
	 * RATE LIMITING
	 ************************/
	let rateLimitActive = false;
	let lastRateLimitTime = 0;
	let rateLimitMultiplier = 1; // Start at 1x, increases with each 429
	const BASE_RATE_LIMIT_WAIT = 60000; // 60 seconds minimum wait

	// Check if we're currently rate limited
	function isRateLimited() {
		if (!rateLimitActive) return false;

		// Check if enough time has passed to resume
		const now = Date.now();
		const timeSinceLimit = now - lastRateLimitTime;
		const baseWait = BASE_RATE_LIMIT_WAIT * rateLimitMultiplier;
		const cappedWait = Math.min(baseWait, RATE_LIMIT_MAX);

		if (timeSinceLimit >= cappedWait) {
			// Enough time has passed, reset rate limit state
			rateLimitActive = false;
			return false;
		}

		return true; // Still rate limited
	}

	// Wait until rate limit period is over
	async function waitForRateLimit() {
		while (isRateLimited()) {
			log("Still rate limited, waiting...");
			await sleep(5000); // Check every 5 seconds
		}
	}

	/***********************
	 * HELPERS
	 ************************/
	const sleep = ms => new Promise(r => setTimeout(r, ms));
	const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

	// -------- fetch monkey patch --------
	const originalFetch = window.fetch;
	window.fetch = async function(...args) {
		const resp = await originalFetch(...args);
		if (resp.status === 429) {
			log("RATE LIMIT detected (429) via fetch");
			rateLimitActive = true;
			lastRateLimitTime = Date.now();

			// Calculate wait time with exponential backoff (up to max)
			const baseWait = BASE_RATE_LIMIT_WAIT * rateLimitMultiplier;
			const cappedWait = Math.min(baseWait, RATE_LIMIT_MAX);
			rateLimitMultiplier = Math.min(rateLimitMultiplier * 2, RATE_LIMIT_MAX / BASE_RATE_LIMIT_WAIT); // Double multiplier but cap it

			log("Rate limited, setting flag for " + (cappedWait / 1000) + " seconds, multiplier now: " + rateLimitMultiplier);
		} else {
			// Reset multiplier after successful response to avoid permanent slowdown
			if (rateLimitMultiplier > 1) {
				rateLimitMultiplier = 1;
				log("Rate limit multiplier reset after successful response");
			}
		}
		return resp;
	};

	// -------- XMLHttpRequest monkey patch --------
	const OriginalXHR = window.XMLHttpRequest;
	window.XMLHttpRequest = class extends OriginalXHR {
		constructor() {
			super();
			this.addEventListener('readystatechange', () => {
				if (this.readyState === 4 && this.status === 429) {
					log("RATE LIMIT detected (429) via XMLHttpRequest");
					rateLimitActive = true;
					lastRateLimitTime = Date.now();

					// Calculate wait time with exponential backoff (up to max)
					const baseWait = BASE_RATE_LIMIT_WAIT * rateLimitMultiplier;
					const cappedWait = Math.min(baseWait, RATE_LIMIT_MAX);
					rateLimitMultiplier = Math.min(rateLimitMultiplier * 2, RATE_LIMIT_MAX / BASE_RATE_LIMIT_WAIT); // Double multiplier but cap it

					log("Rate limited, setting flag for " + (cappedWait / 1000) + " seconds, multiplier now: " + rateLimitMultiplier);
				} else if (this.readyState === 4 && this.status !== 429 && rateLimitMultiplier > 1) {
					// Reset multiplier after successful response to avoid permanent slowdown
					rateLimitMultiplier = 1;
					log("Rate limit multiplier reset after successful XHR response");
				}
			});
		}
	};


	/***********************
	 * DETECT SORT ON PAGE
	 ************************/
	function getCurrentSort() {
		try {
			// First try to get from URL
			const u = new URL(location.href);
			const urlSort = u.searchParams.get("sort");
			if (urlSort) {
				log("getCurrentSort(): Found in URL:", urlSort);
				return urlSort;
			}

			// If not in URL, try to detect from the UI
			const selectedSortElement = document.querySelector('.dropdown.lightdrop .selected, .dropdown.sorts .selected, [data-sort-direction].active');
			if (selectedSortElement) {
				const sortText = selectedSortElement.textContent.trim().toLowerCase();
				log("getCurrentSort(): Found in UI element:", sortText);
				// Verify it's a valid sort option
				if (SORTS.includes(sortText)) {
					return sortText;
				}
			}

			// Default to "new" if we can't determine
			log("getCurrentSort(): Defaulting to 'new'");
			return "new";
		} catch {
			log("getCurrentSort(): Exception, defaulting to 'new'");
			return "new";
		}
	}

	function gotoSort(sort) {
		log("Switching sort →", sort, "via URL navigation");
		log("Current URL state - running:", running, "sort:", getSortFromUrl());

		// Always use URL navigation to ensure state is preserved
		const u = new URL(location.href);
		log("Original URL:", location.href);
		u.searchParams.set("sort", sort);
		log("Sort parameter set to:", sort);
		log("URL after setting sort:", u.toString());

		// Preserve our state parameters
		if (running) {
			const currentSort = getSortFromUrl();
			log("Preserving sort parameter:", currentSort);
			if (currentSort) {
				u.searchParams.set("comment_overkill_sort", currentSort);
			}
		}

		log("Final URL before navigation:", u.toString());
		if (u.toString() !== location.href) {
			log("Navigating to:", u.toString());
			location.href = u.toString();
		} else {
			log("URL unchanged, no navigation needed");
		}
		return false; // Indicate that we had to reload
	}


	/***********************
	 * DATE FILTERING
	 ************************/
	let preservedCount = 0; // Track number of preserved comments

	function shouldSkipCommentByDate(commentElement) {
		// Try multiple possible selectors for timestamp element
		const selectors = [
			'time[datetime]',
			'faceplate-time[datetime]',
			'[data-testid="comment_timestamp"]',
			'[data-click-id="timestamp"]',
			'a[data-testid="comment_timestamp"]',
			'span[data-testid="comment_timestamp"]'
		];
		let timeElement = null;
		for (const selector of selectors) {
			timeElement = commentElement.querySelector(selector);
			if (timeElement) break;
		}
		if (!timeElement) {
			// If no time element found, we can't determine the date, so preserve the comment
			log('shouldSkipCommentByDate: No timestamp element found, preserving comment:', commentElement);
			return true; // Return true to skip (preserve) the comment
		}

		try {
			const datetime = timeElement.getAttribute('datetime') || timeElement.textContent;
			const commentDateTime = new Date(datetime);
			if (isNaN(commentDateTime.getTime())) {
				log('shouldSkipCommentByDate: Invalid date, preserving comment:', datetime, commentElement);
				return true; // Return true to skip (preserve) the comment
			}
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - daysToPreserve);

			// If comment is newer than the cutoff date, skip it (don't delete)
			const shouldSkip = commentDateTime > cutoffDate;

			if (shouldSkip) {
				preservedCount++;
				log(`shouldSkipCommentByDate: Preserving comment from ${commentDateTime.toISOString()} (cutoff: ${cutoffDate.toISOString()})`);
			}

			return shouldSkip;
		} catch (e) {
			// If we can't parse the date, preserve the comment
			log('shouldSkipCommentByDate: Error parsing date, preserving comment:', e, commentElement);
			return true; // Return true to skip (preserve) the comment
		}
	}

	/***********************
	 * COMMENT DETECTION
	 ************************/
	function getDeleteButtons() {
		// More robust selector using data attribute and class
		return [...document.querySelectorAll("a[data-event-action='delete'], a.togglebutton")]
			.filter(el => /delete/i.test(el.textContent))
			// Additionally filter to skip comments that are too recent
			.filter(deleteBtn => {
				// Find the comment element that contains this delete button
				const commentElement = deleteBtn.closest('.comment, .thing, .entry, [id^=t1_]');
				if (!commentElement) {
					return true; // If we can't find the comment element, include the button
				}

				// Check if this comment should be skipped based on date
				return !shouldSkipCommentByDate(commentElement);
			});
	}

	async function waitForComments() {
		const start = Date.now();
		while (Date.now() - start < WAIT_FOR_COMMENTS_MS && running) {
			// Wait if we're currently rate limited
			await waitForRateLimit();

			// Check for both delete buttons and comment containers to ensure page is loaded
			const del = getDeleteButtons();
			const comments = document.querySelectorAll('div.comment, div.comment-body, .thing.comment');

			if (del.length > 0) return del;
			// If we see comments but no delete buttons, they might still be loading
			if (comments.length > 0) {
				await sleep(1500); // Wait a bit more for buttons to appear
				continue;
			}
			await sleep(1000);
		}
		return [];
	}


	/***********************
	 * DELETE SINGLE COMMENT
	 ************************/
	async function deleteComment(btn) {
		let success = false;

		while (!success && running) {
			// Wait if we're currently rate limited
			await waitForRateLimit();

			try {
				btn.click();
				await sleep(300);

				const yes = [...document.querySelectorAll("a.yes, .option.error.active a")]
					.find(e => e.textContent.trim().toLowerCase() === "yes");

				if (!yes) {
					log("No confirmation found; skipping.");
					return false;
				}

				yes.click();
				await sleep(rand(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
				return true;

			} catch (err) {
				log("Error during delete:", err);
				// Use a more reasonable delay for errors
				const cooldown = rand(5000, 30000); // 5-30 seconds instead of 30s-15m
				log("Waiting for " + (cooldown / 1000) + " seconds before retry");
				await sleep(cooldown);
			}
		}
		return false;
	}


	/***********************
	 * PROCESS PAGE
	 ************************/
	async function processPage() {
		if (!running) return false;

		// Wait if we're currently rate limited
		await waitForRateLimit();

		let deletes = getDeleteButtons();

		if (deletes.length === 0) {
			// wait for lazy-loaded comments
			deletes = await waitForComments();
		}

		// Check if there are actually comments on the page, not just delete buttons
		const commentElements = document.querySelectorAll('div.comment, div.comment-body, .thing.comment');
		if (deletes.length === 0 && commentElements.length === 0) {
			return false; // no comments to delete
		}

		if (deletes.length === 0) {
			// Comments exist but no delete buttons (might be someone else's comments)
			log("Comments found but no delete buttons available");
			// Update status to show current state
			// Check for next page or load more even if no deletes found
			const nextBtn = document.querySelector("span.next-button a");
			if (nextBtn && running) {
				log("Next page →", nextBtn.href);
				location.href = nextBtn.href;
				return true;
			}
			const more = document.querySelector(".morecomments, .load-more-comments");
			if (more && running) {
				log("Loading more comments...");
				more.scrollIntoView();
				more.click(); // Actually click the load more button
				await sleep(3000); // Wait for content to load
				return true;
			}
			return false; // no delete buttons found
		}

		log("Found", deletes.length, "comments to delete");
		// Update status with number of comments found

		let deleted = 0;

		for (const btn of deletes) {
			if (!running) break;

			// Wait for potential rate limit before each deletion
			await waitForRateLimit();

			const success = await deleteComment(btn);
			if (success) {
				deleted++;
				// Update status with number of deleted comments
			}

			// periodic long pause to avoid rate limit
			const [minN, maxN] = LONG_DELAY_AFTER;
			if (deleted % rand(minN, maxN) === 0) {
				const p = rand(LONG_DELAY_MS[0], LONG_DELAY_MS[1]);
				log("Long pause", p / 1000, "seconds");
				await sleep(p);
			}
		}

		// handle old reddit pagination
		const nextBtn = document.querySelector("span.next-button a");
		if (nextBtn && running) {
			log("Next page →", nextBtn.href);
			location.href = nextBtn.href;
			return true;
		}

		// handle new reddit infinite scroll
		const more = document.querySelector(".morecomments, .load-more-comments");
		if (more && running) {
			log("Loading more comments...");
			more.scrollIntoView();
			more.click(); // Actually click the load more button
			await sleep(3000); // Wait for content to load
			return true;
		}

		return true; // We processed some comments
	}


	/***********************
	 * PER-SORT EXECUTION
	 ************************/
	async function runSort(sort) {
		// Wait if we're currently rate limited
		await waitForRateLimit();

		// Check if we're already on the correct sort
		const cur = getCurrentSort();
		if (cur !== sort) {
			log("Current sort is", cur, "but need", sort, "waiting before navigation to prevent rate limits");
			// Wait before navigation to prevent rate limiting
			await sleep(5000); // 5 second wait before navigation (reduced from 30 seconds)
			gotoSort(sort);
			// Wait a bit to allow navigation to start before this script context ends
			await sleep(5000); // 5 second wait (increased from 2 seconds)
			return false; // let reload happen since we're using URL navigation
		} else {
			log("Already on correct sort:", sort, "starting processing immediately");
		}

		log("Processing sort:", sort);

		// Wait for comments to appear on the current page
		const initialDeletes = getDeleteButtons();
		if (initialDeletes.length === 0) {
			log("No delete buttons found, waiting for comments to load...");
			const deletesAfterWait = await waitForComments();
			if (deletesAfterWait.length === 0) {
				log("Still no comments found after waiting for sort:", sort);
				return true; // Consider this sort complete if no comments found
			}
		}

		// Repeatedly delete until none left
		while (running) {
			// Wait if we're currently rate limited
			await waitForRateLimit();

			const didWork = await processPage();
			if (!running) break;
			if (!didWork) break;
			await sleep(3000); // Increased from 800ms
		}

		log("Sort complete:", sort);
	}




	/*************************
	 * MAIN LOOP
	 ************************/
	async function main() {
		// Always process all 4 sorts
		const activeSorts = SORTS;
		log("Processing all sorts:", activeSorts);

		// Determine if we're starting fresh or resuming
		const urlHasRunningState = getRunningStateFromUrl();
		let idx = 0;

		if (urlHasRunningState) {
			// Actual resume: page loaded with URL params, no modal was shown
			log("Resuming from URL state");
			const urlSort = getSortFromUrl();
			if (urlSort && activeSorts.includes(urlSort)) {
				idx = activeSorts.indexOf(urlSort);
				log("Resuming from sort:", urlSort, "at index:", idx);
			} else if (urlSort) {
				// If the URL sort isn't in active sorts, find the next valid one
				const urlSortOriginalIndex = SORTS.indexOf(urlSort);
				if (urlSortOriginalIndex !== -1) {
					for (let i = 0; i < activeSorts.length; i++) {
						const activeSortOriginalIndex = SORTS.indexOf(activeSorts[i]);
						if (activeSortOriginalIndex >= urlSortOriginalIndex) {
							idx = i;
							log("URL sort not in selected sorts, resuming from:", activeSorts[idx], "at index:", idx);
							break;
						}
					}
				}
			}
		} else {
			// Fresh start - start from current page sort
			log("Starting fresh, checking current page sort");
			const currentSort = getCurrentSort();
			const currentSortIndex = activeSorts.indexOf(currentSort);
			if (currentSortIndex !== -1) {
				idx = currentSortIndex;
				log("Starting from current sort:", currentSort, "at index:", idx);
			} else {
				log("Current sort not found, starting from first sort");
			}
		}

		// Safety check: ensure idx is valid
		if (idx < 0 || idx >= activeSorts.length) {
			log("ERROR: Invalid idx", idx, "for activeSorts length", activeSorts.length, "- resetting to 0");
			idx = 0;
		}

		log("Starting from sort index: " + idx + " (" + (activeSorts[idx] || 'unknown') + ")");
		log("Active sorts:", activeSorts);

		// Update status display

		// Track which sorts have been completed to skip them if we encounter them again
		const completedSorts = new Set();

		// Mark all previous sorts as completed if starting from a middle position
		for (let i = 0; i < idx; i++) {
			if (i < activeSorts.length) {
				completedSorts.add(activeSorts[i]);
			}
		}

		while (running) {
			try {
				// Wait if we're currently rate limited
				await waitForRateLimit();

				// Find next non-completed sort
				while (idx < activeSorts.length && completedSorts.has(activeSorts[idx])) {
					log("Skipping already completed sort:", activeSorts[idx]);
					idx++;
				}

				if (idx >= activeSorts.length) {
					log("ALL SELECTED SORTS PROCESSED — no more comments.");
					running = false;
					// Update status and button state when all sorts are complete
					updateUrlState(false, 0);
					updateButtonState();
					log("All selected sorts completed, clearing state");
					break;
				}

				const sort = activeSorts[idx];

				log("Processing sort: " + sort + " at index: " + idx);
				const finished = await runSort(sort);
				if (!running) break;

				if (finished) {
					completedSorts.add(sort);
					idx++;
					log("Finished " + sort + " sort, advancing to index: " + idx);
					// Update URL state for page reload recovery
					// Get next sort to process, or empty if done
					let nextSort = "";
					if (idx < activeSorts.length) {
						nextSort = activeSorts[idx];
					}
					updateUrlState(running, nextSort, daysToPreserve);
					log("Updated URL state - running: " + running + ", next sort: " + nextSort);
					// Update progress in status display
				}

				await sleep(5000);
			} catch (error) {
				log("Error in main loop:", error);
				// Update status to show error
				// Wait before continuing to avoid getting stuck in an error loop
				await sleep(10000);
				// Resume status after error pause
				if (running) {
				}
			}
		}
	}







	/***********************
	 * CONFIRMATION MODAL
	 ************************/
	function showConfirmationModal() {
		const modal = document.createElement("div");
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.7);
			display: flex;
			justify-content: center;
			align-items: center;
			z-index: 999997;
		`;

		const content = document.createElement("div");
		content.style.cssText = `
			background: white;
			padding: 20px;
			border-radius: 8px;
			min-width: 300px;
			max-width: 500px;
			box-shadow: 0 4px 15px rgba(0,0,0,0.3);
		`;

		const title = document.createElement("h3");
		title.textContent = "⚠️ Confirm Bulk Comment Deletion";
		title.style.cssText = "margin-top: 0; margin-bottom: 15px; color: #d00;";
		content.appendChild(title);

		const warning = document.createElement("p");
		warning.innerHTML = "This will permanently delete ALL your Reddit comments across all sort types (new, hot, top, controversial). Comments from the last <span id='days-display'>" + daysToPreserve + "</span> days will be preserved.";
		warning.style.cssText = "margin-bottom: 10px; line-height: 1.4;";
		content.appendChild(warning);

		// Days input
		const daysContainer = document.createElement("div");
		daysContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const daysLabel = document.createElement("label");
		daysLabel.textContent = "Preserve comments from the last:";
		daysLabel.style.cssText = "font-weight: bold;";

		const daysInput = document.createElement("input");
		daysInput.type = "number";
		daysInput.min = "0";
		daysInput.max = "365";
		daysInput.value = daysToPreserve;
		daysInput.style.cssText = "padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; width: 70px;";

		const daysSuffix = document.createElement("span");
		daysSuffix.textContent = "days";

		daysContainer.appendChild(daysLabel);
		daysContainer.appendChild(daysInput);
		daysContainer.appendChild(daysSuffix);
		content.appendChild(daysContainer);

		// Update display and variable when input changes
		daysInput.addEventListener('input', () => {
			const newValue = parseInt(daysInput.value, 10);
			if (!isNaN(newValue) && newValue >= 0) {
				daysToPreserve = newValue;
				document.getElementById('days-display').textContent = newValue;
			}
		});

		const note = document.createElement("p");
		note.textContent = "Starting from current sort: " + getCurrentSort();
		note.style.cssText = "margin-bottom: 20px; font-style: italic;";
		content.appendChild(note);

		const buttonContainer = document.createElement("div");
		buttonContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px;";

		const confirmBtn = document.createElement("button");
		confirmBtn.textContent = "Confirm & Start Deleting";
		confirmBtn.style.cssText = `
			padding: 8px 16px;
			background: #ff4500;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		`;

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = "Cancel";
		cancelBtn.style.cssText = `
			padding: 8px 16px;
			background: #ccc;
			color: #333;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		`;

		buttonContainer.appendChild(cancelBtn);
		buttonContainer.appendChild(confirmBtn);
		content.appendChild(buttonContainer);
		modal.appendChild(content);

		// Add modal to document
		document.body.appendChild(modal);

		// Handle cancel button
		cancelBtn.onclick = () => {
			document.body.removeChild(modal);
			// Keep button as "Start Deleting"
		};

		// Handle confirm button
		confirmBtn.onclick = () => {
			document.body.removeChild(modal);
			running = true;
			updateButtonState();

			// Calculate starting sort and update URL
			const currentSort = getCurrentSort();
			updateUrlState(running, currentSort, daysToPreserve);

			main();
		};
	}

	/***********************
	 * BUTTON
	 ************************/
	const btn = document.createElement("button");
	btn.innerHTML = '<span style="font-weight: bold; font-size: 11px; opacity: 0.8; margin-right: 6px;">Reddit Comment Overkill</span><span class="btn-text">Start Deleting</span>';
	Object.assign(btn.style, {
		position: "fixed",
		bottom: "15px",
		right: "15px",
		padding: "10px 14px",
		background: "#ff4500",
		color: "#fff",
		border: "none",
		borderRadius: "6px",
		fontSize: "14px",
		cursor: "pointer",
		zIndex: 999999,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
		transition: "all 0.2s ease"
	});
	document.body.appendChild(btn);

	// Update button visual state
	function updateButtonState() {
		let btnText = btn.querySelector('.btn-text');
		// If button HTML was corrupted (e.g., by btn.textContent), restore it
		if (!btnText) {
			btn.innerHTML = '<span style="font-weight: bold; font-size: 11px; opacity: 0.8; margin-right: 6px;">Reddit Comment Overkill</span><span class="btn-text">Start Deleting</span>';
			btnText = btn.querySelector('.btn-text');
		}
		if (running) {
			btnText.textContent = "Stop Deleting";
			btn.style.background = "#d00";
			btn.style.boxShadow = "0 2px 8px rgba(208, 0, 0, 0.5)";
			// Add pulsing animation when running
			btn.style.animation = "pulse 1.5s infinite";
		} else {
			btnText.textContent = "Start Deleting";
			btn.style.background = "#ff4500";
			btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
			btn.style.animation = "none";
		}
	}

	// Add CSS for pulsing animation
	const style = document.createElement('style');
	style.textContent = `
		@keyframes pulse {
			0% { box-shadow: 0 0 0 0 rgba(208, 0, 0, 0.7); }
			70% { box-shadow: 0 0 0 6px rgba(208, 0, 0, 0); }
			100% { box-shadow: 0 0 0 0 rgba(208, 0, 0, 0); }
		}
	`;
	document.head.appendChild(style);

	// Set initial button state based on URL running state
	running = getRunningStateFromUrl();
	updateButtonState();

	btn.onclick = () => {
		if (!running) {
			// Starting fresh - check if we need confirmation
			if (getRunningStateFromUrl()) {
				// Already has comment_overkill_sort parameter - resume without confirmation
				running = true;
				updateButtonState();
				main();
			} else {
				// Fresh start - show confirmation modal
				showConfirmationModal();
			}
		} else {
			// Stopping
			running = false;
			updateUrlState(false, 0);
			updateButtonState();
		}
	};

	// Add cleanup on page unload
	window.addEventListener('beforeunload', () => {
		// No cleanup needed since we use URL parameters
	});

	// Check if the script should start automatically based on URL state
	if (getRunningStateFromUrl()) {
		log("Resuming from previous state");
		running = true; // Ensure running is true when resuming
		// Update button to reflect running status
		updateButtonState();

		main();
	}

})();

