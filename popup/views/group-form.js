// Group Form View
// Create/Edit groups with merged rule preview

export async function renderGroupForm(container, data = {}) {
    const { mode = 'add', groupId } = data;
    const isEdit = mode === 'edit';

    let group = null;
    if (isEdit && groupId) {
        group = await window.app.sendMessage('getGroup', { id: groupId });
        if (!group) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">Group Not Found</div>
                    <button class="btn btn-primary" onclick="window.app.navigateTo('settings')">
                        Back to Settings
                    </button>
                </div>
            `;
            return;
        }
    }

    // Fetch all servers
    const servers = await window.app.sendMessage('getServers');

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="btn btn-ghost btn-sm" id="back-btn">
                    ← Back
                </button>
                <h1 class="view-title">${isEdit ? 'Edit' : 'Create'} Group</h1>
                <div class="flex-1"></div>
            </div>

            <div class="view-body">
                <div class="form-group">
                    <label class="form-label" for="group-name">Group Name</label>
                    <input
                        type="text"
                        id="group-name"
                        class="form-input"
                        placeholder="Enter group name"
                        value="${group ? escapeHtml(group.name) : ''}"
                        required
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">Select Servers</label>
                    <div class="server-checkboxes" id="server-checkboxes">
                        ${servers.map(server => `
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    class="server-checkbox"
                                    value="${server.id}"
                                    ${group && group.serverIds.includes(server.id) ? 'checked' : ''}
                                />
                                <span>${escapeHtml(server.name)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div id="warnings-container"></div>

                <div class="form-group">
                    <label class="form-label">Merged Rules Preview</label>
                    <div class="rule-counts-card" id="preview-counts">
                        <span class="badge badge-info">Select servers to preview</span>
                    </div>
                    <div class="rules-preview" id="rules-preview">
                        <div class="empty-state-text">Select servers to see merged rules</div>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button class="btn btn-secondary flex-1" id="cancel-btn">Cancel</button>
                    <button class="btn btn-primary flex-1" id="save-btn">
                        ${isEdit ? 'Update' : 'Create'} Group
                    </button>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('back-btn').addEventListener('click', () => {
        window.app.navigateTo('settings');
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
        window.app.navigateTo('settings');
    });

    document.getElementById('save-btn').addEventListener('click', () => {
        handleSaveGroup(isEdit, groupId);
    });

    // Server checkbox change handler
    document.querySelectorAll('.server-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updatePreview();
        });
    });

    // Initial preview if editing
    if (isEdit) {
        updatePreview();
    }
}

async function updatePreview() {
    const selectedServerIds = Array.from(document.querySelectorAll('.server-checkbox:checked'))
        .map(cb => cb.value);

    if (selectedServerIds.length === 0) {
        document.getElementById('preview-counts').innerHTML = `
            <span class="badge badge-info">Select servers to preview</span>
        `;
        document.getElementById('rules-preview').innerHTML = `
            <div class="preview-empty-badge">
                <span class="badge badge-secondary">Select servers to see merged rules</span>
            </div>
        `;
        document.getElementById('warnings-container').innerHTML = '';

        // Clear all server counts
        document.querySelectorAll('.server-checkbox').forEach(cb => {
            const label = cb.closest('.checkbox-label');
            const existingCounts = label.querySelector('.server-counts');
            if (existingCounts) {
                existingCounts.remove();
            }
        });

        return;
    }

    try {
        // Fetch individual server counts and merge
        const serverCounts = {};
        const allRules = [];
        const warnings = [];

        for (const serverId of selectedServerIds) {
            const cache = await window.app.sendMessage('getCache', { serverId });

            if (!cache || !cache.rules) {
                const server = await window.app.sendMessage('getServer', { id: serverId });
                warnings.push(`${server.name} not synced yet — refresh first`);
                serverCounts[serverId] = null;
                continue;
            }

            const counts = getRuleCounts(cache.rules);
            serverCounts[serverId] = counts;
            allRules.push(...cache.rules);
        }

        // Update server labels with counts
        document.querySelectorAll('.server-checkbox').forEach(cb => {
            const label = cb.closest('.checkbox-label');
            const existingCounts = label.querySelector('.server-counts');
            if (existingCounts) {
                existingCounts.remove();
            }

            if (cb.checked && serverCounts[cb.value]) {
                const counts = serverCounts[cb.value];
                const countsHtml = document.createElement('div');
                countsHtml.className = 'server-counts';
                countsHtml.innerHTML = `
                    <span class="count-item count-allow">${counts.allow}</span>
                    <span class="count-item count-block">${counts.block}</span>
                    <span class="count-item count-disabled">${counts.disabled}</span>
                `;
                label.appendChild(countsHtml);
            }
        });

        // Normalize and deduplicate for merged view
        const normalized = allRules.map(normalizeRule).filter(r => r);
        const deduped = dedupRules(normalized);
        const mergedCounts = getRuleCounts(deduped);

        // Display warnings
        if (warnings.length > 0) {
            document.getElementById('warnings-container').innerHTML = `
                <div class="warning-banner">
                    ⚠️ ${warnings.join('<br>⚠️ ')}
                </div>
            `;
        } else {
            document.getElementById('warnings-container').innerHTML = '';
        }

        // Display merged counts
        document.getElementById('preview-counts').innerHTML = `
            <span class="badge badge-success">${mergedCounts.allow} Allow</span>
            <span class="badge badge-danger">${mergedCounts.block} Block</span>
            <span class="badge badge-warning">${mergedCounts.disabled} Disabled</span>
            <span class="badge badge-info">${mergedCounts.total} Total</span>
        `;

        // Display rules
        if (deduped.length === 0) {
            document.getElementById('rules-preview').innerHTML = `
                <div class="preview-empty-badge">
                    <span class="badge badge-secondary">No rules found</span>
                </div>
            `;
        } else {
            const rulesHtml = deduped.map(rule => {
                const type = classifyRule(rule);
                const colorClass = type === 'allow' ? 'rule-allow' :
                    type === 'disabled' ? 'rule-disabled' : 'rule-block';

                return `
                    <div class="rule-item ${colorClass}">
                        <span class="rule-indicator"></span>
                        <span class="rule-text">${escapeHtml(rule)}</span>
                    </div>
                `;
            }).join('');

            document.getElementById('rules-preview').innerHTML = rulesHtml;
        }

    } catch (error) {
        console.error('Failed to update preview:', error);
        document.getElementById('warnings-container').innerHTML = `
            <div class="warning-banner">
                ⚠️ Failed to load preview: ${error.message}
            </div>
        `;
    }
}

