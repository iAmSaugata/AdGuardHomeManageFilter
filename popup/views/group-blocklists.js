// Group DNS Blocklists View
// Shows merged DNS blocklists for a group (accessed from DNS Blocklists card)

import { escapeHtml } from '../utils.js';
import { dedupBlocklists } from '../utils.js';

export async function renderGroupBlocklists(container, data = {}) {
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

    // Fetch merged blocklists from server caches
    let mergedBlocklists = [];
    let enabledCount = 0;
    let disabledCount = 0;
    let totalRules = 0;

    if (group.serverIds && group.serverIds.length > 0) {
        try {
            const allBlocklists = [];
            for (const serverId of group.serverIds) {
                const cache = await window.app.sendMessage('getCache', { serverId });
                if (cache && cache.blocklists) {
                    allBlocklists.push(...cache.blocklists);
                }
            }

            // Deduplicate
            mergedBlocklists = dedupBlocklists(allBlocklists);

            // Calculate stats
            enabledCount = mergedBlocklists.filter(f => f.enabled).length;
            disabledCount = mergedBlocklists.length - enabledCount;
            totalRules = mergedBlocklists.reduce((sum, f) => sum + (f.rules_count || 0), 0);
        } catch (error) {
            console.error('Error fetching merged blocklists:', error);
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
                <h1 class="view-title">DNS BLOCKLISTS</h1>
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

                    <!-- Filter Metrics -->
                    <div>
                        <div style="font-size: 8px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; font-weight: 600;">FILTER METRICS</div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #42d392; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #42d392; line-height: 1;">${enabledCount}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Enabled</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #ff6b6b; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #ff6b6b; line-height: 1;">${disabledCount}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Disabled</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #64b5f6; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #64b5f6; line-height: 1;">${totalRules.toLocaleString()}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Total Rules</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #9c27b0; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #9c27b0; line-height: 1;">${mergedBlocklists.length}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Total Lists</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Merged Blocklists Preview -->
                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px; padding: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">MERGED BLOCKLISTS PREVIEW</span>
                        <span style="font-size: 10px; color: var(--color-text-secondary); font-weight: 500;">${mergedBlocklists.length} total</span>
                    </div>
                    
                    <div id="blocklists-container" style="max-height: 239px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                        ${mergedBlocklists.length === 0 ? `
                            <div style="text-align: center; padding: 30px; color: var(--color-text-secondary);">
                                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 10px; opacity: 0.3;">
                                    <path d="M21 7C21 8.65685 16.9706 10 12 10C7.02944 10 3 8.65685 3 7C3 5.34315 7.02944 4 12 4C16.9706 4 21 5.34315 21 7Z" />
                                    <path d="M3 7V12C3 13.6569 7.02944 15 12 15C13.8 15 15.5 14.8 17 14.5" />
                                    <path d="M3 12V17C3 18.6569 7.02944 20 12 20C12.5 20 13 19.9 13.5 19.9" />
                                    <path d="M21 7V12" />
                                    <circle cx="18.5" cy="18.5" r="4.5" />
                                    <path d="M15.5 15.5L21.5 21.5" />
                                </svg>
                                <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">No Blocklists Found</div>
                                <div style="font-size: 10px; opacity: 0.7;">Add filter lists to your servers to see them here</div>
                            </div>
                        ` : mergedBlocklists.map(filter => {
        const statusColor = filter.enabled ? '#42d392' : '#888';
        const statusText = filter.enabled ? 'ENABLED' : 'DISABLED';

        return `
                                <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px; transition: all 0.2s ease;">
                                    <div style="display: flex; align-items: start; gap: 8px;">
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                                <div style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></div>
                                                <span style="font-size: 11px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(filter.name || 'Unnamed Filter')}</span>
                                            </div>
                                            <div style="font-size: 9px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px;">${escapeHtml(filter.url)}</div>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: ${filter.enabled ? 'rgba(66, 211, 146, 0.1)' : 'rgba(136, 136, 136, 0.1)'}; color: ${statusColor}; font-weight: 600;">${statusText}</span>
                                                <span style="font-size: 8px; color: var(--color-text-tertiary);">${(filter.rules_count || 0).toLocaleString()} rules</span>
                                                ${filter.last_updated ? `<span style="font-size: 8px; color: var(--color-text-tertiary);">Updated: ${new Date(filter.last_updated).toLocaleDateString()}</span>` : ''}
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
            #blocklists-container::-webkit-scrollbar {
                width: 6px;
            }

            #blocklists-container::-webkit-scrollbar-track {
                background: var(--color-bg-primary);
                border-radius: 3px;
            }

            #blocklists-container::-webkit-scrollbar-thumb {
                background: var(--color-border);
                border-radius: 3px;
            }

            #blocklists-container::-webkit-scrollbar-thumb:hover {
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
