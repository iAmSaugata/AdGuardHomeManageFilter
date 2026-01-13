// Group Server Selection View
// Modern, professional server selection page for creating/editing groups

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
    const selectedServerIds = new Set(group?.serverIds || []);

    // Fetch server info for versions
    const serverInfoMap = {};
    for (const server of availableServers) {
        try {
            const info = await window.app.sendMessage('getServerInfo', { serverId: server.id });
            serverInfoMap[server.id] = info;
        } catch (e) {
            serverInfoMap[server.id] = null;
        }
    }

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
                <style>
                    .manage-servers-container {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                        min-height: 100%;
                    }

                    .spacer {
                        flex: 1;
                        min-height: 10px;
                    }

                    /* Group Name Section - Inline */
                    .group-name-section {
                        background: var(--color-bg-secondary);
                        border: 1px solid var(--color-border);
                        border-radius: 6px;
                        padding: 8px 10px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .group-name-label {
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: var(--color-text-secondary);
                        white-space: nowrap;
                        flex-shrink: 0;
                    }

                    .group-name-input {
                        flex: 1;
                        padding: 8px 10px;
                        background: var(--color-bg-primary);
                        border: 1px solid var(--color-border);
                        border-radius: 6px;
                        color: var(--color-text-primary);
                        font-size: 0.85rem;
                        transition: all 0.2s;
                    }

                    .group-name-input:focus {
                        outline: none;
                        border-color: var(--color-success);
                        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
                    }

                    /* Servers Section */
                    .servers-section {
                        background: var(--color-bg-secondary);
                        border: 1px solid var(--color-border);
                        border-radius: 6px;
                        padding: 8px;
                    }

                    .servers-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                        padding: 0 2px;
                    }

                    .servers-title {
                        font-size: 0.85rem;
                        font-weight: 600;
                        color: var(--color-text-secondary);
                    }

                    .servers-count {
                        font-size: 0.75rem;
                        padding: 4px 10px;
                        background: rgba(76, 175, 80, 0.15);
                        color: var(--color-success);
                        border-radius: 12px;
                        font-weight: 600;
                    }

                    .servers-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px;
                        max-height: 200px;
                        overflow-y: auto;
                        overflow-x: hidden;
                        padding: 2px;
                        scroll-behavior: smooth;
                    }

                    /* Custom Scrollbar - Vertical */
                    .servers-grid::-webkit-scrollbar {
                        width: 6px;
                    }

                    .servers-grid::-webkit-scrollbar-track {
                        background: var(--color-bg-primary);
                        border-radius: 3px;
                    }

                    .servers-grid::-webkit-scrollbar-thumb {
                        background: var(--color-border);
                        border-radius: 3px;
                        transition: background 0.2s;
                    }

                    .servers-grid::-webkit-scrollbar-thumb:hover {
                        background: var(--color-success);
                    }

                    /* Server Card - Horizontal Layout */
                    .server-card {
                        background: rgba(255, 255, 255, 0.03);
                        border: 1.5px solid rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        padding: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        position: relative;
                    }

                    .server-card:hover {
                        border-color: var(--color-success);
                        background: rgba(76, 175, 80, 0.08);
                        transform: translateY(-1px);
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                    }

                    .server-card.selected {
                        border-color: var(--color-success);
                        background: rgba(76, 175, 80, 0.12);
                        box-shadow: 0 0 0 1px var(--color-success);
                    }

                    .server-checkbox {
                        position: absolute;
                        top: 5px;
                        right: 5px;
                        width: 14px;
                        height: 14px;
                        cursor: pointer;
                        accent-color: var(--color-success);
                    }

                    .server-icon {
                        width: 32px;
                        height: 32px;
                        background: rgba(76, 175, 80, 0.15);
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .server-icon svg {
                        width: 18px;
                        height: 18px;
                        color: var(--color-success);
                        opacity: 0.9;
                    }

                    .server-info {
                        flex: 1;
                        min-width: 0;
                        padding-right: 14px;
                    }

                    .server-name {
                        font-size: 0.8rem;
                        font-weight: 600;
                        color: var(--color-text-primary);
                        margin-bottom: 2px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .server-version {
                        font-size: 0.68rem;
                        color: var(--color-text-secondary);
                        opacity: 0.8;
                    }

                    /* Info Banner */
                    .info-banner {
                        background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%);
                        border: 1px solid rgba(76, 175, 80, 0.3);
                        border-radius: 6px;
                        padding: 8px;
                        display: flex;
                        gap: 2px;
                        margin-top: 0px;
                    }

                    .info-banner-icon {
                        flex-shrink: 0;
                        width: 16px;
                        height: 16px;
                        color: var(--color-success);
                    }

                    .info-banner-content {
                        flex: 1;
                    }

                    .info-banner-title {
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: var(--color-success);
                        margin-bottom: 3px;
                    }

                    .info-banner-text {
                        font-size: 0.7rem;
                        line-height: 1.4;
                        color: var(--color-text-secondary);
                    }

                    .info-banner-text strong {
                        color: var(--color-text-primary);
                        font-weight: 600;
                    }

                    .action-buttons {
                        display: flex;
                        gap: 10px;
                        margin-top: 8px;
                    }

                    .btn-close {
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                        border: none;
                        border-radius: 8px;
                        color: white;
                        font-size: 0.9rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .btn-close:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 3px 10px rgba(220, 53, 69, 0.4);
                    }

                    .btn-save {
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                        border: none;
                        border-radius: 8px;
                        color: white;
                        font-size: 0.9rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .btn-save:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 3px 10px rgba(76, 175, 80, 0.4);
                    }

                    .btn-save:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                        transform: none;
                    }

                    .empty-state {
                        text-align: center;
                        padding: 40px 20px;
                        color: var(--color-text-secondary);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 12px;
                    }

                    .empty-state-icon {
                        width: 48px;
                        height: 48px;
                        opacity: 0.4;
                        color: var(--color-text-secondary);
                    }

                    .empty-state-title {
                        font-size: 0.9rem;
                        font-weight: 600;
                        color: var(--color-text-primary);
                    }

                    .empty-state-text {
                        font-size: 0.8rem;
                        line-height: 1.5;
                        color: var(--color-text-secondary);
                        max-width: 280px;
                    }
                </style>

                <div class="manage-servers-container">
                    <!-- Group Name - Inline -->
                    <div class="group-name-section">
                        <label class="group-name-label">GROUP NAME</label>
                        <input
                            type="text"
                            id="group-name"
                            class="group-name-input"
                            placeholder="e.g., Production Servers, Home Network"
                            value="${group ? escapeHtml(group.name) : ''}"
                            required
                        />
                    </div>

                    <!-- Server Selection -->
                    <div class="servers-section">
                        <div class="servers-header">
                            <span class="servers-title">SELECT SERVERS</span>
                            <span class="servers-count">${availableServers.length} Available</span>
                        </div>
                        
                        ${availableServers.length > 0 ? `
                            <div class="servers-grid">
                                ${availableServers.map(server => {
        const serverInfo = serverInfoMap[server.id];
        const version = serverInfo?.version || 'v...';
        return `
                                    <div class="server-card ${selectedServerIds.has(server.id) ? 'selected' : ''}" data-server-id="${server.id}">
                                        <input
                                            type="checkbox"
                                            class="server-checkbox"
                                            value="${server.id}"
                                            ${selectedServerIds.has(server.id) ? 'checked' : ''}
                                        />
                                        <div class="server-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <rect x="2" y="4" width="13" height="10" rx="2"></rect>
                                                <line x1="8.5" y1="14" x2="8.5" y2="17"></line>
                                                <line x1="4.5" y1="17" x2="12.5" y2="17"></line>
                                                <rect x="17" y="4" width="5" height="13" rx="1"></rect>
                                                <circle cx="19.5" cy="7" r="1" fill="currentColor" stroke="none"></circle>
                                                <line x1="18.5" y1="12" x2="20.5" y2="12"></line>
                                                <line x1="18.5" y1="14" x2="20.5" y2="14"></line>
                                            </svg>
                                        </div>
                                        <div class="server-info">
                                            <div class="server-name">${escapeHtml(server.name)}</div>
                                            <div class="server-version">${escapeHtml(version)}</div>
                                        </div>
                                    </div>
                                `}).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 8v4M12 16h.01"/>
                                </svg>
                                <div class="empty-state-title">No Servers Available</div>
                                <div class="empty-state-text">All servers are already assigned to other groups. Please create servers first or remove them from existing groups.</div>
                            </div>
                        `}
                    </div>

                    <!-- Spacer to push content to bottom -->
                    <div class="spacer"></div>

                    <!-- Info Banner -->
                    <div class="info-banner">
                        <svg class="info-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 16v-4M12 8h.01"/>
                        </svg>
                        <div class="info-banner-content">
                            <div class="info-banner-title">About Group Sync</div>
                            <div class="info-banner-text">
                                <strong>Default:</strong> Sync is disabled when creating a new group. Rules will only apply to the server you select.<br>
                                <strong>Enable Sync:</strong> After creation, go to Sync Settings to enable Custom Rules sync across all group members.
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="action-buttons">
                        <button class="btn-close" id="cancel-btn">Close</button>
                        <button class="btn-save" id="save-btn">${isEdit ? 'Save Changes' : 'Create Group'}</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event Listeners
    const backBtn = container.querySelector('#back-btn');
    const cancelBtn = container.querySelector('#cancel-btn');
    const saveBtn = container.querySelector('#save-btn');
    const groupNameInput = container.querySelector('#group-name');
    const serverCards = container.querySelectorAll('.server-card');
    const serverCheckboxes = container.querySelectorAll('.server-checkbox');

    // Server card click handling
    serverCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't toggle if clicking directly on checkbox
            if (e.target.classList.contains('server-checkbox')) return;

            const checkbox = card.querySelector('.server-checkbox');
            checkbox.checked = !checkbox.checked;
            card.classList.toggle('selected', checkbox.checked);
        });
    });

    // Checkbox change handling
    serverCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const card = e.target.closest('.server-card');
            card.classList.toggle('selected', e.target.checked);
        });
    });

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
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

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
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Group';
        }
    });
}
