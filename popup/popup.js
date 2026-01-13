// Popup Application - Main Entry Point
// Handles view routing, message passing, and UI coordination

import { Logger } from './utils/logger.js';

import { renderServerList } from './views/server-list.js';
import { renderServerForm } from './views/server-form.js';
import { renderServerDetail } from './views/server-detail.js';
import { renderSettings } from './views/settings.js';
import { renderGroupForm } from './views/group-form.js';
import { renderGroupSettings } from './views/group-settings.js';
import { renderGroupMergedRules } from './views/group-merged-rules.js';
import { renderGroupBlocklists } from './views/group-blocklists.js';
import { renderGroupRewrites } from './views/group-rewrites.js';
import { renderGroupClients } from './views/group-clients.js';
import { renderGroupServerSelection } from './views/group-server-selection.js';
import { renderAddRuleSection } from './views/add-rule.js';
import { renderAbout } from './views/about.js';
import { renderQueryLog } from './views/query-log.js';
import { renderLogDetail } from './views/log-detail.js';
import { initializeKeyboardHandler, focusFirstElement, storeFocus, restoreFocus } from './shared/keyboard-handler.js';
import { announceNavigation, announceLoading, initializeAnnouncer } from './shared/announcer.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    currentView: 'server-list',
    viewData: null,
    loading: false
};

// ============================================================================
// MESSAGE PASSING TO BACKGROUND
// ============================================================================

/**
 * Send message to background script with retry logic
 * Handles service worker restart scenarios gracefully
 * @param {string} action - Action name
 * @param {Object} data - Data payload
 * @param {number} retries - Maximum retry attempts (default: 3)
 * @returns {Promise} Response from background
 */
export async function sendMessage(action, data = {}, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action, data }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (!response) {
                        reject(new Error('No response from background script'));
                        return;
                    }

                    if (response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error || 'Unknown error'));
                    }
                });
            });
        } catch (error) {
            // If this was the last attempt, throw the error
            if (attempt === retries) {
                throw error;
            }

            // Log retry attempt
            console.warn(`[Message] Retry ${attempt + 1}/${retries} for action "${action}":`, error.message);

            // Exponential backoff: 100ms, 200ms, 300ms
            await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
    }
}

// ============================================================================
// TOAST / SNACKBAR SYSTEM
// ============================================================================

let toastTimeout = null;

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    // Clear existing toasts
    container.innerHTML = '';

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-dismiss after 3 seconds
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ============================================================================
// LOADING OVERLAY
// ============================================================================

export function showLoading() {
    state.loading = true;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

export function hideLoading() {
    state.loading = false;
    document.getElementById('loading-overlay').classList.add('hidden');
}

// ============================================================================
// VIEW ROUTER
// ============================================================================

export function navigateTo(view, data = null) {
    // Store current focus before navigation
    storeFocus();

    state.currentView = view;
    state.viewData = data;

    // Announce navigation to screen readers
    announceNavigation(view);

    renderCurrentView();

    // Set focus on first interactive element after render
    setTimeout(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            focusFirstElement(mainContent);
        }
    }, 150);
}

function renderCurrentView() {
    const mainContent = document.getElementById('main-content');

    switch (state.currentView) {
        case 'server-list':
            renderServerList(mainContent);

            // Render Add Rule section (1px gap)
            setTimeout(() => {
                const addRuleContainer = document.getElementById('add-rule-container');
                if (addRuleContainer) {
                    renderAddRuleSection(addRuleContainer);
                }
            }, 100);
            break;

        case 'server-form':
            document.getElementById('add-rule-container').innerHTML = '';
            renderServerForm(mainContent, state.viewData);
            break;

        case 'server-detail':
            document.getElementById('add-rule-container').innerHTML = '';
            renderServerDetail(mainContent, state.viewData);
            break;

        case 'settings':
            document.getElementById('add-rule-container').innerHTML = '';
            renderSettings(mainContent);
            break;

        case 'group-form':
            document.getElementById('add-rule-container').innerHTML = '';
            renderGroupForm(mainContent, state.viewData);
            break;

        case 'group-settings':
            document.getElementById('add-rule-container').innerHTML = '';
            renderGroupSettings(mainContent, state.viewData);
            break;

        case 'group-merged-rules':
            document.getElementById('add-rule-container').innerHTML = '';
            renderGroupMergedRules(mainContent, state.viewData);
            break;

        case 'group-blocklists':
            document.getElementById('add-rule-container').innerHTML = '';
            renderGroupBlocklists(mainContent, state.viewData);
            break;

        case 'group-rewrites':
            document.getElementById('add-rule-container').innerHTML = '';
            renderGroupRewrites(mainContent, state.viewData);
            break;

        case 'group-clients':
            document.getElementById('add-rule-container').innerHTML = '';
            renderGroupClients(mainContent, state.viewData);
            break;

        case 'group-server-selection':
            document.getElementById('add-rule-container').innerHTML = '';
            renderGroupServerSelection(mainContent, state.viewData);
            break;

        case 'about':
            document.getElementById('add-rule-container').innerHTML = '';
            renderAbout(mainContent);
            break;

        case 'query-log':
            document.getElementById('add-rule-container').innerHTML = '';
            renderQueryLog(mainContent, state.viewData);
            break;

        case 'log-detail':
            document.getElementById('add-rule-container').innerHTML = '';
            renderLogDetail(mainContent, state.viewData);
            break;

        default:
            mainContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Unknown View</div>
          <div class="empty-state-text">The requested view could not be found.</div>
          <button class="btn btn-primary" onclick="window.location.reload()">
            Reload
          </button>
        </div>
      `;
    }
}

/**
 * Refresh the current view (re-render without changing state)
 * Useful for updating UI after background data changes
 */
export function refreshCurrentView() {
    renderCurrentView();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Export for use in views - MUST be before DOMContentLoaded
window.app = {
    navigateTo,
    sendMessage,
    showToast,
    showLoading,
    hideLoading,
    refreshCurrentView,
    currentView: state.currentView // Expose for keyboard handler
};

document.addEventListener('DOMContentLoaded', () => {
    Logger.info('Popup initialized');

    // Initialize accessibility features
    initializeAnnouncer();
    initializeKeyboardHandler();
    Logger.info('[Accessibility] Keyboard shortcuts and screen reader support enabled');

    // Settings button event listener
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            navigateTo('settings');
        });
    }

    // Listen for Auto-Repair notifications from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'repairNotification' && message.data) {
            const { serverName, ruleCount } = message.data;
            Logger.info(`[Popup] Received repair notification for ${serverName}`);
            showToast(`Auto-Repaired ${serverName} with ${ruleCount} rules`, 'success');
        }
    });

    renderCurrentView();

    // SWR Strategy: Trigger background sync after initial render
    // This allows instant load from cache (if preferLatest=false) but ensures data stays fresh
    Logger.debug('[Popup] Triggering background sync...');
    sendMessage('refreshAllServers', { force: true, background: true }, 0)
        .then(result => {
            if (result && result.success) {
                Logger.debug('[Popup] Background sync completed, refreshing view if needed');
                // If data changed, we could auto-refresh, but let's avoid jarring jumps
                // Ideally, we'd check if currently viewed server data changed
                // For now, logging is sufficient as re-opening popup will show fresh data
                // OR we can silently update if user is just looking at list
                if (state.currentView === 'server-list') {
                    renderCurrentView();
                }
            }
        })
        .catch(err => Logger.warn('[Popup] Background sync failed:', err));
});
