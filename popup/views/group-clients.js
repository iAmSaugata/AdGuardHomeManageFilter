// Group Home Clients View
// Shows merged home clients for a group (accessed from Home Clients card)

import { escapeHtml } from '../utils.js';
import { dedupClients } from '../utils.js';

export async function renderGroupClients(container, data = {}) {
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

    // Fetch merged clients from server caches
    let mergedClients = [];
    let filteringEnabledCount = 0;
    let parentalEnabledCount = 0;

    if (group.serverIds && group.serverIds.length > 0) {
        try {
            const allClients = [];
            for (const serverId of group.serverIds) {
                const cache = await window.app.sendMessage('getCache', { serverId });
                if (cache && cache.clients) {
                    allClients.push(...cache.clients);
                }
            }

            // Deduplicate
            mergedClients = dedupClients(allClients);

            // Calculate stats
            filteringEnabledCount = mergedClients.filter(c => c.filtering_enabled).length;
            parentalEnabledCount = mergedClients.filter(c => c.parental_enabled).length;
        } catch (error) {
            console.error('Error fetching merged clients:', error);
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
                <h1 class="view-title">HOME CLIENTS</h1>
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
                                <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: 4px; padding: 4px 8px; display: flex; align-items: center; gap: 5px;">
                                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="var(--color-text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                                    </svg>
                                    <span style="font-size: 10px; color: var(--color-text-primary); font-weight: 500;">${escapeHtml(server.name)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Client Metrics -->
                    <div>
                        <div style="font-size: 8px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; font-weight: 600;">CLIENT METRICS</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #9c27b0; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #9c27b0; line-height: 1;">${mergedClients.length}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Total Clients</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #42d392; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #42d392; line-height: 1;">${filteringEnabledCount}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Filtering ON</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #ff9800; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #ff9800; line-height: 1;">${parentalEnabledCount}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Parental ON</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Merged Clients Preview -->
                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px; padding: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">MERGED CLIENTS PREVIEW</span>
                        <span style="font-size: 10px; color: var(--color-text-secondary); font-weight: 500;">${mergedClients.length} total</span>
                    </div>
                    
                    <div id="clients-container" style="max-height: 239px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                        ${mergedClients.length === 0 ? `
                            <div style="text-align: center; padding: 30px; color: var(--color-text-secondary);">
                                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 10px; opacity: 0.3;">
                                    <path d="M1.8 9.2L12 1.8L22.2 9.2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                    <path d="M6.5 13.5a7 7 0 0 1 11 0"/>
                                    <path d="M8.8 15.8a4.5 4.5 0 0 1 6.4 0"/>
                                    <circle cx="12" cy="18.2" r="1.3" fill="currentColor" stroke="none"/>
                                </svg>
                                <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">No Clients Found</div>
                                <div style="font-size: 10px; opacity: 0.7;">Add clients to your servers to see them here</div>
                            </div>
                        ` : mergedClients.map(client => {
        const ids = Array.isArray(client.ids) ? client.ids : [];
        const tags = Array.isArray(client.tags) ? client.tags : [];

        return `
                                <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px; transition: all 0.2s ease;">
                                    <div style="display: flex; align-items: start; gap: 8px;">
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#9c27b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                                    <circle cx="12" cy="7" r="4"/>
                                                </svg>
                                                <span style="font-size: 11px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(client.name)}</span>
                                            </div>
                                            
                                            ${ids.length > 0 ? `
                                                <div style="font-size: 9px; color: var(--color-text-secondary); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                    ${ids.map(id => escapeHtml(id)).join(', ')}
                                                </div>
                                            ` : ''}
                                            
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                                ${client.filtering_enabled ? '<span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: rgba(66, 211, 146, 0.1); color: #42d392; font-weight: 600;">FILTERING</span>' : ''}
                                                ${client.parental_enabled ? '<span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: rgba(255, 152, 0, 0.1); color: #ff9800; font-weight: 600;">PARENTAL</span>' : ''}
                                                ${client.safebrowsing_enabled ? '<span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: rgba(100, 181, 246, 0.1); color: #64b5f6; font-weight: 600;">SAFE BROWSING</span>' : ''}
                                                ${client.safesearch?.enabled ? '<span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: rgba(156, 39, 176, 0.1); color: #9c27b0; font-weight: 600;">SAFE SEARCH</span>' : ''}
                                                ${tags.length > 0 ? tags.map(tag => `<span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: rgba(136, 136, 136, 0.1); color: #888; font-weight: 600;">${escapeHtml(tag)}</span>`).join('') : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>
            </div>
        </div>

        <style>
            #clients-container::-webkit-scrollbar {
                width: 6px;
            }

            #clients-container::-webkit-scrollbar-track {
                background: var(--color-bg-primary);
                border-radius: 3px;
            }

            #clients-container::-webkit-scrollbar-thumb {
                background: var(--color-border);
                border-radius: 3px;
            }

            #clients-container::-webkit-scrollbar-thumb:hover {
                background: var(--color-text-tertiary);
            }
        </style>
    `;

    // Back button handler
    const backBtn = container.querySelector('#back-btn');
    backBtn?.addEventListener('click', () => {
        window.app.navigateTo('group-settings', { groupId });
    });
}
