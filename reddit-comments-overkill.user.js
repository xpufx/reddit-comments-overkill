// ==UserScript==
// @name         Reddit Comment Overkill — Stable Sort Cycling Edition
// @namespace    https://example.com/
// @version      2.21
// @description  Deletes all comments by cycling sorts reliably, retrying on rate limits, waiting for comments, handling infinite scroll & next page, with Start/Stop control.
// @match        https://old.reddit.com/user/*/comments*
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
	const SORTS = ["new", "hot", "top", "controversial"];
	const WAIT_FOR_COMMENTS_MS = 8000;
	const RATE_LIMIT_MIN = 60000;
	const RATE_LIMIT_MAX = 1800000;
	const SHORT_DELAY_MIN = 2000;
	const SHORT_DELAY_MAX = 2000;
	const LONG_DELAY_AFTER = [3, 6];
	const LONG_DELAY_MS = [15000, 30000];
	const DAYS_TO_PRESERVE = 10; // Keep comments from the last N days

	// Logging function to consistently identify our script
	function log(message, ...args) {
		const logMessage = "[" + SCRIPT_NAME + "] " + message;
		console.log(logMessage, ...args);
		// Also update status display with log message if it's initialized
		if (typeof statusDisplay !== 'undefined' && statusDisplay && typeof statusDisplay.addLogMessage === 'function') {
			statusDisplay.addLogMessage(logMessage + (args.length > 0 ? " " + args.join(" ") : ""));
		}
	}

	// Use URL parameter to maintain state across page reloads
	function getRunningStateFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get('comment_overkill_running') === 'true';
	}

	function getSortIndexFromUrl() {
		const urlParams = new URLSearchParams(window.location.search);
		const index = parseInt(urlParams.get('comment_overkill_sort_index'), 10);
		return isNaN(index) ? 0 : index;
	}

	function updateUrlState(isRunning, sortIndex) {
		if (isRunning) {
			const urlParams = new URLSearchParams(window.location.search);
			urlParams.set('comment_overkill_running', 'true');
			urlParams.set('comment_overkill_sort_index', sortIndex.toString());

			// Update URL without reloading
			const newUrl = window.location.pathname + "?" + urlParams.toString() + window.location.hash;
			history.replaceState({}, document.title, newUrl);
		} else {
			// Remove parameters when not running
			const urlParams = new URLSearchParams(window.location.search);
			urlParams.delete('comment_overkill_running');
			urlParams.delete('comment_overkill_sort_index');

			const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
			history.replaceState({}, document.title, newUrl);
		}
	}

	// Initialize running state from URL
	let running = getRunningStateFromUrl();
	
	// Debug logging - use console.log directly to avoid circular dependency
	console.log("[" + SCRIPT_NAME + "] Script loaded - URL parameters:", window.location.search);
	console.log("[" + SCRIPT_NAME + "] Running state from URL:", running);
	console.log("[" + SCRIPT_NAME + "] Current sort index from URL:", getSortIndexFromUrl());

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
			// Update status to show rate limit state
			statusDisplay.updateField('rateLimit', 'Active - waiting...');
			await sleep(5000); // Check every 5 seconds
		}
		// Clear rate limit status when no longer rate limited
		statusDisplay.updateField('rateLimit', '');
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
			log("RATE LIMIT detected (429)");
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


	/***********************
	 * DETECT SORT ON PAGE
	 ************************/
	function getCurrentSort() {
		try {
			// First try to get from URL
			const u = new URL(location.href);
			const urlSort = u.searchParams.get("sort");
			if (urlSort) {
				return urlSort;
			}

			// If not in URL, try to detect from the UI
			const selectedSortElement = document.querySelector('.dropdown.lightdrop .selected, .dropdown.sorts .selected, [data-sort-direction].active');
			if (selectedSortElement) {
				const sortText = selectedSortElement.textContent.trim().toLowerCase();
				// Verify it's a valid sort option
				if (SORTS.includes(sortText)) {
					return sortText;
				}
			}

			// Default to "new" if we can't determine
			return "new";
		} catch {
			return "new";
		}
	}

	function gotoSort(sort) {
		log("Switching sort →", sort, "via URL navigation");
		log("Current URL state - running:", running, "sort index:", getSortIndexFromUrl());
		
		// Always use URL navigation to ensure state is preserved
		const u = new URL(location.href);
		log("Original URL:", location.href);
		u.searchParams.set("sort", sort);
		log("Sort parameter set to:", sort);
		log("URL after setting sort:", u.toString());
		
		// Preserve our state parameters
		if (running) {
			const currentSortIndex = getSortIndexFromUrl();
			log("Adding URL parameters - running:", true, "sort index:", currentSortIndex);
			u.searchParams.set("comment_overkill_running", "true");
			u.searchParams.set("comment_overkill_sort_index", currentSortIndex.toString());
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
		// Get the time element associated with this comment
		const timeElement = commentElement.querySelector('time[datetime]');
		if (!timeElement) {
			// If no time element found, we can't determine the date, so don't skip
			return false;
		}
		
		try {
			const commentDateTime = new Date(timeElement.getAttribute('datetime'));
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_PRESERVE);
			
			// If comment is newer than the cutoff date, skip it (don't delete)
			const shouldSkip = commentDateTime > cutoffDate;
			
			if (shouldSkip) {
				preservedCount++;
				// Update status display
				statusDisplay.updateField('recentPreserved', preservedCount);
			}
			
			return shouldSkip;
		} catch (e) {
			// If we can't parse the date, don't skip the comment
			return false;
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
			statusDisplay.updateField('commentsFound', '0 (waiting)');
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
		statusDisplay.updateField('commentsFound', deletes.length);

		let deleted = 0;

		for (const btn of deletes) {
			if (!running) break;

			// Wait for potential rate limit before each deletion
			await waitForRateLimit();
			
			const success = await deleteComment(btn);
			if (success) {
				deleted++;
				// Update status with number of deleted comments
				statusDisplay.updateField('commentsDeleted', deleted);
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
			await sleep(30000); // 30 second wait before navigation
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
		// Use selected sorts if available, otherwise default to all sorts
		const activeSorts = Object.keys(selectedSortTypes).length > 0 
			? SORTS.filter(sort => selectedSortTypes[sort]) 
			: SORTS;
		
		log("activeSorts after filtering:", activeSorts, "selectedSortTypes keys:", Object.keys(selectedSortTypes));
		
		if (activeSorts.length === 0) {
			log("No sorts selected, nothing to process.");
			statusDisplay.updateField('status', 'No sorts selected');
			btn.textContent = "Start Deleting";
			return;
		}

		// Use URL parameter for sort index as primary source when resuming
		// Check if we're resuming based on URL parameters, not the running variable
		const isResuming = getRunningStateFromUrl();
		let idx = 0;
		
		if (isResuming) {
			// When resuming from URL state
			const urlIdx = getSortIndexFromUrl();
			// Find the corresponding sort in activeSorts
			if (urlIdx > 0 && urlIdx <= SORTS.length) {
				const urlSort = SORTS[urlIdx - 1]; // Adjust for 0-based index
				if (urlSort && activeSorts.includes(urlSort)) {
					idx = activeSorts.indexOf(urlSort);
				} else {
					// If the URL sort isn't in active sorts, find the next valid one
					for (let i = 0; i < activeSorts.length; i++) {
						const activeSortOriginalIndex = SORTS.indexOf(activeSorts[i]);
						if (activeSortOriginalIndex >= (urlIdx - 1)) {
							idx = i;
							break;
						}
					}
				}
			}
		} else {
			// When starting fresh, check current page's sort and start from there if it's selected
			const currentSort = getCurrentSort();
			log("Current page sort:", currentSort, "selectedSortTypes:", selectedSortTypes);
			
			if (selectedSortTypes[currentSort]) {
				// Find the index of the current sort in activeSorts
				const currentSortIndex = activeSorts.indexOf(currentSort);
				if (currentSortIndex !== -1) {
					idx = currentSortIndex;
					log("Starting from current sort:", currentSort);
				} else {
					log("Current sort not found in activeSorts, starting from first selected sort");
				}
			} else if (Object.keys(selectedSortTypes).length === 0) {
				// If no sorts were specifically selected (shouldn't happen when starting fresh via modal,
				// but could happen in other scenarios), start from current sort if it's in the default list
				if (activeSorts.includes(currentSort)) {
					const currentSortIndex = activeSorts.indexOf(currentSort);
					if (currentSortIndex !== -1) {
						idx = currentSortIndex;
						log("Starting from current sort (fallback):", currentSort);
					}
				}
			} else {
				// If current sort is not selected, find the first selected sort that appears after current sort in original order
				const currentSortOriginalIndex = SORTS.indexOf(currentSort);
				for (let i = 0; i < activeSorts.length; i++) {
					const activeSortOriginalIndex = SORTS.indexOf(activeSorts[i]);
					if (activeSortOriginalIndex >= currentSortOriginalIndex) {
						idx = i;
						log("Current sort not selected, starting from:", activeSorts[idx]);
						break;
					}
				}
			}
		}

		log("Starting from sort index: " + idx + " (" + (activeSorts[idx] || 'unknown') + ")");
		log("Current URL state - running: " + running + ", sort index: " + idx);
		log("Active sorts:", activeSorts);

		// Update status display
		statusDisplay.updateField('status', 'Running');
		statusDisplay.updateField('currentSort', activeSorts[idx] || 'unknown');
		statusDisplay.updateField('sortProgress', (idx + 1) + '/' + activeSorts.length);

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
					statusDisplay.updateField('status', 'Complete - All sorts processed');
					updateUrlState(false, 0);
					btn.textContent = "Start Deleting";
					log("All selected sorts completed, clearing state");
					break;
				}

				const sort = activeSorts[idx];

				log("Processing sort: " + sort + " at index: " + idx);
				statusDisplay.updateField('currentSort', sort);
				const finished = await runSort(sort);
				if (!running) break;

				if (finished) {
					completedSorts.add(sort);
					idx++;
					log("Finished " + sort + " sort, advancing to index: " + idx);
					// Update URL state for page reload recovery using the original SORTS index
					const totalSortsIndex = SORTS.indexOf(sort) + 1;
					updateUrlState(running, totalSortsIndex);
					log("Updated URL state - running: " + running + ", sort index: " + totalSortsIndex);
					// Update progress in status display
					statusDisplay.updateField('sortProgress', (idx + 1) + '/' + activeSorts.length);
				}
				
				if (idx >= activeSorts.length) {
					log("ALL SELECTED SORTS PROCESSED — no more comments.");
					running = false;
					// Update status and button state when all sorts are complete
					statusDisplay.updateField('status', 'Complete - All sorts processed');
					updateUrlState(false, 0);
					btn.textContent = "Start Deleting";
					log("All selected sorts completed, clearing state");
					break;
				}

				await sleep(5000);
			} catch (error) {
				log("Error in main loop:", error);
				// Update status to show error
				statusDisplay.updateField('status', 'Error occurred - pausing');
				// Wait before continuing to avoid getting stuck in an error loop
				await sleep(10000);
				// Resume status after error pause
				if (running) {
					statusDisplay.updateField('status', 'Running');
				}
			}
		}
	}


	/***********************
	 * STATUS DISPLAY
	 ************************/
	const statusDisplay = {
		container: null,
		fields: {},
		logMessages: [],
		maxLogMessages: 10, // Keep only the last 10 log messages
		
		init() {
			// Create status container below the main button
			this.container = document.createElement("div");
			this.container.id = "reddit-overkill-status";
			this.container.style.cssText = `
				position: fixed;
				bottom: 60px;
				right: 15px;
				background: rgba(0, 0, 0, 0.85);
				color: white;
				padding: 10px 15px;
				border-radius: 6px;
				font-family: Arial, sans-serif;
				font-size: 12px;
				z-index: 999998;
				min-width: 200px;
				max-width: 300px;
				max-height: 150px;
				overflow-y: auto;
				box-shadow: 0 2px 10px rgba(0,0,0,0.3);
			`;
			
			// Initially hide the status container
			this.container.style.display = "none";
			document.body.appendChild(this.container);
		},
		
		registerField(key, label, value = "") {
			this.fields[key] = { label, value };
		},
		
		updateField(key, value) {
			if (this.fields[key]) {
				this.fields[key].value = value;
				this.render();
			}
		},
		
		addLogMessage(message) {
			// Add new message to log at the top
			const timestamp = new Date().toLocaleTimeString();
			this.logMessages.unshift(`[${timestamp}] ${message}`);
			
			// Keep only the most recent messages (newest first)
			if (this.logMessages.length > this.maxLogMessages) {
				this.logMessages = this.logMessages.slice(0, this.maxLogMessages);
			}
			
			// Update the display
			this.render();
		},
		
		render() {
			if (!this.container) return;
			
			const statusLines = [];
			// Add field-based status information first
			for (const [key, field] of Object.entries(this.fields)) {
				if (field.value !== "" && field.value !== null && field.value !== undefined) {
					statusLines.push(`${field.label}: ${field.value}`);
				}
			}
			
			// Add a separator if both fields and log messages exist
			if (statusLines.length > 0 && this.logMessages.length > 0) {
				statusLines.push("---");
			}
			
			// Add log messages
			statusLines.push(...this.logMessages);
			
			if (statusLines.length > 0) {
				this.container.innerHTML = statusLines.join("<br>");
				this.container.style.display = "block";
			} else {
				this.container.style.display = "none";
			}
		},
		
		show() {
			if (this.container) {
				this.container.style.display = "block";
			}
		},
		
		hide() {
			if (this.container) {
				this.container.style.display = "none";
			}
		}
	};

	// Initialize status display
	statusDisplay.init();
	
	// Register initial status fields
	statusDisplay.registerField('status', 'Status');
	statusDisplay.registerField('currentSort', 'Current Sort');
	statusDisplay.registerField('commentsFound', 'Comments Found');
	statusDisplay.registerField('commentsDeleted', 'Comments Deleted');
	statusDisplay.registerField('recentPreserved', 'Recent Preserved');
	statusDisplay.registerField('rateLimit', 'Rate Limit Status');
	statusDisplay.registerField('sortProgress', 'Sort Progress');

	/***********************
	 * SORT SELECTION MODAL
	 ************************/
	function createSortSelectionModal() {
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
		title.textContent = "Select Sort Types to Delete From";
		title.style.cssText = "margin-top: 0; margin-bottom: 15px;";
		content.appendChild(title);
		
		const checkboxesContainer = document.createElement("div");
		checkboxesContainer.style.cssText = "margin-bottom: 20px;";
		
		// Create checkboxes for each sort type
		const selectedSorts = {};
		for (const sort of SORTS) {
			const checkboxDiv = document.createElement("div");
			checkboxDiv.style.cssText = "margin-bottom: 8px; display: flex; align-items: center;";
			
			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = `sort-${sort}`;
			checkbox.value = sort;
			checkbox.checked = true; // Default to checked
			selectedSorts[sort] = true;
			
			const label = document.createElement("label");
			label.htmlFor = `sort-${sort}`;
			label.textContent = sort.charAt(0).toUpperCase() + sort.slice(1); // Capitalize first letter
			label.style.cssText = "margin-left: 8px;";
			
			checkboxDiv.appendChild(checkbox);
			checkboxDiv.appendChild(label);
			checkboxesContainer.appendChild(checkboxDiv);
			
			// Update selectedSorts when checkbox changes
			checkbox.addEventListener('change', function() {
				selectedSorts[sort] = this.checked;
			});
		}
		
		content.appendChild(checkboxesContainer);
		
		const buttonContainer = document.createElement("div");
		buttonContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px;";
		
		const startBtn = document.createElement("button");
		startBtn.textContent = "Start Deleting";
		startBtn.style.cssText = `
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
		buttonContainer.appendChild(startBtn);
		content.appendChild(buttonContainer);
		modal.appendChild(content);
		
		// Add modal to document
		document.body.appendChild(modal);
		
		// Handle cancel button
		cancelBtn.onclick = () => {
			running = false; // Reset running state when canceling
			document.body.removeChild(modal);
			// Reset the button text back to Start Deleting
			btn.textContent = "Start Deleting";
		};
		
		// Handle start button
		startBtn.onclick = () => {
			// Save selected sorts to a global variable or pass to the main function
			selectedSortTypes = selectedSorts;
			// Make sure running is true when starting
			running = true;
			// Update URL state to indicate we're running
			updateUrlState(running, 0);
			
			document.body.removeChild(modal);
			
			// Update button text after starting
			btn.textContent = "Stop Deleting";
			
			// Update status when starting
			statusDisplay.updateField('status', 'Running');
			
			// Start the main loop with selected sorts
			main();
		};
		
		return modal;
	}

	/***********************
	 * BUTTON
	 ************************/
	const btn = document.createElement("button");
	btn.textContent = "Start Deleting";
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
		zIndex: 999999
	});
	document.body.appendChild(btn);

	// Store references for cleanup
	let selectedSortTypes = {}; // Store user's selected sorts

	// Set initial button state based on URL running state
	btn.textContent = getRunningStateFromUrl() ? "Stop Deleting" : "Start Deleting";

	btn.onclick = () => {
		running = !running;
		if (running) {
			// Show sort selection modal when starting fresh
			// If resuming from URL state, skip modal and directly start main()
			if (getRunningStateFromUrl()) {
				// If resuming, use default selectedSortTypes for all sorts
				for (const sort of SORTS) {
					selectedSortTypes[sort] = true;
				}
				btn.textContent = "Stop Deleting";
				statusDisplay.updateField('status', 'Running');
				main();
			} else {
				// Show sort selection modal when starting fresh
				createSortSelectionModal();
			}
		} else {
			// Update status when stopping
			statusDisplay.updateField('status', 'Stopped');
			updateUrlState(false, 0);
			btn.textContent = "Start Deleting";
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
		btn.textContent = "Stop Deleting";
		
		// When resuming, use all sorts by default
		for (const sort of SORTS) {
			selectedSortTypes[sort] = true;
		}
		
		main();
	}

})();

