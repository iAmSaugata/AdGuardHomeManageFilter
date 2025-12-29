// Settings View
// Shows group management and settings options

import { escapeHtml, showConfirmDialog } from '../utils.js';

export async function renderSettings(container) {
    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="btn btn-ghost btn-sm" id="back-btn">
                    ← Back
                </button>
                <h1 class="view-title">Settings</h1>
                <div class="flex-1"></div>
            </div>

            <div class="view-body">
                <div class="settings-section">
                    <h2 class="settings-section-title">Groups</h2>
                    <p class="settings-section-description">
                        Groups allow you to merge rules from multiple servers. 
                        Rules are automatically deduplicated and normalized.
                    </p>
                    
                    <button class="btn btn-primary btn-block" id="create-group-btn">
                        + Create Group
                    </button>

                    <div id="groups-list" class="mt-4">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('back-btn').addEventListener('click', () => {
        window.app.navigateTo('server-list');
    });

    document.getElementById('create-group-btn').addEventListener('click', () => {
        window.app.navigateTo('group-form', { mode: 'add' });
    });

    // Load and display groups
    loadGroups();
}

async function loadGroups() {
    try {
        const groups = await window.app.sendMessage('getGroups');
        const groupsList = document.getElementById('groups-list');

        if (!groups || groups.length === 0) {
            groupsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">No groups created yet</div>
                </div>
            `;
            return;
        }

        const groupItems = groups.map(group => `
            <div class="list-item group-item" data-group-id="${group.id}">
                <div class="list-item-content">
                    <div class="list-item-title">${escapeHtml(group.name)}</div>
                    <div class="text-xs text-tertiary">
                        ${group.serverIds.length} servers • ${group.rules.length} rules
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-sm btn-ghost edit-group-btn" data-group-id="${group.id}" title="Edit group">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-danger delete-group-btn" data-group-id="${group.id}" title="Delete group">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');

        groupsList.innerHTML = groupItems;

        // Attach event listeners
        document.querySelectorAll('.edit-group-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = btn.dataset.groupId;
                window.app.navigateTo('group-form', { mode: 'edit', groupId });
            });
        });

        document.querySelectorAll('.delete-group-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const groupId = btn.dataset.groupId;
                await handleDeleteGroup(groupId);
            });
        });

    } catch (error) {
        console.error('Failed to load groups:', error);
        document.getElementById('groups-list').innerHTML = `
            <div class="text-danger text-sm">Failed to load groups</div>
        `;
    }
}

async function handleDeleteGroup(groupId) {
    const group = await window.app.sendMessage('getGroup', { id: groupId });

    if (!group) {
        window.app.showToast('Group not found', 'error');
        return;
    }

    const confirmed = await showConfirmDialog(
        'Delete Group',
        `Are you sure you want to delete "${group.name}"?`,
        'This action cannot be undone.'
    );

    if (!confirmed) {
        return;
    }

    try {
        await window.app.sendMessage('deleteGroup', { id: groupId });
        window.app.showToast('Group deleted successfully', 'success');
        loadGroups(); // Reload the list
    } catch (error) {
        window.app.showToast('Failed to delete group: ' + error.message, 'error');
    }
}

// escapeHtml removed - now imported from utils.js
