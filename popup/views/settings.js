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

            <div class="view-body" style="padding-bottom: 120px;">
                <!-- GROUPS - Priority Section (Scrollable) -->
                <div class="settings-section">
                    <h2 class="settings-section-title">Groups</h2>
                    <p class="settings-section-description">
                        Merge rules from multiple servers with auto-deduplication.
                    </p>
                    
                    <button class="btn btn-primary btn-block" id="create-group-btn">
                        + Create Group
                    </button>

                    <div id="groups-list" class="mt-4" style="max-height: 240px; overflow-y: auto; margin-bottom: 16px;">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text"></div>
                    </div>
                </div>
            </div>
            
            <!-- DEVELOPER & CACHE TOOLS - Fixed at Bottom -->
            <div style="position: fixed; bottom: 0; left: 0; right: 0; background: var(--color-bg-primary); border-top: 1px solid var(--color-border); padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; z-index: 100;">
                
                <!-- Debug Mode Card -->
                <div style="background: linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.02) 100%); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 8px; padding: 12px; position: relative; overflow: hidden;">
                    <!-- Icon Badge -->
                    <div style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; background: rgba(76, 175, 80, 0.15); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px;">
                        🔧
                    </div>
                    
                    <div style="font-size: 12px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px;">
                        Developer Tools
                    </div>
                    
                    <label class="form-label toggle-label" style="margin: 0 0 8px 0;">
                        <input
                            type="checkbox"
                            id="debug-mode-toggle"
                            class="toggle-input"
                        />
                        <span class="toggle-slider"></span>
                        <span class="toggle-text" style="font-size: 11px;">Debug Mode</span>
                    </label>
                    
                    <div style="font-size: 9px; line-height: 1.4; color: var(--color-text-tertiary);">
                        Show detailed console logs for troubleshooting
                    </div>
                </div>
                
                <!-- Cache Management Card -->
                <div style="background: linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.02) 100%); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 8px; padding: 12px; position: relative; overflow: hidden;">
                    <!-- Icon Badge -->
                    <div style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; background: rgba(76, 175, 80, 0.15); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px;">
                        🗑️
                    </div>
                    
                    <div style="font-size: 12px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px;">
                        Clear Cache
                    </div>
                    
                    <button class="btn btn-secondary btn-sm" id="clear-cache-btn" style="font-size: 10px; padding: 6px 12px; width: 100%; margin-bottom: 8px;">
                        Clear Cache
                    </button>
                    
                    <div style="font-size: 9px; line-height: 1.4; color: var(--color-text-tertiary);">
                        Force refresh all server data and statistics
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            /* Custom scrollbar for groups list - matching rule listing theme */
            #groups-list::-webkit-scrollbar {
                width: 6px;
            }
            
            #groups-list::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
            }
            
            #groups-list::-webkit-scrollbar-thumb {
                background: rgba(76, 175, 80, 0.5);
                border-radius: 3px;
            }
            
            #groups-list::-webkit-scrollbar-thumb:hover {
                background: rgba(76, 175, 80, 0.7);
            }
        </style>
    `;

    // Event listeners
    document.getElementById('back-btn').addEventListener('click', () => {
        window.app.navigateTo('server-list');
    });

    document.getElementById('create-group-btn').addEventListener('click', () => {
        window.app.navigateTo('group-form', { mode: 'add' });
    });

    // Clear Cache button
    document.getElementById('clear-cache-btn').addEventListener('click', async () => {
        const btn = document.getElementById('clear-cache-btn');
        btn.disabled = true;
        btn.textContent = '🔄 Clearing...';

        try {
            await chrome.storage.local.remove('ui_snapshot');
            window.app.showToast('Cache cleared! Reloading...', 'success');
            setTimeout(() => location.reload(), 500);
        } catch (error) {
            console.error('Failed to clear cache:', error);
            window.app.showToast('Failed to clear cache', 'error');
            btn.disabled = false;
            btn.textContent = '🗑️ Clear Cache & Reload';
        }
    });

    // Load and display groups
    loadGroups();

    // Load and initialize debug mode toggle
    loadDebugSetting();
}

async function loadDebugSetting() {
    try {
        const result = await chrome.storage.local.get('debugMode');
        const debugMode = result.debugMode || false;

        const toggle = document.getElementById('debug-mode-toggle');
        if (toggle) {
            toggle.checked = debugMode;

            // Add change listener
            toggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;

                try {
                    // Save to storage
                    await chrome.storage.local.set({ debugMode: enabled });

                    // Notify background to update log level
                    await window.app.sendMessage('setDebugMode', { enabled });

                    window.app.showToast(
                        enabled ? 'Debug mode enabled - Check console for logs' : 'Debug mode disabled - Only errors will be shown',
                        'success'
                    );
                } catch (error) {
                    console.error('Failed to update debug mode:', error);
                    window.app.showToast('Failed to update debug mode', 'error');
                    // Revert toggle
                    toggle.checked = !enabled;
                }
            });
        }
    } catch (error) {
        console.error('Failed to load debug setting:', error);
    }
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
