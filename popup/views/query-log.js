// Live Query Log View
// Displays realtime DNS queries and allows quick actions

import { escapeHtml, formatCount, classifyRule } from '../utils.js';
import { renderAddRuleSection } from './add-rule.js';
import { Logger } from '../utils/logger.js';

let pollingInterval = null;
let isPaused = false;
let currentServerId = null;
let lastLogTime = ''; // For "new" badges if needed, or simple dedup logic

export async function renderQueryLog(container, data) {
    if (!data || !data.serverId) {
        window.app.showToast('Error: No server specified', 'error');
        window.app.navigateTo('server-list');
        return;
    }

    currentServerId = data.serverId;
    isPaused = false;

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-back-btn" id="back-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    <span>Back</span>
                </button>
                <div class="header-search-container" style="flex:1; margin: 0 10px;">
                    <input type="text" id="log-search" placeholder="Search logs..." class="header-search-input" style="width:100%; height: 28px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 4px; padding: 0 8px; color: var(--color-text-primary); font-size: 12px;">
                </div>
                <button class="header-icon-btn" id="play-pause-btn" title="Pause Live Log">
                    <svg id="pause-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    <svg id="play-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="hidden"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
            </div>

            <div class="view-body" style="padding: 0; display: flex; flex-direction: column; overflow: hidden;">
                <div id="log-list-container" style="flex: 1; overflow-y: auto; padding: 8px;">
                     <!-- Logs go here -->
                     <div class="debug-loading" style="padding: 20px; text-align: center; color: var(--color-text-secondary);">
                        <div class="spinner"></div> Connecting to Live Log...
                     </div>
                </div>
            </div>
            
            <!-- Overlay for Add Rule -->
            <div id="add-rule-overlay" class="hidden" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--color-bg-primary); z-index: 50; display: flex; flex-direction: column;">
                 <div style="padding: 10px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; background: var(--color-bg-secondary);">
                    <h3 style="margin: 0; font-size: 14px;">Add Rule</h3>
                    <button class="btn btn-sm btn-ghost" id="close-overlay-btn">Close</button>
                 </div>
                 <div id="overlay-content" style="flex: 1; overflow-y: auto; padding: 16px;">
                    <!-- Add Rule Form Injected Here -->
                 </div>
            </div>
        </div>
        
        <style>
            .log-item {
                display: flex;
                align-items: center;
                padding: 8px;
                border-bottom: 1px solid var(--color-border);
                font-size: 11px;
                cursor: pointer;
                transition: background 0.1s;
            }
            .log-item:hover {
                background: var(--color-bg-hover);
            }
            .log-time {
                color: var(--color-text-tertiary);
                width: 45px;
                font-size: 10px;
                flex-shrink: 0;
            }
            .log-main {
                flex: 1;
                overflow: hidden;
                padding: 0 8px;
            }
            .log-domain {
                color: var(--color-text-primary);
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .log-client {
                color: var(--color-text-tertiary);
                font-size: 9px;
            }
            .log-status {
                width: 50px;
                text-align: right;
                flex-shrink: 0;
                font-weight: 600;
            }
            .status-Blocked { color: var(--color-danger); }
            .status-Processed { color: var(--color-accent); }
            .status-WhiteList { color: var(--color-info); }
        </style>
    `;

    // Event Listeners
    document.getElementById('back-btn').addEventListener('click', () => {
        stopPolling();
        window.app.navigateTo('server-list');
    });

    const playPauseBtn = document.getElementById('play-pause-btn');
    playPauseBtn.addEventListener('click', togglePlayPause);

    document.getElementById('log-search').addEventListener('input', debounce((e) => {
        fetchLogs(e.target.value);
    }, 500));

    // Close Overlay
    document.getElementById('close-overlay-btn').addEventListener('click', () => {
        document.getElementById('add-rule-overlay').classList.add('hidden');
        if (wasPlayingBeforeOverlay) {
            resumePolling();
        }
    });

    // Start Polling
    startPolling();
}

let wasPlayingBeforeOverlay = true;

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
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');

    if (isPaused) {
        btn.title = "Resume Live Log";
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    } else {
        btn.title = "Pause Live Log";
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    }
}

function startPolling() {
    stopPolling(); // Ensure no duplicates
    isPaused = false;
    updatePlayPauseButton();

    // Initial fetch
    fetchLogs(document.getElementById('log-search').value);

    // Poll every 3 seconds
    pollingInterval = setInterval(() => {
        if (!isPaused) {
            fetchLogs(document.getElementById('log-search').value);
        }
    }, 3000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function resumePolling() {
    if (!isPaused && !pollingInterval) {
        startPolling();
    }
}

async function fetchLogs(searchQuery) {
    try {
        const result = await window.app.sendMessage('getQueryLog', {
            serverId: currentServerId,
            params: {
                limit: 50,
                search: searchQuery
            }
        });

        if (result && result.data) {
            renderLogList(result.data);
        }
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        // Don't toast on every poll failure, just log
    }
}

function renderLogList(logs) {
    const container = document.getElementById('log-list-container');
    if (!container) return; // View changed

    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state-text" style="padding:20px; text-align:center;">No queries found</div>';
        return;
    }

    const html = logs.map(log => {
        const time = new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const domain = log.question.name;
        const client = log.client;
        const status = log.status || 'Processed'; // 'Blocked', 'Processed', etc.
        const rule = log.rules && log.rules.length > 0 ? log.rules[0].text : '';

        // Status simplification
        let statusClass = 'status-Processed';
        let statusText = 'Allow';

        if (status === 'Blocked' || status === 'BlockedByUrl') {
            statusClass = 'status-Blocked';
            statusText = 'Block';
        } else if (status.includes('WhiteList')) {
            statusClass = 'status-WhiteList';
            statusText = 'Allow';
        }

        return `
            <div class="log-item" data-domain="${escapeHtml(domain)}" data-client="${escapeHtml(client)}" data-status="${statusText}">
                <div class="log-time">${time}</div>
                <div class="log-main">
                    <div class="log-domain">${escapeHtml(domain)}</div>
                    <div class="log-client">${escapeHtml(client)}</div>
                </div>
                <div class="log-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // Attach Click Handlers
    container.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', () => {
            openAddRuleOverlay(item.dataset.domain, item.dataset.client);
        });
    });
}

