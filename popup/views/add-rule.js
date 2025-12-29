/**
 * Add Rule Component
 * Matches screenshot pixel-perfect, uses existing CSS patterns
 */

import { parseInput } from '../utils/rule-parser.js';
import { generateRule } from '../utils/rule-generator.js';
import { addRuleToTarget } from '../services/add-rule-service.js';

export async function renderAddRuleSection(container) {
    const servers = await window.app.sendMessage('getServers');
    const groups = await window.app.sendMessage('getGroups');

    // Use view-body with 1px margin-top for exact spacing
    container.innerHTML = `
        <div class="view-body" style="margin-top: 1px;">
            <div class="add-rule-card">
                <div class="add-rule-header">
                    <h2>ADD RULE</h2>
                </div>
                <div class="add-rule-body">
                    <input 
                        type="text" 
                        id="rule-input" 
                        class="add-rule-input" 
                        placeholder="example.com or ||example.com^"
                    />
                    
                    <select id="rule-target" class="add-rule-select">
                        <option value="">None</option>
                        ${groups && groups.length > 0 ? `
                            <optgroup label="Groups">
                                ${groups.map(g => `<option value="group:${g.id}">📁 ${escapeHtml(g.name)}</option>`).join('')}
                            </optgroup>
                        ` : ''}
                        ${servers && servers.length > 0 ? `
                            <optgroup label="Servers">
                                ${servers.map(s => `<option value="server:${s.id}">🖥️ ${escapeHtml(s.name)}</option>`).join('')}
                            </optgroup>
                        ` : ''}
                    </select>
                    
                    <div class="add-rule-toggles">
                        <label class="toggle-wrapper toggle-left">
                            <input type="checkbox" id="block-toggle" checked>
                            <span id="block-label" class="toggle-text block">BLOCK</span>
                        </label>
                        
                        <label class="toggle-wrapper toggle-right">
                            <span id="importance-label" class="toggle-text">IMPORTANCE</span>
                            <input type="checkbox" id="importance-toggle">
                        </label>
                    </div>
                    
                    <div id="rule-preview" class="rule-preview">||example.com^</div>
                    
                    <button id="add-sync-btn" class="btn btn-primary">ADD TO RULE</button>
                </div>
            </div>
        </div>
    `;

    setupEventListeners();
}

function setupEventListeners() {
    const input = document.getElementById('rule-input');
    const target = document.getElementById('rule-target');
    const blockToggle = document.getElementById('block-toggle');
    const blockLabel = document.getElementById('block-label');
    const importanceToggle = document.getElementById('importance-toggle');
    const importanceLabel = document.getElementById('importance-label');
    const preview = document.getElementById('rule-preview');
    const btn = document.getElementById('add-sync-btn');

    function updatePreview() {
        const inputValue = input.value.trim();
        const isBlock = blockToggle.checked;
        const isImportant = importanceToggle.checked;

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

        const rule = generateRule(hostname, isBlock, isImportant);
        preview.textContent = rule;
        preview.className = isBlock ? 'rule-preview block' : 'rule-preview allow';
    }

    blockToggle.addEventListener('change', () => {
        const isBlock = blockToggle.checked;
        blockLabel.textContent = isBlock ? 'BLOCK' : 'ALLOW';
        blockLabel.className = isBlock ? 'toggle-text block' : 'toggle-text allow';
        updatePreview();
    });

    importanceToggle.addEventListener('change', () => {
        const isImportant = importanceToggle.checked;
        importanceLabel.className = isImportant ? 'toggle-text important' : 'toggle-text';
        updatePreview();
    });

    input.addEventListener('input', updatePreview);

    btn.addEventListener('click', async () => {
        const inputValue = input.value.trim();
        const targetValue = target.value;
        const isBlock = blockToggle.checked;
        const isImportant = importanceToggle.checked;

        if (!inputValue) {
            window.app.showToast('Please enter a domain or URL', 'error');
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

        const rule = generateRule(hostname, isBlock, isImportant);

        btn.disabled = true;
        btn.textContent = 'Adding...';

        try {
            const summary = await addRuleToTarget(targetValue, rule);

            if (summary.success > 0) {
                const ruleType = isBlock ? 'Block' : 'Allow';
                window.app.showToast(`${ruleType} rule added to ${summary.success}/${summary.total} server(s)`, 'success');
                input.value = '';
                updatePreview();
            }

            if (summary.duplicate > 0) {
                window.app.showToast(`Rule exists on ${summary.duplicate} server(s)`, 'info');
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