async function mergeRulesFromServers(serverIds) {
    const allRules = [];
    const warnings = [];

    for (const serverId of serverIds) {
        const cache = await window.app.sendMessage('getCache', { serverId });

        if (!cache || !cache.rules) {
            const server = await window.app.sendMessage('getServer', { id: serverId });
            warnings.push(`${server.name} not synced yet — refresh first`);
            continue;
        }

        allRules.push(...cache.rules);
    }

    // Normalize and deduplicate
    const normalized = allRules.map(normalizeRule).filter(r => r);
    const deduped = dedupRules(normalized);

    return {
        rules: deduped,
        warnings,
        counts: getRuleCounts(deduped)
    };
}

async function handleSaveGroup(isEdit, groupId) {
    const name = document.getElementById('group-name').value.trim();
    const selectedServerIds = Array.from(document.querySelectorAll('.server-checkbox:checked'))
        .map(cb => cb.value);

    if (!name) {
        window.app.showToast('Please enter a group name', 'error');
        return;
    }

    if (selectedServerIds.length === 0) {
        window.app.showToast('Please select at least one server', 'error');
        return;
    }

    try {
        window.app.showLoading();

        // Merge rules
        const result = await mergeRulesFromServers(selectedServerIds);

        // Create group object
        const group = {
            id: isEdit ? groupId : generateId(),
            name,
            serverIds: selectedServerIds,
            rules: result.rules
        };

        // Save group
        await window.app.sendMessage('saveGroup', { group });

        window.app.hideLoading();
        window.app.showToast(`Group ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        window.app.navigateTo('settings');

    } catch (error) {
        window.app.hideLoading();
        window.app.showToast('Failed to save group: ' + error.message, 'error');
    }
}

// Helper functions
function generateId() {
    return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function normalizeRule(rule) {
    if (typeof rule !== 'string') return '';
    return rule.trim();
}

function dedupRules(rules) {
    return [...new Set(rules)];
}

function classifyRule(rule) {
    if (typeof rule !== 'string') return 'unknown';
    const trimmed = rule.trim();
    if (!trimmed) return 'disabled';
    if (trimmed.startsWith('!')) return 'disabled';
    if (trimmed.startsWith('# ')) return 'disabled';
    if (trimmed.startsWith('@@')) return 'allow';
    return 'block';
}

function getRuleCounts(rules) {
    if (!Array.isArray(rules)) {
        return { allow: 0, block: 0, disabled: 0, total: 0 };
    }

    let allow = 0, block = 0, disabled = 0;

    for (const rule of rules) {
        const type = classifyRule(rule);
        if (type === 'allow') allow++;
        else if (type === 'disabled') disabled++;
        else block++;
    }

    return { allow, block, disabled, total: rules.length };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
