/**
 * Add Rule View Component
 * Uses EXACT same card structure as server-list.js
 */

import { parseInput } from '../utils/rule-parser.js';
import { generateRule } from '../utils/rule-generator.js';
import { addRuleToTarget } from '../services/add-rule-service.js';
import { escapeHtml } from '../utils.js';

export async function renderAddRule(container) {
    const servers = await window.app.sendMessage('getServers');
    const groups = await window.app.sendMessage('getGroups');

    // Use EXACT same structure as server cards
    container.innerHTML = `
        <div class="server-card">
            <div class="card-header">
                <h3 class="card-title">ADD RULE</h3>
            </div>
            <div class="card-content">
                <div class="form-group">
                    <input 
                        type="text" 
                        id="rule-input" 
                        class="form-input" 
                        placeholder="example.com or ||example.com^"
                    />
                </div>
                
                <div class="form-row">
                    <label class="form-label">Block / Allow</label>
                    <label class="toggle-switch block-toggle">
                        <input type="checkbox" id="block-toggle" checked>
                        <span class="slider"></span>
                        <span id="block-label" class="toggle-label">BLOCK</span>
                    </label>
                </div>
                
                <div class="form-row">
                    <label class="form-label">Important</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="important-toggle">
                        <span class="slider"></span>
                        <span id="important-label" class="toggle-label">OFF</span>
                    </label>
                </div>
                
                <div id="rule-preview" class="rule-preview empty">
                    Enter a domain to see preview
                </div>
                
                <div class="form-row">
                    <select id="rule-target" class="form-select">
                        <option value="">No Groups</option>
                        ${groups && groups.length > 0 ? `
                            <optgroup label="Groups">
                                ${groups.map(g => `<option value="group:${g.id}">${escapeHtml(g.name)}</option>`).join('')}
                            </optgroup>
                        ` : ''}
                        ${servers && servers.length > 0 ? `
                            <optgroup label="Servers">
                                ${servers.map(s => `<option value="server:${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                            </optgroup>
                        ` : ''}
                    </select>
                    
                    <button id="add-sync-btn" class="btn btn-primary">
                        ADD & SYNC
                    </button>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    const input = document.getElementById('rule-input');
    const blockToggle = document.getElementById('block-toggle');
    const blockLabel = document.getElementById('block-label');
    const importantToggle = document.getElementById('important-toggle');
    const importantLabel = document.getElementById('important-label');
    const preview = document.getElementById('rule-preview');
    const target = document.getElementById('rule-target');
    const btn = document.getElementById('add-sync-btn');

    // Update preview function
    function updatePreview() {
        const inputValue = input.value.trim();
        const isBlock = blockToggle.checked;
        const isImportant = importantToggle.checked;

        if (!inputValue) {
            preview.textContent = 'Enter a domain to see preview';
            preview.className = 'rule-preview empty';
            return;
        }

        const { hostname, error } = parseInput(inputValue);
        if (error) {
            preview.textContent = error;
            preview.className = 'rule-preview error';
            return;
        }

        const rule = generateRule(hostname, isBlock, isImportant);
        preview.textContent = rule;
        preview.className = isBlock ? 'rule-preview block' : 'rule-preview allow';
    }

    // Block toggle handler
    blockToggle.addEventListener('change', () => {
        const isBlock = blockToggle.checked;
        blockLabel.textContent = isBlock ? 'BLOCK' : 'ALLOW';
        const toggleContainer = blockToggle.closest('.toggle-switch');
        if (isBlock) {
            toggleContainer.classList.add('block-toggle');
            toggleContainer.classList.remove('allow-toggle');
        } else {
            toggleContainer.classList.remove('block-toggle');
            toggleContainer.classList.add('allow-toggle');
        }
        updatePreview();
    });

    // Important toggle handler
    importantToggle.addEventListener('change', () => {
        const isImportant = importantToggle.checked;
        importantLabel.textContent = isImportant ? 'ON' : 'OFF';
        updatePreview();
    });

    // Input change handler
    input.addEventListener('input', updatePreview);

    // Add button handler
    btn.addEventListener('click', async () => {
        const inputValue = input.value.trim();
        const targetValue = target.value;
        const isBlock = blockToggle.checked;
        const isImportant = importantToggle.checked;

        if (!inputValue) {
            window.app.showToast('Please enter a domain or URL', 'error');
            return;
        }

        if (!targetValue) {
            window.app.showToast('Please select a target', 'error');
            return;
        }

        // Parse input
        const { hostname, error } = parseInput(inputValue);
        if (error) {
            window.app.showToast(error, 'error');
            return;
        }

        // Generate rule
        const rule = generateRule(hostname, isBlock, isImportant);

        // Disable button
        btn.disabled = true;
        btn.textContent = 'Adding...';

        try {
            const summary = await addRuleToTarget(targetValue, rule);

            // Show results
            if (summary.success > 0) {
                const ruleType = isBlock ? 'Block' : 'Allow';
                window.app.showToast(`${ruleType} rule added to ${summary.success}/${summary.total} server(s)`, 'success');
                input.value = '';
                updatePreview();
            }

            if (summary.duplicate > 0) {
                window.app.showToast(`Rule already exists on ${summary.duplicate} server(s)`, 'info');
            }

            if (summary.failed > 0) {
                window.app.showToast(`Failed on ${summary.failed} server(s)`, 'error');
            }
        } catch (error) {
            console.error('Add rule error:', error);
            window.app.showToast(`Error: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'ADD & SYNC';
        }
    });
}
