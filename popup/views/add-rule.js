/**
 * Add Rule Component
 * Matches screenshot pixel-perfect, uses existing CSS patterns
 */

import { parseInput } from '../utils/rule-parser.js';
import { generateRule } from '../utils/rule-generator.js';
import { addRuleToTarget } from '../services/add-rule-service.js';
import { escapeHtml } from '../utils.js';


export async function renderAddRuleSection(container, options = {}) {
    const { compact = false } = options;
    const servers = await window.app.sendMessage('getServers');
    const groups = await window.app.sendMessage('getGroups');

    // Check if there are any servers or groups
    const hasServers = servers && servers.length > 0;
    const hasGroups = groups && groups.length > 0;

    // Normal rendering when servers exist
    container.innerHTML = `
        <div class="view-body" style="margin-top: 1px; ${compact ? 'padding: 0;' : ''}">
            <div class="${compact ? '' : 'add-rule-card'}" style="${compact ? 'border: none; box-shadow: none; background: transparent;' : ''}">
                ${compact ? '' : `
                <div class="add-rule-header">
                    <h2>ADD RULE</h2>
                </div>
                `}
                <div class="add-rule-body" style="${compact ? 'padding: 0;' : ''}">
                    <input 
                        type="text" 
                        id="rule-input" 
                        class="add-rule-input" 
                        placeholder="example.com or ||example.com^"
                    />
                    
                    <!-- Custom Dropdown with SVG Support -->
                    <div class="custom-dropdown" id="rule-target-dropdown">
                        <div class="dropdown-selected" id="dropdown-selected">
                            <span class="dropdown-text">None</span>
                            <svg class="dropdown-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                        <div class="dropdown-options" id="dropdown-options">
                            <!-- 'None' option removed by user request -->
                            ${hasGroups ? `
                                <div class="dropdown-label">Groups</div>
                                ${groups.map(g => `
                                    <div class="dropdown-option" data-value="group:${g.id}">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#FFA726" stroke="#F57C00" stroke-width="2">
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                        </svg>
                                        <span>${escapeHtml(g.name)}</span>
                                    </div>
                                `).join('')}
                            ` : ''}
                            ${hasServers ? `
                                <div class="dropdown-label">Servers</div>
                                ${servers.map(s => `
                                    <div class="dropdown-option" data-value="server:${s.id}">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#42A5F5" stroke="#1976D2" stroke-width="2">
                                            <rect x="2" y="4" width="13" height="10" rx="2"></rect>
                                            <line x1="8.5" y1="14" x2="8.5" y2="17"></line>
                                            <line x1="4.5" y1="17" x2="12.5" y2="17"></line>
                                            <rect x="17" y="4" width="5" height="13" rx="1"></rect>
                                            <circle cx="19.5" cy="7" r="1" fill="#42A5F5" stroke="none"></circle>
                                            <line x1="18.5" y1="12" x2="20.5" y2="12"></line>
                                            <line x1="18.5" y1="14" x2="20.5" y2="14"></line>
                                        </svg>
                                        <span>${escapeHtml(s.name)}</span>
                                    </div>
                                `).join('')}
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="add-rule-toggles">
                        <label class="toggle-wrapper toggle-left">
                            <input type="checkbox" id="block-toggle" checked>
                            <span id="block-label" class="toggle-text block">BLOCK</span>
                        </label>
                        
                        <div class="toggle-wrapper toggle-right client-toggle-container">
                            <input 
                                type="text" 
                                id="client-input" 
                                class="add-rule-input compact-client-input hidden" 
                                placeholder="IP / Client ID / Name" 
                                title="Use | to separate multiple clients (e.g. ipad|iphone)"
                            />
                            <label class="client-switch-wrapper">
                                <span id="client-label" class="toggle-text">CLIENT</span>
                                <input type="checkbox" id="client-toggle">
                            </label>
                        </div>
                    </div>
                    
                    <div id="rule-preview" class="rule-preview">||example.com^</div>
                    
                    <button id="add-sync-btn" class="btn btn-primary">ADD TO RULES</button>
                </div>
            </div>
        </div>
    `;

    setupEventListeners();
}

function setupEventListeners() {
    const input = document.getElementById('rule-input');
    const blockToggle = document.getElementById('block-toggle');
    const blockLabel = document.getElementById('block-label');

    // Client Specific Logic
    const clientToggle = document.getElementById('client-toggle');
    const clientLabel = document.getElementById('client-label');
    const clientInput = document.getElementById('client-input');

    const preview = document.getElementById('rule-preview');
    const btn = document.getElementById('add-sync-btn');

    // Custom dropdown elements
    const dropdown = document.getElementById('rule-target-dropdown');
    const dropdownSelected = document.getElementById('dropdown-selected');
    const dropdownOptions = document.getElementById('dropdown-options');
    let selectedValue = '';
    let selectedText = 'Select Target';

    // Auto-select first option if available
    const firstOption = dropdownOptions.querySelector('.dropdown-option[data-value]');
    if (firstOption) {
        selectedValue = firstOption.dataset.value;
        const span = firstOption.querySelector('span');
        selectedText = span ? span.textContent : firstOption.textContent.trim();

        // Update UI to match
        const svgClone = firstOption.querySelector('svg')?.cloneNode(true);
        const dropdownText = dropdownSelected.querySelector('.dropdown-text');

        if (svgClone) {
            dropdownText.innerHTML = '';
            svgClone.style.marginRight = '6px';
            dropdownText.appendChild(svgClone);
            const textSpan = document.createElement('span');
            textSpan.textContent = selectedText;
            dropdownText.appendChild(textSpan);
        } else {
            dropdownText.textContent = selectedText;
        }

        firstOption.classList.add('selected');
    }


    // Toggle dropdown open/close
    dropdownSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownOptions.classList.contains('show');

        if (isOpen) {
            dropdownOptions.classList.remove('show');
            dropdownSelected.classList.remove('open');
            dropdownSelected.classList.remove('open-upward');
            dropdownOptions.classList.remove('open-upward');
        } else {
            // Get position for fixed positioning
            const rect = dropdownSelected.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const dropdownHeight = 180;

            // Position dropdown
            dropdownOptions.style.left = rect.left + 'px';
            dropdownOptions.style.width = rect.width + 'px';

            // Open upward if not enough space below
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                dropdownOptions.style.top = 'auto';
                dropdownOptions.style.bottom = (window.innerHeight - rect.top) + 'px';
                dropdownOptions.classList.add('open-upward');
                dropdownSelected.classList.add('open-upward');
            } else {
                dropdownOptions.style.top = rect.bottom + 'px';
                dropdownOptions.style.bottom = 'auto';
                dropdownOptions.classList.remove('open-upward');
                dropdownSelected.classList.remove('open-upward');
            }

            dropdownOptions.classList.add('show');
            dropdownSelected.classList.add('open');
        }
    });

    // Handle option selection
    dropdownOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.dropdown-option');
        if (!option) return;

        // Remove previous selection
        document.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('selected'));

        // Set new selection
        option.classList.add('selected');
        selectedValue = option.dataset.value;

        // Get the text content (skip SVG)
        const textContent = option.querySelector('span')?.textContent || option.textContent.trim();
        selectedText = textContent;

        // Update displayed text (with icon if applicable)
        const svgClone = option.querySelector('svg')?.cloneNode(true);
        const dropdownText = dropdownSelected.querySelector('.dropdown-text');

        if (svgClone) {
            dropdownText.innerHTML = '';
            svgClone.style.marginRight = '6px';
            dropdownText.appendChild(svgClone);
            const textSpan = document.createElement('span');
            textSpan.textContent = textContent;
            dropdownText.appendChild(textSpan);
        } else {
            dropdownText.textContent = textContent;
        }

        // Close dropdown
        dropdownOptions.classList.remove('show');
        dropdownSelected.classList.remove('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdownOptions.classList.remove('show');
            dropdownSelected.classList.remove('open');
        }
    });

    // Helper function to get dropdown value
    const getTargetValue = () => selectedValue;

    function updatePreview() {
        const inputValue = input.value.trim();
        const isBlock = blockToggle.checked;
        const isClientSpecific = clientToggle.checked;
        const clientValue = clientInput.value.trim();

        if (!inputValue) {
            preview.textContent = '||example.com^';
            preview.className = 'rule-preview';
            return;
        }

        const { hostname, error } = parseInput(inputValue);
        if (error) {
            preview.textContent = error;
            preview.className = 'rule-preview error';
            return;
        }

        let rule = generateRule(hostname, isBlock, false); // generateRule handles basic syntax

        // Manual append for Client Logic (multi-client support via pipe)
        if (isClientSpecific && clientValue) {
            const formattedClients = clientValue.split('|')
                .map(c => `'${c.trim()}'`)
                .join('|');
            rule += `$client=${formattedClients}`;
        }

        preview.textContent = rule;
        preview.className = isBlock ? 'rule-preview block' : 'rule-preview allow';
    }

    blockToggle.addEventListener('change', () => {
        const isBlock = blockToggle.checked;
        blockLabel.textContent = isBlock ? 'BLOCK' : 'ALLOW';
        blockLabel.className = isBlock ? 'toggle-text block' : 'toggle-text allow';
        updatePreview();
    });

    // Client Toggle Logic
    clientToggle.addEventListener('change', () => {
        const isSpecific = clientToggle.checked;

        if (isSpecific) {
            clientLabel.classList.add('hidden');
            clientInput.classList.remove('hidden');
            setTimeout(() => clientInput.focus(), 100);
        } else {
            clientInput.classList.add('hidden');
            clientLabel.classList.remove('hidden');
            clientInput.value = '';
        }
        updatePreview();
    });

    input.addEventListener('input', updatePreview);
    clientInput.addEventListener('input', updatePreview);

    btn.addEventListener('click', async () => {
        const inputValue = input.value.trim();
        const targetValue = getTargetValue();
        const isBlock = blockToggle.checked;
        const isClientSpecific = clientToggle.checked;
        const clientValue = clientInput.value.trim();

        if (!inputValue) {
            window.app.showToast('Please enter a domain or URL', 'error');
            return;
        }

        if (isClientSpecific && !clientValue) {
            window.app.showToast('Please enter a Client IP or ID', 'error');
            clientInput.focus();
            return;
        }

        if (!targetValue) {
            window.app.showToast('Please select a target', 'error');
            return;
        }

        const { hostname, error } = parseInput(inputValue);
        if (error) {
            window.app.showToast(error, 'error');
            return;
        }

        let rule = generateRule(hostname, isBlock, false);
        if (isClientSpecific && clientValue) {
            const formattedClients = clientValue.split('|')
                .map(c => `'${c.trim()}'`)
                .join('|');
            rule += `$client=${formattedClients}`;
        }

        btn.disabled = true;
        btn.textContent = 'Adding...';

        try {
            const summary = await addRuleToTarget(targetValue, rule);

            if (summary.success > 0) {
                const ruleType = isBlock ? 'Block' : 'Allow';
                let message = `${ruleType} rule added to ${summary.success}/${summary.total} server(s)`;

                if (summary.replaced > 0) {
                    message += ` (${summary.replaced} replaced)`;
                }

                window.app.showToast(message, 'success');
                input.value = '';
                // Don't clear client input - might want to add another for same kid
                updatePreview();
            }

            if (summary.duplicate > 0) {
                window.app.showToast(`Rule exists on ${summary.duplicate} server(s)`, 'info');
            }

            if (summary.failed > 0) {
                const errorMsg = summary.domainConflicts.length > 0
                    ? `Cancelled or failed on ${summary.failed} server(s)`
                    : `Failed on ${summary.failed} server(s)`;
                window.app.showToast(errorMsg, 'error');
            }
        } catch (error) {
            console.error('Add rule error:', error);
            window.app.showToast(`Error: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'ADD TO RULES';
        }
    });
}
