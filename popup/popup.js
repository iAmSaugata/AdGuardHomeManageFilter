// Popup Application - Main Entry Point
// Handles view routing, message passing, and UI coordination

import { renderServerList } from './views/server-list.js';
import { renderServerForm } from './views/server-form.js';
import { renderServerDetail } from './views/server-detail.js';
import { renderSettings } from './views/settings.js';
import { renderGroupForm } from './views/group-form.js';

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
 * Send message to background script
 * @param {string} action - Action name
 * @param {Object} data - Data payload
 * @returns {Promise} Response from background
 */
export async function sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
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

export async function navigateTo(view, data = null) {
    state.currentView = view;
    state.viewData = data;
    await renderCurrentView();
}

function renderCurrentView() {
    const mainContent = document.getElementById('main-content');

    switch (state.currentView) {
        case 'server-list':
            await renderServerList(mainContent);

            // Inject Add Rule section into the view-body to flow with content
            const viewBody = mainContent.querySelector('.view-body');
            if (viewBody) {
                const ruleContainer = document.createElement('div');
                ruleContainer.id = 'add-rule-container';
                viewBody.appendChild(ruleContainer);

                const { renderAddRuleSection } = await import('./views/add-rule.js');
                await renderAddRuleSection(ruleContainer);
            }
            break;

        case 'server-form':
            renderServerForm(mainContent, state.viewData);
            break;

        case 'server-detail':
            renderServerDetail(mainContent, state.viewData);
            break;

        case 'settings':
            renderSettings(mainContent);
            break;

        case 'group-form':
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

// ============================================================================
// INITIALIZATION
// ============================================================================

// Export for use in views - MUST be before DOMContentLoaded
window.app = {
    navigateTo,
    sendMessage,
    showToast,
    showLoading,
    hideLoading
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup initialized');

    // Settings button event listener
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            navigateTo('settings');
        });
    }

    renderCurrentView();
});
