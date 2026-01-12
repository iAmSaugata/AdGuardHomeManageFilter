// Live Query Log View
// Displays realtime DNS queries and allows quick actions

import { escapeHtml } from '../utils.js';

let pollingInterval = null;
let isPaused = false;
let currentServerId = null;
// Cache to restore view state instantly
let cachedLogs = [];
// Track rendered IDs to prevent duplicates (moved to top scope)
const renderedLogKeys = new Set();
// Store current search query to preserve it when navigating
let currentSearchQuery = '';

export async function renderQueryLog(container, data) {
    if (!data || !data.serverId) {
        window.app.showToast('Error: No server specified', 'error');
        window.app.navigateTo('server-list');
        return;
    }

    currentServerId = data.serverId;
    isPaused = false;

    // Reset rendered keys because we are creating a fresh DOM
    renderedLogKeys.clear();

    const hasCache = cachedLogs.length > 0;

    // Set the base HTML structure
    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-icon-btn" id="back-btn" title="Back">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div class="header-title app-title" style="flex:1; text-align: center; font-size: 16px;">LIVE QUERY</div>
                <button class="header-icon-btn state-playing" id="play-pause-btn" title="Pause Live Log">
                    <svg id="pause-icon" viewBox="0 0 24 24" width="18" height="18" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>
                    <svg id="play-icon" viewBox="0 0 24 24" width="18" height="18" fill="white" class="hidden"><path d="M5 3l14 9-14 9V3z"/></svg>
                </button>
            </div>

            <div class="search-bar-container" style="padding: 12px 16px; border-bottom: 1px solid var(--color-border); background-color: var(--color-bg-secondary);">
                <div style="position: relative; width: 100%;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none;">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="log-search" placeholder="Search Query" class="header-search-input" value="${escapeHtml(currentSearchQuery)}" style="width:100%; height: 30px; background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: 6px; padding: 0 30px 0 30px; color: var(--color-text-primary); font-size: 12px; line-height: 30px;">
                    <button id="search-clear-btn" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 4px; cursor: pointer; display: none; color: var(--color-text-tertiary);">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>

            <div class="view-body" style="padding: 0; display: flex; flex-direction: column; overflow: hidden;">
                <div id="log-list-container" style="flex: 1; overflow-y: auto; padding: 0 8px 8px 8px;">
                     <!-- Logs go here -->
                     ${hasCache ? '' : `
                     <div class="debug-loading" style="min-height: 200px;">
                        <div class="shield-loader">
                            <div class="pulse-ring"></div>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shield-icon">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <div class="loading-text">Connecting to AdGuard Home...</div>
                        <div class="loading-subtext">Initializing secure telemetry stream</div>
                     </div>
                     `}
                </div>
            </div>
        </div>
        
        <style>
            .log-item-new {
                display: flex;
                align-items: center;
                padding: 10px 12px;
                margin: 0;
                background: transparent;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                border-left: 3px solid transparent;
                border-right: 3px solid transparent;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .log-item-new:hover {
                background: rgba(255,255,255,0.02);
            }
            
            .log-item-new.status-blocked {
                border-left-color: rgba(255, 77, 77, 0.3);
                border-right-color: rgba(255, 77, 77, 0.3);
            }
            .log-item-new.status-blocked:hover {
                border-left-color: #ff4d4d;
                border-right-color: #ff4d4d;
                background: rgba(255, 77, 77, 0.03);
            }
            
            .log-item-new.status-allowed {
                border-left-color: rgba(66, 211, 146, 0.3);
                border-right-color: rgba(66, 211, 146, 0.3);
            }
            .log-item-new.status-allowed:hover {
                border-left-color: #42d392;
                border-right-color: #42d392;
                background: rgba(66, 211, 146, 0.03);
            }
            
            .log-item-new.status-rewritten {
                border-left-color: rgba(56, 189, 248, 0.3);
                border-right-color: rgba(56, 189, 248, 0.3);
            }
            .log-item-new.status-rewritten:hover {
                border-left-color: #38bdf8;
                border-right-color: #38bdf8;
                background: rgba(56, 189, 248, 0.03);
            }
            
            .log-item-new.status-processed {
                border-left-color: rgba(255, 255, 255, 0.1);
                border-right-color: rgba(255, 255, 255, 0.1);
            }
            .log-item-new.status-processed:hover {
                border-left-color: rgba(255, 255, 255, 0.3);
                border-right-color: rgba(255, 255, 255, 0.3);
                background: rgba(255, 255, 255, 0.02);
            }
            
            .debug-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                min-height: 300px;
                color: var(--color-text-primary);
                animation: fade-in 0.5s ease-out;
            }

            .shield-loader {
                position: relative;
                width: 80px;
                height: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 24px;
            }

            .shield-icon {
                width: 48px;
                height: 48px;
                color: var(--color-accent);
                z-index: 2;
                filter: drop-shadow(0 0 12px rgba(66, 211, 146, 0.5));
            }

            .pulse-ring {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                border: 2px solid var(--color-accent);
                opacity: 0;
                animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
            }

            .loading-text {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 8px;
                letter-spacing: 0.5px;
            }

            .loading-subtext {
                font-size: 12px;
                color: var(--color-text-secondary);
                opacity: 0.8;
            }

            @keyframes pulse-ring {
                0% { transform: scale(0.8); opacity: 0.8; }
                100% { transform: scale(2.2); opacity: 0; }
            }

            @keyframes fade-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes slide-in {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .slide-in {
                animation: slide-in 0.2s ease-out;
            }
        </style>
    `;

    // Event Listeners
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            stopPolling();
            window.app.navigateTo('server-list');
        });
    }

    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', togglePlayPause);
    }

    const searchInput = document.getElementById('log-search');
    const clearBtn = document.getElementById('search-clear-btn');

    if (searchInput) {
        // Debounce fetchLogs
        const debouncedFetch = debounce((val) => {
            fetchLogs(val);
        }, 500);

        searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            currentSearchQuery = val; // Store the search query
            debouncedFetch(val);

            // Toggle Clear Button
            if (clearBtn) {
                clearBtn.style.display = val ? 'block' : 'none';
            }
        });

        // Initialize Clear Button State
        if (clearBtn && searchInput.value) {
            clearBtn.style.display = 'block';
        }
    }

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            currentSearchQuery = ''; // Clear stored query
            searchInput.focus();
            fetchLogs(''); // Immediate fetch on clear
            clearBtn.style.display = 'none';
        });
    }

    // Render Cache Immediately if available
    if (hasCache) {
        renderLogList(cachedLogs);
    }

    // Start Polling
    startPolling();
}

function togglePlayPause() {
    isPaused = !isPaused;
    updatePlayPauseButton();

    if (isPaused) {
        stopPolling();
    } else {
        startPolling();
    }
}

function updatePlayPauseButton() {
    const btn = document.getElementById('play-pause-btn');
    if (!btn) return;

    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');

    // Reset classes
    btn.classList.remove('state-playing', 'state-paused');

    if (isPaused) {
        // Paused state: Show Play Icon (Green Button)
        btn.title = "Resume Live Log";
        btn.classList.add('state-paused'); // Green
        if (playIcon) playIcon.classList.remove('hidden');
        if (pauseIcon) pauseIcon.classList.add('hidden');
    } else {
        // Playing state: Show Pause Icon (Red Button)
        btn.title = "Pause Live Log";
        btn.classList.add('state-playing'); // Red
        if (playIcon) playIcon.classList.add('hidden');
        if (pauseIcon) pauseIcon.classList.remove('hidden');
    }
}

function startPolling() {
    stopPolling(); // Ensure no duplicates
    isPaused = false;
    updatePlayPauseButton();

    // Initial fetch
    const searchInput = document.getElementById('log-search');
    const query = searchInput ? searchInput.value : '';
    fetchLogs(query);

    // Poll every 2 seconds
    pollingInterval = setInterval(() => {
        if (!isPaused) {
            const currentQuery = document.getElementById('log-search') ? document.getElementById('log-search').value : '';
            fetchLogs(currentQuery);
        }
    }, 1000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

async function fetchLogs(searchQuery) {
    if (!currentServerId) return;

    try {
        const result = await window.app.sendMessage('getQueryLog', {
            serverId: currentServerId,
            params: {
                limit: 100, // Fetch 100 for context
                search: searchQuery
            }
        });

        if (result && result.data) {
            cachedLogs = result.data; // Update Cache
            renderLogList(result.data);
        }
    } catch (error) {
        console.error('Failed to fetch logs:', error);
    }
}

function renderLogList(logs) {
    const container = document.getElementById('log-list-container');
    if (!container) return; // View changed

    // Remove loading state if it exists
    const loadingState = container.querySelector('.debug-loading');
    if (loadingState) loadingState.remove();

    if (!logs || logs.length === 0) {
        if (container.children.length === 0) {
            container.innerHTML = '<div class="empty-state-text" style="padding:40px; text-align:center; color: var(--color-text-tertiary);">No queries found</div>';
        }
        return;
    }

    // Remove empty state if it exists and we have logs
    const emptyState = container.querySelector('.empty-state-text');
    if (emptyState) emptyState.remove();

    // 1. Identify New Logs
    // We reverse the logs array so we process oldest to newest, 
    // but since we prepend, we want to process newest to oldest to keep order correct? 
    // actually logs usually come Newest First from API.
    // So we iterate them in reverse (Oldest -> Newest) and prepend them? 
    // No, if logs are [New1, New2, Old1..], we want New1 at top, New2 after.
    // But since we are PREPENDING, if we prepend New2 then New1, New1 will be on top. Correct.
    // So we iterate in reverse order of the slice that is new.

    // Let's simplified: New logs are at `logs[0]`, `logs[1]`.
    // We want to prepend `logs[1]`, then `logs[0]` so `logs[0]` ends up at top.

    const newLogs = [];

    logs.forEach(log => {
        // Create unique key
        const key = `${log.time}-${log.question.name}-${log.client}-${log.status}`;
        if (!renderedLogKeys.has(key)) {
            newLogs.push({ log, key });
            renderedLogKeys.add(key);
        }
    });

    // If no new logs, do nothing (smooth!)
    if (newLogs.length === 0) return;

    // Process new logs in reverse order (Oldest New -> Newest New)
    // so that when we prepend them one by one, the Newest ends up at the very top.

    // Example: API returns [A, B, C]. We have C. New are [A, B].
    // We prepend B. List: [B, C].
    // We prepend A. List: [A, B, C]. Correct.

    newLogs.reverse().forEach(({ log, key }) => {
        const item = document.createElement('div');
        item.dataset.key = key; // Store key for reference

        // --- RENDER CONTENT (Same as before) ---
        const time = new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const domain = log.question.name || 'Unknown';

        let clientDisplay = log.client || 'Unknown';
        if (log.client_info && log.client_info.name && log.client_info.name.length > 0) {
            clientDisplay = log.client_info.name;
        }

        const status = log.status || 'Processed';
        const lowerStatus = status.toLowerCase();

        // Classification
        let type = 'Processed';
        const hasExceptionRule = log.rules && log.rules.some(r => r.text && r.text.trim().startsWith('@@'));

        if (lowerStatus.includes('rewrite') || (log.reason && log.reason.toLowerCase().includes('rewrite'))) {
            type = 'Rewritten';
        } else if (lowerStatus.includes('white') || lowerStatus.includes('allow') || hasExceptionRule) {
            type = 'Allowed';
        } else if (
            lowerStatus.includes('block') ||
            lowerStatus.includes('safebrowsing') ||
            lowerStatus.includes('parental') ||
            lowerStatus.includes('filteredblacklist') ||
            (log.rules && log.rules.length > 0)
        ) {
            type = 'Blocked';
        }

        // Visuals
        let statusColorClass = 'text-white';
        let iconSvg = '';

        if (type === 'Rewritten') {
            statusColorClass = 'text-sky';
            iconSvg = `<svg class="log-status-icon text-sky" viewBox="0 0 24 24" fill="none" style="width:20px; height:20px;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.12"/><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>`;
        } else if (type === 'Allowed') {
            statusColorClass = 'text-success';
            iconSvg = `<svg class="log-status-icon text-success" viewBox="0 0 24 24" fill="none" style="width:20px; height:20px;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.12"/><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else if (type === 'Blocked') {
            statusColorClass = 'text-danger';
            iconSvg = `<svg class="log-status-icon text-danger" viewBox="0 0 24 24" fill="none" style="width:20px; height:20px;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.12"/><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else {
            statusColorClass = 'text-white';
            iconSvg = `<svg class="log-status-icon text-white" viewBox="0 0 24 24" fill="none" style="width:20px; height:20px;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.12"/><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }

        let reasonText = 'No rules';
        if (log.rules && log.rules.length > 0) {
            reasonText = type === 'Allowed' ? 'Whitelist' : (type === 'Blocked' ? 'Blacklist' : 'Custom');
        } else if (type === 'Allowed') {
            reasonText = 'Whitelist';
        } else if (type === 'Rewritten') {
            reasonText = 'Rewritten';
        } else {
            reasonText = (log.reason === 'NotFilteredNotFound' || !log.reason) ? 'Processed' : log.reason;
        }

        // Set status class based on type
        item.className = 'log-item-new slide-in';
        if (type === 'Blocked') {
            item.className += ' status-blocked';
        } else if (type === 'Allowed') {
            item.className += ' status-allowed';
        } else if (type === 'Rewritten') {
            item.className += ' status-rewritten';
        } else {
            item.className += ' status-processed';
        }

        item.innerHTML = `
            <div class="log-left-col">
                <div class="log-domain-name ${statusColorClass}" title="${escapeHtml(domain)}">${escapeHtml(domain)}</div>
                <div class="log-meta-row">
                    <div class="log-meta-item">
                        <svg class="log-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        <span>${escapeHtml(clientDisplay)}</span>
                    </div>
                    <div class="log-meta-item" style="opacity: 0.5; margin: 0 4px;">|</div>
                    <div class="log-meta-item">
                        <svg class="log-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>${time}</span>
                    </div>
                </div>
            </div>
            <div class="log-right-col">
                <div class="log-status-row ${statusColorClass}">
                        ${iconSvg}
                </div>
                <div class="log-reason ${statusColorClass}" style="opacity: 0.8;">
                    ${reasonText}
                </div>
            </div>
        `;

        // Click Handler
        item.addEventListener('click', () => {
            stopPolling();
            window.app.navigateTo('log-detail', {
                log: log,
                serverId: currentServerId
            });
        });

        // Prepend to container
        container.insertBefore(item, container.firstChild);
    });

    // Cleanup: Remove old logs if > 100
    while (container.children.length > 100) {
        const lastChild = container.lastChild;
        if (lastChild && lastChild.dataset && lastChild.dataset.key) {
            renderedLogKeys.delete(lastChild.dataset.key);
        }
        container.removeChild(lastChild);
    }
}

// Utilities
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
