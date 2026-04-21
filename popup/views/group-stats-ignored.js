// Group Stats Ignored View
// Shows merged ignored domains for statistics in a group (read-only)

import { escapeHtml } from '../utils.js';
import { deduplicateIgnoredDomains } from '../utils.js';

export async function renderGroupStatsIgnored(container, data = {}) {
    const { groupId } = data;

    if (!groupId) {
        window.app.showToast('No group specified', 'error');
        window.app.navigateTo('settings');
        return;
    }

    // Fetch group
    const group = await window.app.sendMessage('getGroup', { id: groupId });

    if (!group) {
        window.app.showToast('Group not found', 'error');
        window.app.navigateTo('settings');
        return;
    }

    // Fetch merged ignored domains from all servers
    let mergedDomains = [];

    if (group.serverIds && group.serverIds.length > 0) {
        try {
            const allDomains = [];
            for (const serverId of group.serverIds) {
                const server = await window.app.sendMessage('getServer', { id: serverId });
                if (server) {
                    try {
                        const config = await window.app.sendMessage('getStatsConfig', { server });
                        if (config && config.ignored) {
                            allDomains.push(...config.ignored);
                        }
                    } catch (e) {
                        console.debug(`Failed to fetch stats config from server ${serverId}:`, e);
                    }
                }
            }

            // Deduplicate
            mergedDomains = deduplicateIgnoredDomains(allDomains);
        } catch (error) {
            console.error('Error fetching merged ignored domains:', error);
        }
    }

    // Get server names
    const servers = await window.app.sendMessage('getServers');
    const groupServers = servers.filter(s => group.serverIds && group.serverIds.includes(s.id));

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-icon-btn" id="back-btn" title="Back to Group Settings">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <h1 class="view-title">STATS IGNORED</h1>
                <div class="header-action-area"></div>
            </div>

            <div class="view-body">
                <!-- Ultra Compact Group Info Card -->
                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px; padding: 12px; margin-bottom: 14px;">
                    <!-- Card Header: GROUP : GROUPNAME -->
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <span style="font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">GROUP :</span>
                        <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.2); padding: 2px 8px; border-radius: 8px;">
                            <span style="font-size: 10px; font-weight: 600; color: #42d392;">${escapeHtml(group.name)}</span>
                        </div>
                    </div>

                    <!-- Infrastructure -->
                    <div style="margin-bottom: 8px;">
                        <div style="font-size: 8px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; font-weight: 600;">INFRASTRUCTURE</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                            ${groupServers.map(server => `
                                <div style="background: var(--color-bg-tertiary); border: 1px solid var(--color-border); padding: 3px 8px; border-radius: 6px; font-size: 9px; color: var(--color-text-secondary);">
                                    ${escapeHtml(server.name)}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Statistics -->
                    <div>
                        <div style="font-size: 8px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; font-weight: 600;">STATISTICS</div>
                        <div style="display: flex; gap: 8px;">
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #ff9800; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #ff9800; line-height: 1;">${mergedDomains.length}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">DOMAINS</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Merged Domains Preview -->
                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px; padding: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">IGNORED DOMAINS</span>
                        <span style="font-size: 10px; color: var(--color-text-secondary); font-weight: 500;">${mergedDomains.length} total</span>
                    </div>
                    
                    <div id="domains-container" style="max-height: 239px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                        ${mergedDomains.length === 0 ? `
                            <div style="text-align: center; padding: 30px; color: var(--color-text-secondary);">
                                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 10px; opacity: 0.3;">
                                    <line x1="18" y1="20" x2="18" y2="10" stroke-linecap="round" stroke-linejoin="round"/>
                                    <line x1="12" y1="20" x2="12" y2="4" stroke-linecap="round" stroke-linejoin="round"/>
                                    <line x1="6" y1="20" x2="6" y2="14" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">No Ignored Domains</div>
                                <div style="font-size: 10px; opacity: 0.7;">Configure ignored domains in statistics settings</div>
                            </div>
                        ` : mergedDomains.map(domain => `
                            <div style="background: rgba(255, 255, 255, 0.02); border-radius: 6px; padding: 12px; border-left: 3px solid #ff9800; transition: all 0.2s ease;">
                                <div style="font-size: 12px; font-weight: 600; color: var(--color-text-primary); font-family: 'Courier New', monospace;">${escapeHtml(domain)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <style>
            .view-container {
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            .view-header {
                display: grid;
                grid-template-columns: 40px 1fr 40px;
                align-items: center;
                padding: 14px 16px;
                background: var(--color-bg-secondary);
                border-bottom: 1px solid var(--color-border);
                gap: 12px;
            }

            .header-icon-btn {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: var(--color-bg-tertiary);
                border: 1px solid var(--color-border);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }

            .header-icon-btn:hover {
                background: var(--color-bg-hover);
                transform: translateY(-1px);
            }

            .view-title {
                font-size: 0.95rem;
                font-weight: 700;
                color: var(--color-text-primary);
                text-align: center;
                margin: 0;
                letter-spacing: 0.5px;
            }

            .view-body {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }

            #domains-container::-webkit-scrollbar {
                width: 8px;
            }

            #domains-container::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
            }

            #domains-container::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, #4caf50, #45a049);
                border-radius: 4px;
                transition: background 0.3s;
            }

            #domains-container::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, #45a049, #3d8b40);
            }
        </style>
    `;

    // Back button handler
    const backBtn = container.querySelector('#back-btn');
    backBtn?.addEventListener('click', () => {
        window.app.navigateTo('group-settings', { groupId });
    });
}
