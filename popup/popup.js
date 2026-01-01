// Popup Application - Main Entry Point
// Handles view routing, message passing, and UI coordination

import { renderServerList } from './views/server-list.js';
import { renderServerForm } from './views/server-form.js';
import { renderServerDetail } from './views/server-detail.js';
import { renderSettings } from './views/settings.js';
import { renderGroupForm } from './views/group-form.js';
import { renderAddRuleSection } from './views/add-rule.js';
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
    console.log('Popup initialized');

    // Initialize accessibility features
    initializeAnnouncer();
    initializeKeyboardHandler();
    console.log('[Accessibility] Keyboard shortcuts and screen reader support enabled');

    // Settings button event listener
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            navigateTo('settings');
        });
    }

    renderCurrentView();
});
