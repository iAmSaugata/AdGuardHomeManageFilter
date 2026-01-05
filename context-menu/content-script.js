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
    function generateRule(hostname, isBlock = true, clientValue = null) {
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

        if (clientValue && typeof clientValue === 'string' && clientValue.trim()) {
            rule += `$client='${clientValue.trim()}'`;
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
            // [SECURITY] Validate message structure
            if (!message || typeof message !== 'object') {
                console.error('[Security] Invalid message format');
                sendResponse({ success: false, error: 'Invalid message format' });
                return true;
            }

            // [SECURITY] Whitelist allowed message types
            const ALLOWED_TYPES = ['ADGUARD_SHOW_MODAL'];
            if (!ALLOWED_TYPES.includes(message.type)) {
                console.error('[Security] Unauthorized message type:', message.type);
                sendResponse({ success: false, error: 'Unauthorized message type' });
                return true;
            }

            // [SECURITY] Validate URL parameter
            if (!message.url || typeof message.url !== 'string') {
                console.error('[Security] Missing or invalid URL');
                sendResponse({ success: false, error: 'Missing or invalid URL' });
                return true;
            }

            // [SECURITY] Validate URL format and protocol
            if (!isValidURL(message.url)) {
                console.error('[Security] Invalid URL format or disallowed protocol:', message.url);
                sendResponse({ success: false, error: 'Invalid URL format' });
                return true;
            }

            console.log('[AdGuard Modal] Showing modal for:', message.url);
            showModal(message.url);
            sendResponse({ success: true });
            return true;
        });
    }

    /**
     * [SECURITY] Validate URL format and protocol
     * Only allows http: and https: protocols
     * @param {string} url - URL to validate
     * @returns {boolean} - true if valid, false otherwise
     */
    function isValidURL(url) {
        try {
            const parsed = new URL(url);
            // Only allow http/https protocols (prevent javascript:, data:, file:, etc.)
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    function showModal(url) {
        const existing = document.getElementById('adguard-modal-container');
        if (existing) {
            // Try to close gracefully first to clean up classes
            if (existing.close) existing.close();
            else existing.remove();
        }

        const container = document.createElement('div');
        container.id = 'adguard-modal-container';
        container.className = 'adguard-modal-overlay';

        // NOTE: New Custom Dropdown Structure
        container.innerHTML = `
            <div class="adguard-modal" role="dialog" aria-labelledby="adguard-modal-title" aria-modal="true">
                <div class="adguard-modal-header">
                    <h2 class="adguard-modal-title" id="adguard-modal-title">Add to AdGuard Home</h2>
                </div>
                <div class="adguard-modal-body">
                    <div class="adguard-url-display" aria-label="URL to filter">${escapeHtml(url)}</div>
                    
                    <div id="adguard-error-container" role="alert" aria-live="polite"></div>
                    
                    <div id="adguard-form-container">
                        <div id="adguard-form-content">
                        <!-- Toggles: Block/Allow & Client Specific -->
                        <div class="adguard-toggle-group">
                            <label class="adguard-toggle-wrapper">
                                <input type="checkbox" id="adguard-block-toggle" checked>
                                <span class="adguard-toggle-text block" id="adguard-block-label">BLOCK</span>
                            </label>

                            <div class="adguard-toggle-wrapper adguard-toggle-right adguard-client-toggle-container">
                                <input 
                                    type="text" 
                                    id="adguard-client-input" 
                                    class="adguard-form-input adguard-compact-client-input adguard-hidden" 
                                    placeholder="IP / Client ID / Name" 
                                    title="Use | to separate multiple clients (e.g. ipad|iphone)"
                                />
                                <label class="adguard-client-switch-wrapper">
                                    <span id="adguard-client-label" class="adguard-toggle-text">CLIENT</span>
                                    <input type="checkbox" id="adguard-client-toggle" class="adguard-client-toggle">
                                </label>
                            </div>
                        </div>
                        
                        <label class="adguard-form-label">Add to:</label>
                        
                        <!-- CUSTOM DROPDOWN -->
                        <div class="adguard-custom-select" id="adguard-custom-dropdown">
                            <!-- Trigger Area -->
                            <div class="adguard-select-trigger" id="adguard-select-trigger" tabindex="0">
                                <span id="adguard-select-label">Loading...</span>
                                <svg class="adguard-select-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                            
                            <!-- Hidden Select for form logic compatibility -->
                            <input type="hidden" id="adguard-target-value" value="">
                            
                            <!-- Dropdown Menu (Opens Upward via CSS) -->
                            <div class="adguard-select-options" id="adguard-select-options">
                                <!-- Options injected via JS -->
                            </div>
                        </div>

                        <div class="adguard-rule-preview" id="adguard-rule-preview" role="status" aria-live="polite">||example.com^</div>
                        
                        <div class="adguard-actions">
                            <button class="adguard-btn adguard-btn-secondary" id="adguard-cancel-btn" aria-label="Cancel and close">Cancel</button>
                            <button class="adguard-btn adguard-btn-primary" id="adguard-add-btn" aria-label="Add filtering rule">Add Rule</button>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Disable body scroll - Class based approach (More robust)
        document.documentElement.classList.add('adguard-no-scroll');
        document.body.classList.add('adguard-no-scroll');

        initializeModal(url, container);

        function closeModal() {
            container.remove();
            // Restore scroll
            document.documentElement.classList.remove('adguard-no-scroll');
            document.body.classList.remove('adguard-no-scroll');
            document.removeEventListener('keydown', escapeHandler);
        }

        // Expose close function
        container.close = closeModal;

        // Close on background click
        container.addEventListener('click', (e) => {
            if (e.target === container) closeModal();
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async function initializeModal(url, container) {
        const blockToggle = container.querySelector('#adguard-block-toggle');
        const blockLabel = container.querySelector('#adguard-block-label');

        // Client Specific Logic
        const clientToggle = container.querySelector('#adguard-client-toggle');
        const clientLabel = container.querySelector('#adguard-client-label');
        const clientInput = container.querySelector('#adguard-client-input');

        // Custom Dropdown Elements
        const dropdown = container.querySelector('#adguard-custom-dropdown');
        const trigger = container.querySelector('#adguard-select-trigger');
        const optionsContainer = container.querySelector('#adguard-select-options');
        const hiddenInput = container.querySelector('#adguard-target-value');
        const triggerLabel = container.querySelector('#adguard-select-label');

        const rulePreview = container.querySelector('#adguard-rule-preview');
        const cancelBtn = container.querySelector('#adguard-cancel-btn');
        const addBtn = container.querySelector('#adguard-add-btn');
        const errorContainer = container.querySelector('#adguard-error-container');

        // Reset button state
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = 'Add Rule';
        }

        let selectedAction = 'block';

        // Load targets (now populates custom dropdown)
        await loadTargets(optionsContainer, hiddenInput, triggerLabel, errorContainer);

        // --- Custom Dropdown Logic ---

        // Toggle Dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = optionsContainer.classList.contains('open');

            // Close all others if any (not needed here but good practice)

            if (isOpen) {
                optionsContainer.classList.remove('open');
                trigger.classList.remove('open');
            } else {
                optionsContainer.classList.add('open');
                trigger.classList.add('open');
            }
        });

        // Close dropdown when clicking outside
        container.addEventListener('click', () => {
            optionsContainer.classList.remove('open');
            trigger.classList.remove('open');
        });

        // Handle Option Click (Delegation)
        optionsContainer.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent closing immediately
            const optionDiv = e.target.closest('.adguard-select-option');
            if (!optionDiv) return;

            // Remove selected class from all
            optionsContainer.querySelectorAll('.adguard-select-option').forEach(opt => opt.classList.remove('selected'));

            // Set State
            const value = optionDiv.dataset.value;
            const labelHtml = optionDiv.innerHTML;

            hiddenInput.value = value;
            triggerLabel.innerHTML = labelHtml;
            optionDiv.classList.add('selected');

            // Close Dropdown
            optionsContainer.classList.remove('open');
            trigger.classList.remove('open');

            // Trigger Update
            updatePreview();
        });

        // -----------------------------

        function updatePreview() {
            try {
                const { hostname, error } = parseInput(url);
                if (error) {
                    rulePreview.textContent = error;
                    rulePreview.className = 'adguard-rule-preview error';
                    return;
                }

                const isBlock = blockToggle.checked;
                const isClientSpecific = clientToggle.checked;
                const clientValue = clientInput.value.trim();

                let rule = generateRule(hostname, isBlock, null); // Base rule

                if (isClientSpecific && clientValue) {
                    const formattedClients = clientValue.split('|')
                        .map(c => `'${c.trim()}'`)
                        .join('|');
                    rule += `$client=${formattedClients}`;
                }

                rulePreview.textContent = rule;
                rulePreview.className = 'adguard-rule-preview ' + (isBlock ? '' : 'allow');

                // Update label text
                blockLabel.textContent = isBlock ? 'BLOCK' : 'ALLOW';
                if (isBlock) {
                    blockLabel.classList.add('block');
                    blockLabel.classList.remove('allow');
                } else {
                    blockLabel.classList.add('allow');
                    blockLabel.classList.remove('block');
                }

                selectedAction = isBlock ? 'block' : 'allow'; // Update global state for Add Button
            } catch (error) {
                rulePreview.textContent = error.message;
                rulePreview.className = 'adguard-rule-preview error';
            }
        }

        blockToggle.addEventListener('change', updatePreview);

        // Client Toggle Logic
        clientToggle.addEventListener('change', () => {
            const isSpecific = clientToggle.checked;

            if (isSpecific) {
                clientLabel.classList.add('adguard-hidden');
                clientInput.classList.remove('adguard-hidden');
                setTimeout(() => clientInput.focus(), 100);
            } else {
                clientInput.classList.add('adguard-hidden');
                clientLabel.classList.remove('adguard-hidden');
                clientInput.value = '';
            }
            updatePreview();
        });

        clientInput.addEventListener('input', updatePreview);

        // Use the new close method that handles scroll restoration
        cancelBtn.addEventListener('click', () => {
            if (container.close) container.close();
            else container.remove();
        });

        // Pass the HIDDEN input value
        addBtn.addEventListener('click', () => handleAddRule(url, hiddenInput.value, selectedAction, clientInput.value, addBtn, errorContainer, container));

        updatePreview();
    }

    async function handleAddRule(url, target, action, clientValue, addBtn, errorContainer, container) {
        if (!target) {
            showError(errorContainer, 'Please select a target');
            return;
        }

        const isClientSpecific = document.getElementById('adguard-client-toggle').checked;
        if (isClientSpecific && !clientValue) {
            showError(errorContainer, 'Please enter a Client IP or ID');
            document.getElementById('adguard-client-input').focus();
            return;
        }

        addBtn.disabled = true;
        addBtn.textContent = 'Adding...';

        try {
            const { hostname, error } = parseInput(url);
            if (error) throw new Error(error);

            // Pass resolved clientValue (only if toggle is ON and value exists)
            let finalClientValue = null;
            if (isClientSpecific && clientValue) {
                finalClientValue = clientValue.split('|')
                    .map(c => `'${c.trim()}'`)
                    .join('|');
            }
            // Note: We modify generateRule call below to handle pre-formatted string or null
            // Actually generateRule inside here expects raw value and wraps it. 
            // We should bypass the wrapping inside generateRule if we format it here, OR update generateRule.
            // Let's look at generateRule at line 65: rule += `$client='${clientValue.trim()}'`;
            // It blindly wraps in single quotes.
            // PROPOSAL: Update generateRule to accept raw string and NOT wrap it if it looks framed?
            // BETTER: Don't use the 'clientValue' param of generateRule, append manually like in add-rule.js

            const ruleBase = generateRule(hostname, action === 'block', null);
            let rule = ruleBase;

            if (finalClientValue) {
                rule += `$client=${finalClientValue}`;
            }
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
                setTimeout(() => container.close(), 1500);
                addBtn.disabled = false;
                addBtn.textContent = 'Add Rule';
                return;
            }

            // Handle domain conflict - show confirmation
            if (hasDomainConflict) {
                const shouldReplace = await showConfirmationDialog(hostname, conflictingRule, rule, serverIds.length, errorContainer, container);

                if (!shouldReplace) {
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
                setTimeout(() => container.close(), 1500);
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
                setTimeout(() => container.close(), 1500);
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

    /**
     * Sanitize text to prevent XSS attacks
     * Ensures all user-controlled data is safely rendered as text
     * @param {any} text - Text to sanitize
     * @returns {string} Sanitized text safe for DOM insertion
     */
    function sanitizeText(text) {
        // Handle null, undefined, and non-string types
        if (text === null || text === undefined) return '';

        // Convert to string and escape HTML entities
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.textContent;
    }

    async function loadTargets(optionsContainer, hiddenInput, triggerLabel, errorContainer) {
        try {
            const servers = await window.app.sendMessage('getServers') || [];
            const groups = await window.app.sendMessage('getGroups') || [];

            optionsContainer.innerHTML = '';

            // NOTE: We do not set "None" here because we want to force a selection or default to first available

            // Track if we selected a default
            let firstValue = null;
            let firstLabel = null;

            if (groups.length > 0) {
                const groupLabel = document.createElement('div');
                groupLabel.className = 'adguard-optgroup-label';
                groupLabel.textContent = 'Groups';
                optionsContainer.appendChild(groupLabel);

                groups.forEach(group => {
                    const option = document.createElement('div');
                    option.className = 'adguard-select-option';
                    option.dataset.value = `group:${escapeHtml(group.id)}`;
                    // Use SVG Icon (Group - Orange)
                    option.innerHTML = `
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#FFA726" stroke="#F57C00" stroke-width="2" style="flex-shrink: 0;">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        ${escapeHtml(group.name)}
                    `;

                    optionsContainer.appendChild(option);

                    if (!firstValue) {
                        firstValue = option.dataset.value;
                        firstLabel = option.innerHTML;
                    }
                });
            }

            if (servers.length > 0) {
                const serverLabel = document.createElement('div');
                serverLabel.className = 'adguard-optgroup-label';
                serverLabel.textContent = 'Servers';
                optionsContainer.appendChild(serverLabel);

                servers.forEach(server => {
                    const option = document.createElement('div');
                    option.className = 'adguard-select-option';
                    option.dataset.value = `server:${escapeHtml(server.id)}`;

                    // Use SVG Icon (Server - Blue)
                    option.innerHTML = `
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#42A5F5" stroke="#1976D2" stroke-width="2" style="flex-shrink: 0;">
                            <rect x="2" y="4" width="13" height="10" rx="2"></rect>
                            <line x1="8.5" y1="14" x2="8.5" y2="17"></line>
                            <line x1="4.5" y1="17" x2="12.5" y2="17"></line>
                            <rect x="17" y="4" width="5" height="13" rx="1"></rect>
                            <circle cx="19.5" cy="7" r="1" fill="#42A5F5" stroke="none"></circle>
                            <line x1="18.5" y1="12" x2="20.5" y2="12"></line>
                            <line x1="18.5" y1="14" x2="20.5" y2="14"></line>
                        </svg>
                        ${escapeHtml(server.name)}
                    `;

                    optionsContainer.appendChild(option);

                    if (!firstValue) {
                        firstValue = option.dataset.value;
                        firstLabel = option.innerHTML;
                    }
                });
            }

            if (servers.length === 0 && groups.length === 0) {
                showError(errorContainer, 'No servers configured. Please add a server first.');
                triggerLabel.textContent = "No servers found";
            } else {
                // Auto-select the first item
                if (firstValue) {
                    hiddenInput.value = firstValue;
                    triggerLabel.innerHTML = firstLabel;
                } else {
                    triggerLabel.textContent = "Select target...";
                }
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
    // Show confirmation dialog within modal
    async function showConfirmationDialog(domain, existingRule, newRule, serverCount, errorContainer, container) {
        return new Promise((resolve) => {
            const existingType = getRuleType(existingRule);
            const newType = getRuleType(newRule);

            const formContainer = container.querySelector('#adguard-form-container');
            const formContent = container.querySelector('#adguard-form-content');

            // Hide original form content (preserves listeners)
            formContent.style.display = 'none';

            // Create confirmation dialog wrapper
            const confirmWrapper = document.createElement('div');
            confirmWrapper.id = 'adguard-confirmation-dialog';

            confirmWrapper.innerHTML = `
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
            formContainer.appendChild(confirmWrapper);

            const confirmCancelBtn = confirmWrapper.querySelector('#confirm-cancel');
            const replaceBtn = confirmWrapper.querySelector('#confirm-replace');

            // Cancel - Remove dialog, show form, resolve false
            confirmCancelBtn.addEventListener('click', () => {
                confirmWrapper.remove();
                formContent.style.display = 'block';
                resolve(false);
            });

            // Replace All
            replaceBtn.addEventListener('click', () => {
                confirmCancelBtn.disabled = true;
                replaceBtn.disabled = true;
                replaceBtn.textContent = 'Replacing...';
                errorContainer.innerHTML = '';

                // Keep the confirmation dialog visible while replacing? 
                // Or remove it? The logic below updates rules.
                // Let's remove it effectively after processing completes in handleAddRule, 
                // but handleAddRule doesn't call back.

                // For simplified UX, we'll remove it now, implying "Working..."
                // But handleAddRule will show success message in errorContainer.
                confirmWrapper.remove();
                formContent.style.display = 'block';

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
