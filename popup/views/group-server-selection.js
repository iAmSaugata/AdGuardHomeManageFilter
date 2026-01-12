// Group Server Selection View
// Simple server selection page for creating/editing groups

import { escapeHtml } from '../utils.js';

export async function renderGroupServerSelection(container, data = {}) {
    const { mode = 'create', groupId } = data;
    const isEdit = mode === 'edit';

    // Fetch servers and groups
    const [servers, allGroups] = await Promise.all([
        window.app.sendMessage('getServers'),
        window.app.sendMessage('getGroups')
    ]);

    let group = null;
    if (isEdit && groupId) {
        group = await window.app.sendMessage('getGroup', { id: groupId });
        if (!group) {
            window.app.showToast('Group not found', 'error');
            window.app.navigateTo('settings');
            return;
        }
    }

    // Filter available servers (exclude servers in other groups)
    const otherGroups = isEdit ? allGroups.filter(g => g.id !== groupId) : allGroups;
    const usedServerIds = new Set();
    otherGroups.forEach(g => {
        if (g.serverIds) {
            g.serverIds.forEach(id => usedServerIds.add(id));
        }
    });

    const availableServers = servers.filter(s => !usedServerIds.has(s.id));

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-icon-btn" id="back-btn" title="Back">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <h1 class="view-title">MANAGE SERVERS</h1>
                <div class="header-action-area"></div>
            </div>

            <div class="view-body">
                <!-- Group Name -->
                <div class="form-group">
                    <label class="form-label" for="group-name">Group Name</label>
                    <input
                        type="text"
                        id="group-name"
                        class="form-input"
                        placeholder="e.g., Production Servers"
                        value="${group ? escapeHtml(group.name) : ''}"
                        required
                    />
                </div>

                <!-- Server Selection -->
                <div class="form-group">
                    <label class="form-label">Select Servers</label>
                    ${availableServers.length > 0 ? `
                        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="color: var(--color-info);">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4M12 8h.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            ${availableServers.length} of ${servers.length} servers available
                        </div>
                    ` : `
                        <div style="font-size: 12px; color: var(--color-warning); margin-bottom: 12px;">
                            ⚠️ All servers are already in other groups
                        </div>
                    `}
                    
                    <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 12px; background: var(--color-bg-secondary); max-height: 200px; overflow-y: auto;">
                        ${availableServers.map(server => `
                            <label style="display: flex; align-items: center; padding: 10px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" class="server-checkbox-label">
                                <input
                                    type="checkbox"
                                    class="server-checkbox"
                                    value="${server.id}"
                                    ${group && group.serverIds && group.serverIds.includes(server.id) ? 'checked' : ''}
                                    style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;"
                                />
                                <span style="font-size: 14px; color: var(--color-text-primary);">${escapeHtml(server.name)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button class="btn-secondary" id="cancel-btn" style="flex: 1;">Cancel</button>
                    <button class="btn-primary" id="save-btn" style="flex: 1;">Save Changes</button>
                </div>

                <style>
                    .server-checkbox-label:hover {
                        background: var(--color-bg-hover);
                    }
                </style>
            </div>
        </div>
    `;

    // Event Listeners
    const backBtn = container.querySelector('#back-btn');
    const cancelBtn = container.querySelector('#cancel-btn');
    const saveBtn = container.querySelector('#save-btn');
    const groupNameInput = container.querySelector('#group-name');

    backBtn?.addEventListener('click', () => {
        if (isEdit && groupId) {
            window.app.navigateTo('group-settings', { groupId });
        } else {
            window.app.navigateTo('settings');
        }
    });

    cancelBtn?.addEventListener('click', () => {
        if (isEdit && groupId) {
            window.app.navigateTo('group-settings', { groupId });
        } else {
            window.app.navigateTo('settings');
        }
    });

    saveBtn?.addEventListener('click', async () => {
        const name = groupNameInput.value.trim();
        if (!name) {
            window.app.showToast('Please enter a group name', 'error');
            return;
        }

        const selectedServerIds = Array.from(container.querySelectorAll('.server-checkbox:checked'))
            .map(cb => cb.value);

        if (selectedServerIds.length === 0) {
            window.app.showToast('Please select at least one server', 'error');
            return;
        }

        try {
            if (isEdit) {
                // Update existing group
                await window.app.sendMessage('updateGroup', {
                    id: groupId,
                    name,
                    serverIds: selectedServerIds
                });
                window.app.showToast('Group updated successfully', 'success');
                window.app.navigateTo('group-settings', { groupId });
            } else {
                // Create new group
                const result = await window.app.sendMessage('createGroup', {
                    name,
                    serverIds: selectedServerIds
                });
                window.app.showToast('Group created successfully', 'success');
                window.app.navigateTo('group-settings', { groupId: result.id });
            }
        } catch (error) {
            window.app.showToast(`Failed to ${isEdit ? 'update' : 'create'} group: ${error.message}`, 'error');
        }
    });
}
