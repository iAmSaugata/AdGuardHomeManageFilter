// Group Merged Rules View
// Shows merged custom rules for a group (accessed from Custom Rules card)

import { escapeHtml, classifyRule, getRuleCounts } from '../utils.js';

export async function renderGroupMergedRules(container, data = {}) {
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

    // Fetch merged rules from server caches
    let mergedRules = [];
    let counts = { allow: 0, block: 0, disabled: 0, total: 0 };

    if (group.serverIds && group.serverIds.length > 0) {
        try {
            const allRules = [];
            for (const serverId of group.serverIds) {
                const cache = await window.app.sendMessage('getCache', { serverId });
                if (cache && cache.rules) {
                    allRules.push(...cache.rules);
                }
            }

            // Import utilities for normalization and deduplication
            const { normalizeRule, dedupRules } = await import('../shared/utilities.js');

            // Normalize and deduplicate
            const normalized = allRules.map(normalizeRule).filter(r => r);
            mergedRules = dedupRules(normalized);
            counts = getRuleCounts(mergedRules);
        } catch (error) {
            console.error('Error fetching merged rules:', error);
        }
    }

    // Get server names
    const servers = await window.app.sendMessage('getServers');
    const groupServers = servers.filter(s => group.serverIds && group.serverIds.includes(s.id));
    const serverNames = groupServers.map(s => s.name).join(', ') || 'No servers';

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-icon-btn" id="back-btn" title="Back to Group Settings">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <h1 class="view-title">CUSTOM RULES</h1>
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

                    <!-- Traffic Metrics -->
                    <div>
                        <div style="font-size: 8px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; font-weight: 600;">TRAFFIC METRICS</div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #42d392; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #42d392; line-height: 1;">${counts.allow}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Allowed</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #ff4d4d; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #ff4d4d; line-height: 1;">${counts.block}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Blocked</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #ffc107; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #ffc107; line-height: 1;">${counts.disabled}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Inactive</div>
                            </div>
                            
                            <div style="background: var(--color-bg-primary); border: 1px solid var(--color-border); border-left: 2px solid #2196f3; border-radius: 4px; padding: 6px;">
                                <div style="font-size: 16px; font-weight: 700; color: #2196f3; line-height: 1;">${counts.total}</div>
                                <div style="font-size: 8px; color: var(--color-text-secondary); font-weight: 500; margin-top: 2px;">Total Rules</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Merged Rules Preview -->
                <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 9px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">MERGED RULES PREVIEW</div>
                    <div style="font-size: 10px; color: var(--color-text-tertiary);">${mergedRules.length} total</div>
                </div>

                ${mergedRules.length > 0 ? `
                    <div id="rules-preview" style="max-height: 420px; overflow-y: auto; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px; padding: 8px;">
                        ${mergedRules.map((rule, idx) => {
        const classification = classifyRule(rule);
        let bulletColor = '#ffc107'; // amber for inactive
        let textColor = '#ffc107';

        if (classification === 'allow') {
            bulletColor = '#42d392'; // green
            textColor = '#42d392';
        } else if (classification === 'block') {
            bulletColor = '#ff4d4d'; // red
            textColor = '#ff4d4d';
        }

        return `
                                <div style="padding: 6px 8px; margin-bottom: 2px; background: var(--color-bg-primary); border-radius: 4px; display: flex; align-items: flex-start; gap: 8px;">
                                    <span style="color: ${bulletColor}; font-size: 14px; line-height: 1; margin-top: 1px;">●</span>
                                    <span style="font-family: 'Courier New', monospace; font-size: 10px; color: ${textColor}; word-break: break-all; flex: 1;">${escapeHtml(rule)}</span>
                                </div>
                            `;
    }).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 50px 20px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px;">
                        <div style="font-size: 40px; margin-bottom: 12px; opacity: 0.3;">📝</div>
                        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 6px;">No merged rules yet</div>
                        <div style="font-size: 11px; color: var(--color-text-tertiary);">Add servers to this group to see merged rules</div>
                    </div>
                `}

                <style>
                    #rules-preview::-webkit-scrollbar {
                        width: 6px;
                    }
                    
                    #rules-preview::-webkit-scrollbar-track {
                        background: var(--color-bg-primary);
                        border-radius: 3px;
                    }
                    
                    #rules-preview::-webkit-scrollbar-thumb {
                        background: var(--color-border);
                        border-radius: 3px;
                    }
                    
                    #rules-preview::-webkit-scrollbar-thumb:hover {
                        background: var(--color-text-tertiary);
                    }
                </style>
            </div>
        </div>
    `;

    // Event Listeners
    const backBtn = container.querySelector('#back-btn');

    backBtn?.addEventListener('click', () => {
        window.app.navigateTo('group-settings', { groupId });
    });
}
