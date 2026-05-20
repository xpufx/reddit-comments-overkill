// ==UserScript==
// @name         Reddit Comments Overkill
// @namespace    https://github.com/xpufx/reddit-comments-overkill
// @version      2.27
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


(function() {
	"use strict";

	/***********************
	 * CONFIG
	 ************************/
	const SCRIPT_NAME = "Reddit Comments Overkill";
	const LOGGING_ENABLED = true; // Set to false to disable console logging
	const SORTS = ["new", "hot", "top", "controversial"];
	const WAIT_FOR_COMMENTS_MS = 8000;
	const RATE_LIMIT_MAX = 1800000;
	const SHORT_DELAY_MIN = 1000;
	const SHORT_DELAY_MAX = 1000;
	const LONG_DELAY_AFTER = [10, 20];
	const LONG_DELAY_MS = [10000, 15000];
	let daysToPreserve = 10; // Keep comments from the last N days (set to 0 to delete all comments regardless of age)
	let preserveDotComments = true; // Preserve comments that end with a dot (.) on its own line
	let dryRun = false; // Dry run mode: log actions without actually deleting
	let simulate = true; // Simulation mode: click "No" on confirmation instead of "Yes" — safe for debugging

	// Logging function to consistently identify our script
	function log(message, ...args) {
		if (LOGGING_ENABLED) {
			const logMessage = "[" + SCRIPT_NAME + "] " + message;
			console.log(logMessage, ...args);
		}
	}

	// Use URL parameter to maintain state across page reloads
	// rco_sort presence indicates script is running
	function getUrlState() {
		const urlParams = new URLSearchParams(window.location.search);
		const sortValue = urlParams.get('rco_sort');
		return {
			isRunning: sortValue !== null,
			sortValue: sortValue
		};
	}

	function getRunningStateFromUrl() {
		return getUrlState().isRunning;
	}

	function getSortFromUrl() {
		return getUrlState().sortValue;
	}

	function getDaysFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const daysParam = urlParams.get('rco_days');
		if (daysParam !== null) {
			const days = parseInt(daysParam, 10);
			return !isNaN(days) && days >= 0 ? days : 10; // default 10 if invalid
		}
		return 10; // default
	}

	function getDotPreservationFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const dotParam = urlParams.get('rco_dot');
		if (dotParam !== null) {
			return dotParam === 'true';
		}
		return true; // default
	}

	function getDryRunFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const dryRunParam = urlParams.get('rco_dryrun');
		if (dryRunParam !== null) {
			return dryRunParam === 'true';
		}
		return false; // default
	}

	function getSimulateFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const simParam = urlParams.get('rco_simulate');
		if (simParam !== null) {
			return simParam === 'true';
		}
		return true; // default to safe simulation mode
	}

	function updateUrlState(isRunning, sortName, daysToPreserve, preserveDotComments, dryRun) {
		const urlParams = new URLSearchParams(window.location.search);

		if (isRunning && sortName) {
			// Set rco_sort parameter
			urlParams.set('rco_sort', sortName);
			// Set rco_days parameter if provided
			if (daysToPreserve !== undefined) {
				urlParams.set('rco_days', daysToPreserve.toString());
			}
			// Set rco_dot parameter if provided
			if (preserveDotComments !== undefined) {
				urlParams.set('rco_dot', preserveDotComments.toString());
			}
			// Set rco_dryrun parameter if provided
			if (dryRun !== undefined) {
				urlParams.set('rco_dryrun', dryRun.toString());
			}
			// Set rco_simulate parameter
			urlParams.set('rco_simulate', simulate.toString());
		} else {
			// Remove parameters when not running
			urlParams.delete('rco_sort');
			urlParams.delete('rco_days');
			urlParams.delete('rco_dot');
			urlParams.delete('rco_dryrun');
			urlParams.delete('rco_simulate');
		}

		// Update URL without reloading
		const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
		history.replaceState({}, document.title, newUrl);
	}

	// Initialize running state from URL
	let running = getRunningStateFromUrl();
	daysToPreserve = getDaysFromUrl();
	preserveDotComments = getDotPreservationFromUrl();
	dryRun = getDryRunFromUrl();
	simulate = getSimulateFromUrl();

	// Debug logging
	log("Script loaded - URL parameters:", window.location.search);
	log("Running state from URL:", running);
	log("Current sort from URL:", getSortFromUrl());
	log("Days to preserve from URL:", daysToPreserve);
	log("Preserve dot comments from URL:", preserveDotComments);
	log("Dry run mode from URL:", dryRun);
	log("Simulate mode from URL:", simulate);

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

		const u = new URL(location.href);
		u.searchParams.set("sort", sort);

		// Preserve all rco state parameters across navigation
		for (const key of ['rco_sort', 'rco_days', 'rco_dot', 'rco_dryrun', 'rco_simulate']) {
			const val = new URLSearchParams(window.location.search).get(key);
			if (val !== null) u.searchParams.set(key, val);
		}

		log("Final URL before navigation:", u.toString());
		if (u.toString() !== location.href) {
			log("Navigating to:", u.toString());
			location.href = u.toString();
		} else {
			log("URL unchanged, no navigation needed");
		}
		return false;
	}


	/***********************
	 * DATE FILTERING
	 ************************/

	function parseAgeDays(text) {
		const m = text.toLowerCase().match(/^(\d+)\s*(minute|hour|day|month|year)s?\s+ago$/);
		if (!m) return null;
		const n = parseInt(m[1], 10);
		switch (m[2]) {
			case 'minute': return n / 1440;
			case 'hour':   return n / 24;
			case 'day':    return n;
			case 'month':  return n * 30;
			case 'year':   return n * 365;
			default:       return null;
		}
	}

	function shouldSkipCommentByDate(commentElement) {
		const timeEl = commentElement.querySelector('time[datetime]');
		if (!timeEl) {
			log('shouldSkipCommentByDate: No time element, preserving');
			return true;
		}

		// Strategy 1: parse the human-readable text ("10 days ago") — avoids timezone issues
		const text = (timeEl.textContent || '').trim();
		if (text) {
			const age = parseAgeDays(text);
			if (age !== null) {
				log('shouldSkipCommentByDate: text="' + text + '" ageDays=' + age + ' preserveDays=' + daysToPreserve);
				return age <= daysToPreserve;
			}
		}

		// Strategy 2: fall back to datetime attribute parsing
		try {
			const raw = (timeEl.getAttribute('datetime') || '').trim();
			if (!raw) {
				log('shouldSkipCommentByDate: Empty datetime, preserving');
				return true;
			}
			const commentDate = new Date(raw);
			if (isNaN(commentDate.getTime())) {
				log('shouldSkipCommentByDate: Unparseable datetime "' + raw + '", preserving');
				return true;
			}
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - daysToPreserve);
			log('shouldSkipCommentByDate: fallback datetime comment=' + commentDate.toISOString() + ' cutoff=' + cutoff.toISOString());
			return commentDate >= cutoff;
		} catch (e) {
			log('shouldSkipCommentByDate: Error:', e);
			return true;
		}
	}

	function shouldSkipCommentByDot(commentElement) {
		if (!preserveDotComments) return false;

		try {
			// Narrow to the content area – prefer .usertext-body, fall back to .md
			const body = commentElement.querySelector('.usertext-body');
			const md = body || commentElement.querySelector('.md');
			if (!md) {
				log('shouldSkipCommentByDot: No .md found, not preserving');
				return false;
			}

			// Use innerText so block elements (<p>, <li>, etc.) produce \n between them.
			// textContent concatenates text nodes without separators, which makes dot-on-its-own-line
			// detection impossible when Reddit minifies the HTML.
			let raw = md.innerText || md.textContent || '';
			if (!raw.trim()) {
				log('shouldSkipCommentByDot: Empty comment text, not preserving');
				return false;
			}

			raw = raw.replace(/\r\n?/g, '\n');
			const lines = raw.split('\n')
				.map(l => l.replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ''))
				.filter(l => l.length > 0);
			if (!lines.length) {
				log('shouldSkipCommentByDot: No non-empty lines after cleaning, not preserving');
				return false;
			}

			if (lines[lines.length - 1] === '.') {
				log('shouldSkipCommentByDot: Preserving comment ending with dot');
				return true;
			}

			return false;
		} catch (e) {
			log('shouldSkipCommentByDot: Error:', e);
			return false;
		}
	}

	/***********************
	 * COMMENT DETECTION
	 ************************/
	function getDeleteButtons() {
		// More robust selector using data attribute and class
		const allButtons = [...document.querySelectorAll("a[data-event-action='delete'], a.togglebutton")]
			.filter(el => /delete/i.test(el.textContent));

		// Additionally filter to skip comments that are too recent
		const filtered = allButtons.filter(deleteBtn => {
				// Find the comment element that contains this delete button
				const commentElement = deleteBtn.closest('.comment, .thing, .entry, [id^=t1_]');
				if (!commentElement) {
					return true; // If we can't find the comment element, include the button
				}

				// Check if this comment should be skipped based on date or dot preservation
				const skipByDate = shouldSkipCommentByDate(commentElement);
				const skipByDot = shouldSkipCommentByDot(commentElement);
				const shouldSkip = skipByDate || skipByDot;

				if (shouldSkip) {
					log(`getDeleteButtons: Skipping comment (date: ${skipByDate}, dot: ${skipByDot})`);
				}

				return !shouldSkip;
			});

		log(`getDeleteButtons: ${allButtons.length} total buttons, ${filtered.length} after filtering`);
		return filtered;
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

		// Dry-run mode: log action without actually deleting
		if (dryRun) {
			log("DRY-RUN: Would delete comment");
			return true;
		}

		while (!success && running) {
			// Wait if we're currently rate limited
			await waitForRateLimit();

			try {
				btn.click();
				await sleep(300);

				if (simulate) {
					// Simulation mode: click "No" on confirmation to see what would be deleted
					const no = [...document.querySelectorAll("a.no, a.cancel, .option a")]
						.find(e => /^(no|cancel)$/i.test(e.textContent.trim()));
					const yes = [...document.querySelectorAll("a.yes, .option.error.active a")]
						.find(e => e.textContent.trim().toLowerCase() === "yes");
					if (no) {
						no.click();
						log("SIMULATE: Clicked No on confirmation — comment NOT deleted");
					} else if (yes) {
						// If there's a Yes button but no No button, try clicking the cancel/close action
						const cancel = document.querySelector('.delete-field.cancel a, a.cancel');
						if (cancel) {
							cancel.click();
							log("SIMULATE: Clicked cancel");
						} else {
							log("SIMULATE: Found Yes button but no No/Cancel button, skipping");
						}
					} else {
						log("SIMULATE: No confirmation dialog found");
					}
					await sleep(rand(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
					return true;
				}

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

		if (dryRun) {
			log("DRY-RUN: Found", deletes.length, "comments that would be deleted");
		} else if (simulate) {
			log("SIMULATE: Found", deletes.length, "comments that would be targeted");
		} else {
			log("Found", deletes.length, "comments to delete");
		}
		// Update status with number of comments found

		let deleted = 0;
		// Generate the initial pause target once (not per iteration like before)
		let nextPauseTarget = rand(LONG_DELAY_AFTER[0], LONG_DELAY_AFTER[1]);

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
			if (deleted >= nextPauseTarget) {
				const p = rand(LONG_DELAY_MS[0], LONG_DELAY_MS[1]);
				log("Long pause after", deleted, "deletions, waiting", p / 1000, "seconds");
				await sleep(p);
				// Set next pause target: another random interval from the current count
				nextPauseTarget = deleted + rand(LONG_DELAY_AFTER[0], LONG_DELAY_AFTER[1]);
			}
		}

		// handle old reddit pagination
		const nextBtn = document.querySelector("span.next-button a");
		if (nextBtn && running) {
			log("Next page →", nextBtn.href);
			location.href = nextBtn.href;
			return true;
		}

		// handle infinite scroll
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
		return true;
	}




	/*************************
	 * MAIN LOOP
	 ************************/
	async function main(isFreshStart = false) {
		// Always process all 4 sorts
		const activeSorts = SORTS;
		log("Processing all sorts:", activeSorts);

		// Determine if we're starting fresh or resuming
		const urlHasRunningState = getRunningStateFromUrl();
		let idx = 0;

		if (urlHasRunningState && !isFreshStart) {
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
			// Fresh start - always start from the first sort to ensure all sorts are processed
			log("Starting fresh — processing all sorts from the beginning");
			idx = 0;
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

		// Mark all previous sorts as completed if resuming from a middle position
		// (only on genuine resume, not on fresh start — fresh start must process ALL sorts)
		if (urlHasRunningState && !isFreshStart) {
			for (let i = 0; i < idx; i++) {
				if (i < activeSorts.length) {
					completedSorts.add(activeSorts[i]);
				}
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
					updateUrlState(false, '', undefined, preserveDotComments, dryRun);
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
					updateUrlState(running, nextSort, daysToPreserve, preserveDotComments, dryRun);
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
			}
		}
	}







	/***********************
	 * CONFIRMATION MODAL
	 ************************/
	function showConfirmationModal() {
		// Remove any existing modal first
		const existingModals = document.querySelectorAll('.rco-confirmation-modal');
		for (const existingModal of existingModals) {
			try {
				existingModal.remove();
			} catch (e) {
				// Ignore errors
			}
		}

		const modal = document.createElement("div");
		modal.className = 'rco-confirmation-modal';
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
		const modeText = simulate ? "SIMULATION MODE — comments will NOT be deleted" : "Comments WILL be permanently deleted";
		warning.innerHTML = `[${modeText}]<br><br>This will process all your Reddit comments across all sort types (new, hot, top, controversial). Comments from the last <span id='days-display'>${daysToPreserve}</span> days will be preserved. You can also preserve comments ending with a dot (.) on their own line.`;
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

		// Dot preservation checkbox
		const dotContainer = document.createElement("div");
		dotContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const dotCheckbox = document.createElement("input");
		dotCheckbox.type = "checkbox";
		dotCheckbox.id = "dot-preservation";
		dotCheckbox.checked = preserveDotComments;
		dotCheckbox.style.cssText = "width: 18px; height: 18px;";

		const dotLabel = document.createElement("label");
		dotLabel.htmlFor = "dot-preservation";
		dotLabel.textContent = "Preserve comments ending with a dot (.) on their own line";
		dotLabel.style.cssText = "font-weight: bold; cursor: pointer;";

		dotContainer.appendChild(dotCheckbox);
		dotContainer.appendChild(dotLabel);
		content.appendChild(dotContainer);

		// Update variable when checkbox changes
		dotCheckbox.addEventListener('change', () => {
			preserveDotComments = dotCheckbox.checked;
			log("Dot preservation setting changed to:", preserveDotComments);
		});

		// Dry-run checkbox
		const dryRunContainer = document.createElement("div");
		dryRunContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const dryRunCheckbox = document.createElement("input");
		dryRunCheckbox.type = "checkbox";
		dryRunCheckbox.id = "dry-run";
		dryRunCheckbox.checked = dryRun;
		dryRunCheckbox.style.cssText = "width: 18px; height: 18px;";

		const dryRunLabel = document.createElement("label");
		dryRunLabel.htmlFor = "dry-run";
		dryRunLabel.textContent = "Dry-run mode: log actions without actually deleting";
		dryRunLabel.style.cssText = "font-weight: bold; cursor: pointer;";

		dryRunContainer.appendChild(dryRunCheckbox);
		dryRunContainer.appendChild(dryRunLabel);
		content.appendChild(dryRunContainer);

		// Update variable when checkbox changes
		dryRunCheckbox.addEventListener('change', () => {
			dryRun = dryRunCheckbox.checked;
			log("Dry-run setting changed to:", dryRun);
		});

		// Simulation mode checkbox (only relevant when dry-run is off)
		const simContainer = document.createElement("div");
		simContainer.style.cssText = "margin-bottom: 20px; display: flex; align-items: center; gap: 10px;";

		const simCheckbox = document.createElement("input");
		simCheckbox.type = "checkbox";
		simCheckbox.id = "simulate-mode";
		simCheckbox.checked = simulate;
		simCheckbox.style.cssText = "width: 18px; height: 18px;";

		const simLabel = document.createElement("label");
		simLabel.htmlFor = "simulate-mode";
		simLabel.textContent = "Simulation mode: click No on confirmation (safe)";
		simLabel.style.cssText = "font-weight: bold; cursor: pointer;";

		simContainer.appendChild(simCheckbox);
		simContainer.appendChild(simLabel);
		content.appendChild(simContainer);

		// Update variable when checkbox changes
		simCheckbox.addEventListener('change', () => {
			simulate = simCheckbox.checked;
			log("Simulation mode changed to:", simulate);
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
			try {
				modal.remove();
			} catch (e) {
				// Ignore errors
			}
			// Keep button as "Start Deleting"
		};

		// Handle confirm button
		confirmBtn.onclick = () => {
			if (mainRunning) {
				log("A deletion session is already active, ignoring confirm");
				return;
			}
			try {
				modal.remove();
			} catch (e) {
				// Ignore errors
			}
			running = true;
			updateButtonState();

			// Calculate starting sort and update URL
			const currentSort = getCurrentSort();
			updateUrlState(running, currentSort, daysToPreserve, preserveDotComments, dryRun);

			mainRunning = true;
			main(true).finally(() => { mainRunning = false; }); // true = fresh start — process ALL 4 sorts
		};
	}

	/***********************
	 * BUTTON
	 ************************/
	const btn = document.createElement("button");
	btn.innerHTML = '<span style="font-weight: bold; font-size: 11px; opacity: 0.8; margin-right: 6px;">Reddit Comments Overkill</span><span class="btn-text">Start Deleting</span>';
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
			btn.innerHTML = '<span style="font-weight: bold; font-size: 11px; opacity: 0.8; margin-right: 6px;">Reddit Comments Overkill</span><span class="btn-text">Start Deleting</span>';
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

	// Guard to prevent multiple concurrent main() loops
	let mainRunning = false;

	btn.onclick = () => {
		if (!running) {
			// Prevent starting another main() instance if one is still active
			if (mainRunning) {
				log("A deletion session is already active, ignoring click");
				return;
			}
			// Starting fresh - check if we need confirmation
			if (getRunningStateFromUrl()) {
				// Already has rco_sort parameter - resume without confirmation
				running = true;
				updateButtonState();
				mainRunning = true;
				main().finally(() => { mainRunning = false; });
			} else {
				// Fresh start - show confirmation modal
				showConfirmationModal();
			}
		} else {
			// Stopping
			running = false;
			updateUrlState(false, '', undefined, preserveDotComments, dryRun);
			updateButtonState();
		}
	};

	// Check if the script should start automatically based on URL state
	if (getRunningStateFromUrl()) {
		log("Resuming from previous state");
		running = true; // Ensure running is true when resuming
		// Update button to reflect running status
		updateButtonState();
		mainRunning = true;
		main().finally(() => { mainRunning = false; });
	}

})();

