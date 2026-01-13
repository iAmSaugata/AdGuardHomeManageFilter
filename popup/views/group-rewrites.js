// Group DNS Rewrites View
// Shows merged DNS rewrites for a group (accessed from DNS Rewrites card)

import { escapeHtml } from '../utils.js';
import { dedupRewrites } from '../utils.js';

export async function renderGroupRewrites(container, data = {}) {
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

    // Fetch merged rewrites from server caches
    let mergedRewrites = [];

    if (group.serverIds && group.serverIds.length > 0) {
        try {
            const allRewrites = [];
            for (const serverId of group.serverIds) {
                const cache = await window.app.sendMessage('getCache', { serverId });
                if (cache && cache.rewrites) {
                    allRewrites.push(...cache.rewrites);
                }
            }

            // Deduplicate
            mergedRewrites = dedupRewrites(allRewrites);
        } catch (error) {
            console.error('Error fetching merged rewrites:', error);
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
                <h1 class="view-title">DNS REWRITES</h1>
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

                    <!-- Rewrite Metrics -->
                    <div>
                        <div style="font-size: 8px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; font-weight: 600;">REWRITE METRICS</div>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 5px;">
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #64b5f6; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #64b5f6; line-height: 1;">${mergedRewrites.length}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Total Rewrites</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Merged Rewrites Preview -->
                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px; padding: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">MERGED REWRITES PREVIEW</span>
                        <span style="font-size: 10px; color: var(--color-text-secondary); font-weight: 500;">${mergedRewrites.length} total</span>
                    </div>
                    
                    <div id="rewrites-container" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                        ${mergedRewrites.length === 0 ? `
                            <div style="text-align: center; padding: 30px; color: var(--color-text-secondary);">
                                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 10px; opacity: 0.3;">
                                    <path d="M5 12C5 8.7 7.7 6 11 6H16" stroke-linecap="round"/>
                                    <path d="M14 4L16 6L14 8" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M19 12C19 15.3 16.3 18 13 18H8" stroke-linecap="round"/>
                                    <path d="M10 20L8 18L10 16" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">No Rewrites Found</div>
                                <div style="font-size: 10px; opacity: 0.7;">Add DNS rewrites to your servers to see them here</div>
                            </div>
                        ` : mergedRewrites.map(rewrite => `
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px; transition: all 0.2s ease;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(rewrite.domain)}</div>
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#64b5f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M5 12h14"/>
                                                <path d="M12 5l7 7-7 7"/>
                                            </svg>
                                            <span style="font-size: 10px; color: #64b5f6; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(rewrite.answer)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <style>
            #rewrites-container::-webkit-scrollbar {
                width: 6px;
            }

            #rewrites-container::-webkit-scrollbar-track {
                background: var(--color-bg-primary);
                border-radius: 3px;
            }

            #rewrites-container::-webkit-scrollbar-thumb {
                background: var(--color-border);
                border-radius: 3px;
            }

            #rewrites-container::-webkit-scrollbar-thumb:hover {
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
