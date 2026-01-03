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
    // Display URL - Using new Input field
    const urlInput = document.getElementById('url-display');
    if (urlInput) {
        urlInput.value = targetUrl || 'No URL';
    }

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
    // Toggle handling (Checkbox based now)
    const blockToggle = document.getElementById('block-toggle');
    const allowToggle = document.getElementById('allow-btn'); // Does not exist

    // Listen for changes
    blockToggle.addEventListener('change', (e) => {
        selectedAction = e.target.checked ? 'block' : 'allow';
        const label = document.getElementById('block-label');
        label.textContent = selectedAction === 'block' ? 'BLOCK' : 'ALLOW';
        // Add rule.css handles the color changes via :checked + span class
        // But we need to ensure the class updates if needed. 
        // Actually, CSS handles `.toggle-wrapper input:checked ~ .toggle-text.block` -> Red
        // But for unchecked (Allow), it might need manual text update if labels are static.
        // Wait, Add Rule uses ONE toggle for block/allow? 
        // Looking at Add Rule HTML: <span id="block-label" ...>BLOCK</span>
        // Just text change.
    });

    // Initialize state
    selectedAction = 'block';

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

    const container = document.getElementById('dropdown-options');
    // Clear existig
    container.innerHTML = '';

    // None option
    const noneDiv = document.createElement('div');
    noneDiv.className = 'dropdown-option';
    noneDiv.dataset.value = '';
    noneDiv.innerHTML = '<span>None</span>';
    container.appendChild(noneDiv);

    const hasServers = servers && servers.length > 0;
    const hasGroups = groups && groups.length > 0;

    // Add groups
    if (hasGroups) {
        const label = document.createElement('div');
        label.className = 'dropdown-label';
        label.textContent = 'Groups';
        container.appendChild(label);

        groups.forEach(group => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.dataset.value = `group:${group.id}`;
            option.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#FFA726" stroke="#F57C00" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span>${escapeHtml(group.name)}</span>
            `;
            container.appendChild(option);
        });
    }

    // Add servers
    if (hasServers) {
        const label = document.createElement('div');
        label.className = 'dropdown-label';
        label.textContent = 'Servers';
        container.appendChild(label);

        servers.forEach(server => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.dataset.value = `server:${server.id}`;
            option.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#42A5F5" stroke="#1976D2" stroke-width="2">
                    <rect x="2" y="4" width="13" height="10" rx="2"></rect>
                    <line x1="8.5" y1="14" x2="8.5" y2="17"></line>
                    <line x1="4.5" y1="17" x2="12.5" y2="17"></line>
                    <rect x="17" y="4" width="5" height="13" rx="1"></rect>
                    <circle cx="19.5" cy="7" r="1" fill="#42A5F5" stroke="none"></circle>
                    <line x1="18.5" y1="12" x2="20.5" y2="12"></line>
                    <line x1="18.5" y1="14" x2="20.5" y2="14"></line>
                </svg>
                <span>${escapeHtml(server.name)}</span>
            `;
            container.appendChild(option);
        });
    }

    if (!hasServers && !hasGroups) {
        showError('No servers configured. Please add a server first.');
    }

    setupDropdownEvents();
}

function setupDropdownEvents() {
    const dropdown = document.getElementById('rule-target-dropdown');
    const selected = document.getElementById('dropdown-selected');
    const options = document.getElementById('dropdown-options');
    const textSpan = selected.querySelector('.dropdown-text');

    // Toggle dropdown
    selected.addEventListener('click', (e) => {
        e.stopPropagation();
        selected.classList.toggle('open');
        options.classList.toggle('show');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            selected.classList.remove('open');
            options.classList.remove('show');
        }
    });

    // Handle option selection
    options.querySelectorAll('.dropdown-option').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            const text = option.querySelector('span').textContent;

            // Update logic
            selectedTarget = value;
            textSpan.textContent = text;

            // Close dropdown
            selected.classList.remove('open');
            options.classList.remove('show');
        });
    });
}

// ============================================================================
// ACTION HANDLING
// ============================================================================

function setAction(action) {
    selectedAction = action;

    const blockBtn = document.getElementById('block-btn');
    const allowBtn = document.getElementById('allow-btn');

    // function setAction(action) { ... } // Removed obsolete function

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
