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
            const [type, id] = target.split(':');
            let serverIds = [];

            // Get server IDs based on target type - MATCHES main ADD RULE logic
            if (type === 'group') {
                const groups = await window.app.sendMessage('getGroups');
                const group = groups.find(g => g.id === id);
                if (!group) throw new Error('Group not found');
                serverIds = group.serverIds || [];
            } else if (type === 'server') {
                // Check if this server belongs to a group
                const groups = await window.app.sendMessage('getGroups');
                const parentGroup = groups.find(g => g.serverIds && g.serverIds.includes(id));

                if (parentGroup) {
                    // Server is in a group - add to all servers in the group
                    serverIds = parentGroup.serverIds;
                } else {
                    // Server is standalone - add only to this server
                    serverIds = [id];
                }
            }

            // Check for duplicates/conflicts on each server
            let hasExactDuplicate = false;
            let hasDomainConflict = false;
            let conflictingRule = null;

            for (const serverId of serverIds) {
                const currentRules = await window.app.sendMessage('getUserRules', { serverId });

                // Check exact duplicate
                if (currentRules.includes(rule)) {
                    hasExactDuplicate = true;
                    break;
                }

                // Check domain conflict (same domain, different type)
                const domainCheck = checkDomainExists(rule, currentRules);
                if (domainCheck.exists) {
                    hasDomainConflict = true;
                    conflictingRule = domainCheck.conflictingRule;
                    break;
                }
            }

            // Handle exact duplicate
            if (hasExactDuplicate) {
                showSuccess(errorContainer, `Rule already exists`);
                setTimeout(() => document.getElementById('adguard-modal-container').remove(), 1500);
                addBtn.disabled = false;
                addBtn.textContent = 'Add Rule';
                return;
            }

            // Handle domain conflict - show confirmation
            if (hasDomainConflict) {
                const shouldReplace = await showConfirmationDialog(hostname, conflictingRule, rule, serverIds.length, errorContainer);

                if (!shouldReplace) {
                    showError(errorContainer, 'Operation cancelled');
                    addBtn.disabled = false;
                    addBtn.textContent = 'Add Rule';
                    return;
                }

                // User confirmed - replace rules
                let successCount = 0;
                for (const serverId of serverIds) {
                    try {
                        const currentRules = await window.app.sendMessage('getUserRules', { serverId });
                        const updatedRules = currentRules.map(r => r === conflictingRule ? rule : r);
                        await window.app.sendMessage('setRules', { serverId, rules: updatedRules });
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to update server ${serverId}:`, err);
                    }
                }

                showSuccess(errorContainer, `Rule replaced on ${successCount}/${serverIds.length} server(s)`);
                setTimeout(() => document.getElementById('adguard-modal-container').remove(), 1500);
                addBtn.disabled = false;
                addBtn.textContent = 'Add Rule';
                return;
            }

            // No conflicts - add normally
            let successCount = 0;
            for (const serverId of serverIds) {
                try {
                    const currentRules = await window.app.sendMessage('getUserRules', { serverId });
                    const updatedRules = [...currentRules, rule];
                    await window.app.sendMessage('setRules', { serverId, rules: updatedRules });
                    successCount++;
                } catch (err) {
                    console.error(`Failed to add to server ${serverId}:`, err);
                }
            }

            if (successCount > 0) {
                const ruleType = action === 'block' ? 'Block' : 'Allow';
                showSuccess(errorContainer, `${ruleType} rule added to ${successCount}/${serverIds.length} server(s)`);
                setTimeout(() => document.getElementById('adguard-modal-container').remove(), 1500);
            } else {
                throw new Error('Failed to add rule to any server');
            }

            addBtn.disabled = false;
            addBtn.textContent = 'Add Rule';
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
                    // Server/group names from storage are trusted, no need to escape
                    option.innerHTML = `📁 ${group.name}`;
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
                    // Server/group names from storage are trusted, no need to escape
                    option.innerHTML = `🖥️ ${server.name}`;
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

    // Check if domain already exists in rules (different rule type)
    function checkDomainExists(rule, existingRules) {
        const domain = extractDomain(rule);
        if (!domain) return { exists: false };

        for (const existingRule of existingRules) {
            const existingDomain = extractDomain(existingRule);
            if (existingDomain === domain && existingRule !== rule) {
                return { exists: true, domain, conflictingRule: existingRule };
            }
        }
        return { exists: false };
    }

    // Extract domain from AdGuard rule
    function extractDomain(rule) {
        const match = rule.match(/\|\|([^\^\$]+)/);
        return match ? match[1] : null;
    }

    // Get rule type (block/allow)
    function getRuleType(rule) {
        if (!rule) return 'unknown';
        return rule.startsWith('@@') ? 'allow' : 'block';
    }

    // Show confirmation dialog within modal
    async function showConfirmationDialog(domain, existingRule, newRule, serverCount, errorContainer) {
        return new Promise((resolve) => {
            const existingType = getRuleType(existingRule);
            const newType = getRuleType(newRule);

            // Disable form controls during confirmation
            const blockBtn = document.getElementById('adguard-block-btn');
            const allowBtn = document.getElementById('adguard-allow-btn');
            const targetSelector = document.getElementById('adguard-target-selector');
            const addBtn = document.getElementById('adguard-add-btn');
            const cancelModalBtn = document.getElementById('adguard-cancel-btn');

            if (blockBtn) blockBtn.disabled = true;
            if (allowBtn) allowBtn.disabled = true;
            if (targetSelector) targetSelector.disabled = true;
            if (addBtn) addBtn.disabled = true;
            if (cancelModalBtn) cancelModalBtn.disabled = true;

            errorContainer.innerHTML = `
                <div style="background: #2a2d35; padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 3px solid #ff9800;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: #ffffff;">Domain Conflict Detected</div>
                    <div style="font-size: 12px; color: #b0b3b8; margin-bottom: 8px;">
                        Domain "${escapeHtml(domain)}" already exists on ${serverCount} server(s):
                    </div>
                    <div style="background: #1c1f26; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                        <div style="margin-bottom: 6px;">
                            <strong style="color: #ffffff;">Existing:</strong>
                            <span style="display: inline-block; padding: 2px 6px; background: ${existingType === 'allow' ? '#4caf50' : '#f44336'}; color: white; border-radius: 3px; font-size: 10px; margin-left: 6px;">${existingType.toUpperCase()}</span>
                            <div style="font-family: monospace; font-size: 11px; color: #8a8d93; margin-top: 4px;">${escapeHtml(existingRule)}</div>
                        </div>
                        <div>
                            <strong style="color: #ffffff;">New:</strong>
                            <span style="display: inline-block; padding: 2px 6px; background: ${newType === 'allow' ? '#4caf50' : '#f44336'}; color: white; border-radius: 3px; font-size: 10px; margin-left: 6px;">${newType.toUpperCase()}</span>
                            <div style="font-family: monospace; font-size: 11px; color: #8a8d93; margin-top: 4px;">${escapeHtml(newRule)}</div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #ffffff; margin-bottom: 12px;">Replace existing rule on all ${serverCount} server(s)?</div>
                    <div style="display: flex; gap: 8px;">
                        <button id="confirm-cancel" style="flex: 1; padding: 8px; background: #3a3d45; color: #ffffff; border: 1px solid #555; border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
                        <button id="confirm-replace" style="flex: 1; padding: 8px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Replace All</button>
                    </div>
                </div>
            `;

            const confirmCancelBtn = errorContainer.querySelector('#confirm-cancel');
            const replaceBtn = errorContainer.querySelector('#confirm-replace');

            // Re-enable form controls helper
            const enableFormControls = () => {
                if (blockBtn) blockBtn.disabled = false;
                if (allowBtn) allowBtn.disabled = false;
                if (targetSelector) targetSelector.disabled = false;
                if (addBtn) addBtn.disabled = false;
                if (cancelModalBtn) cancelModalBtn.disabled = false;
            };

            confirmCancelBtn.addEventListener('click', () => {
                errorContainer.innerHTML = '';
                enableFormControls();
                resolve(false);
            });

            replaceBtn.addEventListener('click', () => {
                errorContainer.innerHTML = '';
                enableFormControls();
                resolve(true);
            });
        });
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
