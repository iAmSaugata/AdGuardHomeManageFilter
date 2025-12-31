// Content Script - Standalone (no imports, inline logic)
// Injected as regular script to have chrome.runtime access

(function () {
    'use strict';

    console.log('[AdGuard Modal] Initializing...');

    // INLINE: parseInput logic from popup/utils/rule-parser.js
    function parseInput(input) {
        if (!input || typeof input !== 'string') {
            return { hostname: null, error: 'Input required' };
        }

        const trimmed = input.trim();
        if (!trimmed) {
            return { hostname: null, error: 'Input required' };
        }

        // Try URL parsing first
        try {
            const urlString = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
            const url = new URL(urlString);
            const hostname = url.hostname;

            if (isValidHostname(hostname)) {
                return { hostname, error: null };
            }
        } catch (e) {
            // Not a URL, try as FQDN
        }

        // Validate as FQDN
        if (isValidHostname(trimmed)) {
            return { hostname: trimmed, error: null };
        }

        return { hostname: null, error: 'Invalid domain format' };
    }

    function isValidHostname(hostname) {
        if (!hostname || hostname.length === 0) return false;
        const parts = hostname.split('.');
        if (parts.length < 2) return false;
        const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
        return parts.every(part => labelRegex.test(part));
    }

    // INLINE: generateRule logic from popup/utils/rule-generator.js
    function generateRule(hostname, isBlock = true, isImportant = false) {
        if (!hostname || typeof hostname !== 'string') {
            throw new Error('Hostname required');
        }

        const clean = hostname.trim().toLowerCase();
        let rule = '';

        if (isBlock) {
            rule = `||${clean}^`;
        } else {
            rule = `@@||${clean}^`;
        }

        if (isImportant) {
            rule += '$important';
        }

        return rule;
    }

    // Setup window.app for chrome.runtime access
    if (!window.app) {
        // Check if chrome API is available
        const hasChromeAPI = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;

        console.log('[AdGuard Modal] Chrome API available:', hasChromeAPI);

        if (hasChromeAPI) {
            window.app = {
                sendMessage: async (action, data = {}) => {
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
            };
        } else {
            console.error('[AdGuard Modal] Chrome extension API not available');
        }
    }

    console.log('[AdGuard Modal] Chrome runtime available:', !!(typeof chrome !== 'undefined' && chrome.runtime));
    console.log('[AdGuard Modal] Ready!');

    // Listen for chrome.runtime.onMessage from background
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'ADGUARD_SHOW_MODAL') {
                console.log('[AdGuard Modal] Showing modal for:', message.url);
                showModal(message.url);
                sendResponse({ success: true });
            }
            return true;
        });
    }

    function showModal(url) {
        const existing = document.getElementById('adguard-modal-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.id = 'adguard-modal-container';
        container.className = 'adguard-modal-overlay';

        container.innerHTML = `
            <div class="adguard-modal">
                <div class="adguard-modal-header">
                    <h2 class="adguard-modal-title">Add to AdGuard Home</h2>
                </div>
                <div class="adguard-modal-body">
                    <div class="adguard-url-display">${escapeHtml(url)}</div>
                    <div id="adguard-error-container"></div>
                    <div id="adguard-form-container">
                        <div class="adguard-toggle-group">
                            <button class="adguard-toggle-btn active" id="adguard-block-btn">🚫 Block</button>
                            <button class="adguard-toggle-btn allow" id="adguard-allow-btn">✅ Allow</button>
                        </div>
                        <label class="adguard-form-label">Add to:</label>
                        <select id="adguard-target-selector" class="adguard-select">
                            <option value="">Loading...</option>
                        </select>
                        <div class="adguard-rule-preview" id="adguard-rule-preview">||example.com^</div>
                        <div class="adguard-actions">
                            <button class="adguard-btn adguard-btn-secondary" id="adguard-cancel-btn">Cancel</button>
                            <button class="adguard-btn adguard-btn-primary" id="adguard-add-btn">Add Rule</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        initializeModal(url, container);

        container.addEventListener('click', (e) => {
            if (e.target === container) container.remove();
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                container.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async function initializeModal(url, container) {
        const blockBtn = container.querySelector('#adguard-block-btn');
        const allowBtn = container.querySelector('#adguard-allow-btn');
        const targetSelector = container.querySelector('#adguard-target-selector');
        const rulePreview = container.querySelector('#adguard-rule-preview');
        const cancelBtn = container.querySelector('#adguard-cancel-btn');
        const addBtn = container.querySelector('#adguard-add-btn');
        const errorContainer = container.querySelector('#adguard-error-container');

        let selectedAction = 'block';

        await loadTargets(targetSelector, errorContainer);

        function setAction(action) {
            selectedAction = action;
            blockBtn.classList.toggle('active', action === 'block');
            allowBtn.classList.toggle('active', action === 'allow');
            updatePreview();
        }

        function updatePreview() {
            try {
                const { hostname, error } = parseInput(url);
                if (error) {
                    rulePreview.textContent = error;
                    rulePreview.className = 'adguard-rule-preview error';
                    return;
                }
                const rule = generateRule(hostname, selectedAction === 'block', false);
                rulePreview.textContent = rule;
                rulePreview.className = 'adguard-rule-preview ' + (selectedAction === 'block' ? '' : 'allow');
            } catch (error) {
                rulePreview.textContent = error.message;
                rulePreview.className = 'adguard-rule-preview error';
            }
        }

        blockBtn.addEventListener('click', () => setAction('block'));
        allowBtn.addEventListener('click', () => setAction('allow'));
        targetSelector.addEventListener('change', updatePreview);
        cancelBtn.addEventListener('click', () => container.remove());
        addBtn.addEventListener('click', () => handleAddRule(url, targetSelector.value, selectedAction, addBtn, errorContainer));

        updatePreview();
    }

    async function handleAddRule(url, target, action, addBtn, errorContainer) {
        if (!target) {
            showError(errorContainer, 'Please select a target');
            return;
        }

        addBtn.disabled = true;
        addBtn.textContent = 'Adding...';

        try {
            const { hostname, error } = parseInput(url);
            if (error) throw new Error(error);

            const rule = generateRule(hostname, action === 'block', false);

            // Use addRuleToTarget from add-rule-service.js via dynamic import
            const { addRuleToTarget } = await import(chrome.runtime.getURL('popup/services/add-rule-service.js'));
            const summary = await addRuleToTarget(target, rule);

            if (summary.success > 0) {
                const ruleType = action === 'block' ? 'Block' : 'Allow';
                let message = `${ruleType} rule added to ${summary.success}/${summary.total} server(s)`;
                if (summary.replaced > 0) message += ` (${summary.replaced} replaced)`;
                showSuccess(errorContainer, message);
                setTimeout(() => document.getElementById('adguard-modal-container').remove(), 1500);
                return;
            }

            if (summary.duplicate > 0) {
                showSuccess(errorContainer, `Rule exists on ${summary.duplicate} server(s)`);
                setTimeout(() => document.getElementById('adguard-modal-container').remove(), 1500);
                return;
            }

            if (summary.failed > 0) {
                throw new Error(`Failed on ${summary.failed} server(s)`);
            }

            throw new Error('Failed to add rule');
        } catch (error) {
            console.error('Add rule error:', error);
            showError(errorContainer, error.message);
            addBtn.disabled = false;
            addBtn.textContent = 'Add Rule';
        }
    }

    async function loadTargets(selector, errorContainer) {
        try {
            const servers = await window.app.sendMessage('getServers') || [];
            const groups = await window.app.sendMessage('getGroups') || [];

            selector.innerHTML = '<option value="">None</option>';

            if (groups.length > 0) {
                const groupOptgroup = document.createElement('optgroup');
                groupOptgroup.label = 'Groups';
                groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = `group:${group.id}`;
                    option.textContent = `📁 ${group.name}`;
                    groupOptgroup.appendChild(option);
                });
                selector.appendChild(groupOptgroup);
            }

            if (servers.length > 0) {
                const serverOptgroup = document.createElement('optgroup');
                serverOptgroup.label = 'Servers';
                servers.forEach(server => {
                    const option = document.createElement('option');
                    option.value = `server:${server.id}`;
                    option.textContent = `🖥️ ${server.name}`;
                    serverOptgroup.appendChild(option);
                });
                selector.appendChild(serverOptgroup);
            }

            if (servers.length === 0) {
                showError(errorContainer, 'No servers configured. Please add a server first.');
            }
        } catch (error) {
            console.error('Load targets error:', error);
            showError(errorContainer, 'Failed to load servers: ' + error.message);
        }
    }

    function showError(container, message) {
        container.innerHTML = `<div class="adguard-error">${escapeHtml(message)}</div>`;
    }

    function showSuccess(container, message) {
        container.innerHTML = `<div class="adguard-success">${escapeHtml(message)}</div>`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    console.log('[AdGuard Modal] Ready!');
})();
