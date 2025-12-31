// Context Menu Dialog - JavaScript
// 100% REUSES main ADD RULE logic - zero duplication

import { parseInput } from '../popup/utils/rule-parser.js';
import { generateRule } from '../popup/utils/rule-generator.js';
import { addRuleToTarget } from '../popup/services/add-rule-service.js';

// Get URL from query parameter
const urlParams = new URLSearchParams(window.location.search);
const targetUrl = urlParams.get('url');
let selectedAction = 'block'; // default (matches main form default)
let selectedTarget = '';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Display URL
    document.getElementById('url-display').textContent = targetUrl || 'No URL';

    if (!targetUrl) {
        showError('No URL provided');
        return;
    }

    // Load servers and groups
    try {
        await loadTargets();
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('form-container').style.display = 'block';
    } catch (error) {
        showError('Failed to load targets: ' + error.message);
    }

    // Event listeners
    document.getElementById('block-btn').addEventListener('click', () => setAction('block'));
    document.getElementById('allow-btn').addEventListener('click', () => setAction('allow'));
    document.getElementById('cancel-btn').addEventListener('click', () => window.close());
    document.getElementById('add-btn').addEventListener('click', handleAddRule);
});

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadTargets() {
    // Get servers and groups from background
    const servers = await sendMessage('getServers') || [];
    const groups = await sendMessage('getGroups') || [];

    const selector = document.getElementById('target-selector');
    selector.innerHTML = '<option value="">None</option>'; // Match main form label

    const hasServers = servers && servers.length > 0;
    const hasGroups = groups && groups.length > 0;

    // Add groups
    if (hasGroups) {
        const groupOptgroup = document.createElement('optgroup');
        groupOptgroup.label = 'Groups';
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = `group:${group.id}`;
            option.textContent = `📁 ${escapeHtml(group.name)}`;
            groupOptgroup.appendChild(option);
        });
        selector.appendChild(groupOptgroup);
    }

    // Add servers
    if (hasServers) {
        const serverOptgroup = document.createElement('optgroup');
        serverOptgroup.label = 'Servers'; // Match main form label
        servers.forEach(server => {
            const option = document.createElement('option');
            option.value = `server:${server.id}`;
            option.textContent = `🖥️ ${escapeHtml(server.name)}`;
            serverOptgroup.appendChild(option);
        });
        selector.appendChild(serverOptgroup);
    }

    if (!hasServers) {
        showError('No servers configured. Please add a server first.');
    }

    // Save target on change
    selector.addEventListener('change', (e) => {
        selectedTarget = e.target.value;
    });
}

// ============================================================================
// ACTION HANDLING
// ============================================================================

function setAction(action) {
    selectedAction = action;

    const blockBtn = document.getElementById('block-btn');
    const allowBtn = document.getElementById('allow-btn');

    if (action === 'block') {
        blockBtn.classList.add('active');
        allowBtn.classList.remove('active');
    } else {
        allowBtn.classList.add('active');
        blockBtn.classList.remove('active');
    }
}

async function handleAddRule() {
    // Validation - SAME as main form
    if (!targetUrl) {
        showError('Please enter a domain or URL');
        return;
    }

    if (!selectedTarget) {
        showError('Please select a target');
        return;
    }

    // Step 1: Parse input using EXACT same parser
    const { hostname, error } = parseInput(targetUrl);
    if (error) {
        showError(error);
        return;
    }

    // Step 2: Generate rule using EXACT same generator
    const isBlock = (selectedAction === 'block');
    const isImportant = false; // Context menu doesn't have importance toggle
    const rule = generateRule(hostname, isBlock, isImportant);

    // Update button state
    const addBtn = document.getElementById('add-btn');
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    try {
        // Step 3: Add rule using EXACT same service with conflict detection
        const summary = await addRuleToTarget(selectedTarget, rule);

        // Step 4: Show results - SAME logic as main form
        if (summary.success > 0) {
            const ruleType = isBlock ? 'Block' : 'Allow';
            let message = `${ruleType} rule added to ${summary.success}/${summary.total} server(s)`;

            if (summary.replaced > 0) {
                message += ` (${summary.replaced} replaced)`;
            }

            showSuccess(message);

            // Close after success
            setTimeout(() => window.close(), 1500);
        }

        if (summary.duplicate > 0) {
            showSuccess(`Rule exists on ${summary.duplicate} server(s)`);
            setTimeout(() => window.close(), 1500);
        }

        if (summary.failed > 0) {
            const errorMsg = summary.domainConflicts.length > 0
                ? `Cancelled or failed on ${summary.failed} server(s)`
                : `Failed on ${summary.failed} server(s)`;
            showError(errorMsg);
        }

    } catch (error) {
        console.error('Add rule error:', error);
        showError(`Error: ${error.message}`);
        addBtn.disabled = false;
        addBtn.textContent = 'Add Rule';
    }
}

// ============================================================================
// MESSAGE PASSING
// ============================================================================

async function sendMessage(action, data = {}) {
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
// UI HELPERS
// ============================================================================

function showError(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
    document.getElementById('loading-container').style.display = 'none';
}

function showSuccess(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = `<div class="error" style="background: var(--color-accent-light); color: var(--color-accent);">${escapeHtml(message)}</div>`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make sendMessage available globally for addRuleToTarget
window.app = {
    sendMessage,
    showToast: (msg, type) => {
        if (type === 'error') showError(msg);
        else showSuccess(msg);
    }
};