function openAddRuleOverlay(domain, client) {
    // 1. Pause Log
    wasPlayingBeforeOverlay = !isPaused;
    isPaused = true;
    updatePlayPauseButton();
    stopPolling();

    // 2. Show Overlay
    const overlay = document.getElementById('add-rule-overlay');
    const content = document.getElementById('overlay-content');
    overlay.classList.remove('hidden');

    // 3. Render Add Rule Form into Overlay
    content.innerHTML = '<div id="overlay-add-rule-container"></div>';
    const target = document.getElementById('overlay-add-rule-container');

    // We reuse the existing Add Rule render function!
    renderAddRuleSection(target);

    // 4. Pre-fill data
    // We need to wait a tick for the DOM to be ready
    setTimeout(() => {
        // Find inputs (they might have specific IDs in add-rule.js)
        // We know add-rule.js uses: #rule-input, #client-toggle, #client-input
        const ruleInput = target.querySelector('.add-rule-input'); // or ID
        if (ruleInput) {
            ruleInput.value = domain;
            // Trigger input event to update preview if needed
            ruleInput.dispatchEvent(new Event('input'));
        }

        // Handle Client
        const clientToggle = target.querySelector('.client-toggle-input');
        if (clientToggle) {
            clientToggle.click(); // Enable client mode

            // Wait for input to appear
            setTimeout(() => {
                const clientInput = target.querySelector('.compact-client-input');
                if (clientInput) {
                    clientInput.value = client;
                    clientInput.dispatchEvent(new Event('input'));
                }
            }, 50);
        }
    }, 100);
}

// Utility: Debounce
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
