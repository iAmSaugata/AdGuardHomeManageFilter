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
            <div class="adguard-modal" role="dialog" aria-labelledby="adguard-modal-title" aria-modal="true">
                <div class="adguard-modal-header">
                    <h2 class="adguard-modal-title" id="adguard-modal-title">Add to AdGuard Home</h2>
                </div>
                <div class="adguard-modal-body">
                    <div class="adguard-url-display" aria-label="URL to filter">${escapeHtml(url)}</div>
                    <div id="adguard-error-container" role="alert" aria-live="polite"></div>
                    <div id="adguard-form-container">
                        <div class="adguard-toggle-group" role="group" aria-label="Rule type selection">
                            <button class="adguard-toggle-btn active" id="adguard-block-btn" aria-pressed="true">🚫 Block</button>
                            <button class="adguard-toggle-btn allow" id="adguard-allow-btn" aria-pressed="false">✅ Allow</button>
                        </div>
                        <label class="adguard-form-label" for="adguard-target-selector">Add to:</label>
                        <select id="adguard-target-selector" class="adguard-select" aria-label="Select target server or group">
                            <option value="">Loading...</option>
                        </select>
                        <div class="adguard-rule-preview" id="adguard-rule-preview" role="status" aria-live="polite">||example.com^</div>
                        <div class="adguard-actions">
                            <button class="adguard-btn adguard-btn-secondary" id="adguard-cancel-btn" aria-label="Cancel and close">Cancel</button>
                            <button class="adguard-btn adguard-btn-primary" id="adguard-add-btn" aria-label="Add filtering rule">Add Rule</button>
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

        // Reset button state (in case it was stuck in "Adding..." state)
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = 'Add Rule';
        }

        let selectedAction = 'block';

        await loadTargets(targetSelector, errorContainer);

        function setAction(action) {
            selectedAction = action;
            blockBtn.classList.toggle('active', action === 'block');
            allowBtn.classList.toggle('active', action === 'allow');
            // Update ARIA pressed states
            blockBtn.setAttribute('aria-pressed', action === 'block');
            allowBtn.setAttribute('aria-pressed', action === 'allow');
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
                    // Escape for defense-in-depth, even though from trusted storage
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
                    // Escape for defense-in-depth, even though from trusted storage
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

            // Store original form HTML to restore on cancel
            const formContainer = document.getElementById('adguard-form-container');
            const originalFormHTML = formContainer.innerHTML;

            // Replace entire modal content with compact, dark confirmation dialog
            formContainer.innerHTML = `
                <div role="alertdialog" aria-labelledby="conflict-title" aria-describedby="conflict-description" style="position: relative; padding: 8px;">
                    <!-- Background card layer for depth -->
                    <div style="position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; background: #1a1d24; border-radius: 8px; border: 1px solid #23262e; opacity: 0.7;"></div>
                    
                    <!-- Main content card -->
                    <div style="position: relative; background: #23262e; border-radius: 8px; border: 1px solid #2a2d35; padding: 12px 10px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);">
                        <div style="text-align: center; margin-bottom: 14px;">
                            <h3 id="conflict-title" style="font-size: 15px; font-weight: 600; margin: 0 0 6px 0; color: #ffffff;">Domain Conflict Detected</h3>
                            <p id="conflict-description" style="font-size: 12px; color: #8a8d93; margin: 0;">Domain "<strong style="color: #ffffff;">${escapeHtml(domain)}</strong>" already exists on <strong style="color: #ffffff;">${serverCount}</strong> server(s):</p>
                        </div>
                        
                        <div style="background: #1c1f26; padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #2a2d35;">
                            <div style="margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                    <span style="font-size: 11px; color: #b0b3b8; font-weight: 600;">Existing:</span>
                                    <span style="display: inline-block; padding: 2px 7px; background: ${existingType === 'allow' ? '#4caf50' : '#f44336'}; color: white; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.3px;">${existingType.toUpperCase()}</span>
                                </div>
                                <div style="font-family: 'Courier New', monospace; color: #8a8d93; font-size: 11px; padding: 6px; background: #16181e; border-radius: 3px; border-left: 2px solid ${existingType === 'allow' ? '#4caf50' : '#f44336'};">${escapeHtml(existingRule)}</div>
                            </div>
                            <div>
                                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                    <span style="font-size: 11px; color: #b0b3b8; font-weight: 600;">New:</span>
                                    <span style="display: inline-block; padding: 2px 7px; background: ${newType === 'allow' ? '#4caf50' : '#f44336'}; color: white; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.3px;">${newType.toUpperCase()}</span>
                                </div>
                                <div style="font-family: 'Courier New', monospace; color: #8a8d93; font-size: 11px; padding: 6px; background: #16181e; border-radius: 3px; border-left: 2px solid ${newType === 'allow' ? '#4caf50' : '#f44336'};">${escapeHtml(newRule)}</div>
                            </div>
                        </div>
                        
                        <p style="font-size: 12px; color: #ffffff; text-align: center; margin: 0 0 12px 0; font-weight: 500;">Replace existing rule on all ${serverCount} server(s)?</p>
                        
                        <div style="display: flex; gap: 8px;">
                            <button id="confirm-cancel" class="adguard-btn adguard-btn-secondary" style="flex: 1; padding: 9px; font-size: 13px;">Cancel</button>
                            <button id="confirm-replace" class="adguard-btn adguard-btn-primary" style="flex: 1; padding: 9px; font-size: 13px;">Replace All</button>
                        </div>
                    </div>
                </div>
            `;

            errorContainer.innerHTML = '';

            const confirmCancelBtn = formContainer.querySelector('#confirm-cancel');
            const replaceBtn = formContainer.querySelector('#confirm-replace');

            // Cancel - restore form to allow selecting different target
            confirmCancelBtn.addEventListener('click', () => {
                formContainer.innerHTML = originalFormHTML;
                errorContainer.innerHTML = '';
                // Re-initialize modal to restore all event listeners and allow retrying with different target
                const container = document.getElementById('adguard-modal-container');
                const url = container.querySelector('.adguard-url-display').textContent;
                initializeModal(url, container);
                resolve(false);
            });

            // Replace All
            replaceBtn.addEventListener('click', () => {
                // Disable both buttons immediately to prevent duplicate clicks
                confirmCancelBtn.disabled = true;
                replaceBtn.disabled = true;
                replaceBtn.textContent = 'Replacing...';

                // Don't restore form - let the button stay in "Adding..." state while processing
                // Just clear the confirmation dialog and let handleAddRule continue
                errorContainer.innerHTML = '';
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
