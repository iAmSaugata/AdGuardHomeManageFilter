// Group Settings View
// Modern dashboard design with vertical pill sync cards and toggle controls

import { escapeHtml, showConfirmDialog } from '../utils.js';

export async function renderGroupSettings(container, data = {}) {
    const { groupId } = data;

    if (!groupId) {
        window.app.showToast('No group specified', 'error');
        window.app.navigateTo('settings');
        return;
    }

    // Fetch group and servers
    const [group, servers] = await Promise.all([
        window.app.sendMessage('getGroup', { id: groupId }),
        window.app.sendMessage('getServers')
    ]);

    if (!group) {
        window.app.showToast('Group not found', 'error');
        window.app.navigateTo('settings');
        return;
    }

    // Get server names for display
    const groupServers = servers.filter(s => group.serverIds && group.serverIds.includes(s.id));
    const serverNames = groupServers.map(s => s.name).join(', ') || 'No servers';

    // Initialize sync settings from group data
    // For backward compatibility: existing groups default to Custom Rules ON, others OFF
    // New groups: all OFF by default
    const isNewGroup = group.syncSettings === undefined;
    const syncSettings = {
        customRules: group.syncSettings?.customRules !== undefined ? group.syncSettings.customRules : isNewGroup ? false : true,
        dnsBlocklists: group.syncSettings?.dnsBlocklists ?? false,
        dnsRewrites: group.syncSettings?.dnsRewrites ?? false,
        homeClients: group.syncSettings?.homeClients ?? false
    };

    console.log('[GroupSettings] Initialized sync settings', {
        groupId: group.id,
        groupName: group.name,
        isNewGroup,
        syncSettings
    });

    // Calculate counts from server data (for display)
    let ruleCount = 0;
    let blocklistCount = 0;
    let rewriteCount = 0;
    let clientCount = 0;
    let queryLogIgnoredCount = 0;
    let statsIgnoredCount = 0;

    if (group.serverIds && group.serverIds.length > 0) {
        try {
            const allRules = [];
            const allBlocklists = [];
            const allRewrites = [];
            const allClients = [];

            // Get cached data from all servers in the group
            for (const serverId of group.serverIds) {
                const cache = await window.app.sendMessage('getCache', { serverId });
                if (cache) {
                    // Collect data for deduplication
                    if (cache.rules) {
                        allRules.push(...cache.rules);
                    }
                    if (cache.blocklists) {
                        allBlocklists.push(...cache.blocklists);
                    }
                    if (cache.rewrites) {
                        allRewrites.push(...cache.rewrites);
                    }
                    if (cache.clients) {
                        allClients.push(...cache.clients);
                    }
                }
            }

            // Deduplicate all data types for accurate counts
            const { normalizeRule, dedupRules } = await import('../shared/utilities.js');
            const { dedupBlocklists, dedupRewrites, dedupClients, deduplicateIgnoredDomains } = await import('../utils.js');

            // Rules
            const normalized = allRules.map(normalizeRule).filter(r => r);
            const dedupedRules = dedupRules(normalized);
            ruleCount = dedupedRules.length;

            // Blocklists
            const dedupedBlocklists = dedupBlocklists(allBlocklists);
            blocklistCount = dedupedBlocklists.length;

            // Rewrites
            const dedupedRewrites = dedupRewrites(allRewrites);
            rewriteCount = dedupedRewrites.length;

            // Clients
            const dedupedClients = dedupClients(allClients);
            clientCount = dedupedClients.length;

            // Fetch ignored domains from first server (they should be synced)
            if (group.serverIds.length > 0) {
                try {
                    const firstServerId = group.serverIds[0];
                    const server = await window.app.sendMessage('getServer', { id: firstServerId });

                    if (server) {
                        // Query Log Ignored
                        try {
                            const queryLogConfig = await window.app.sendMessage('getQueryLogConfig', { server });
                            if (queryLogConfig?.ignored) {
                                const dedupedQueryLog = deduplicateIgnoredDomains(queryLogConfig.ignored);
                                queryLogIgnoredCount = dedupedQueryLog.length;
                            }
                        } catch (e) {
                            console.debug('Failed to fetch query log config:', e);
                        }

                        // Stats Ignored
                        try {
                            const statsConfig = await window.app.sendMessage('getStatsConfig', { server });
                            if (statsConfig?.ignored) {
                                const dedupedStats = deduplicateIgnoredDomains(statsConfig.ignored);
                                statsIgnoredCount = dedupedStats.length;
                            }
                        } catch (e) {
                            console.debug('Failed to fetch stats config:', e);
                        }
                    }
                } catch (e) {
                    console.debug('Failed to fetch ignored domains counts:', e);
                }
            }
        } catch (error) {
            console.error('Error fetching counts:', error);
        }
    }

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-icon-btn" id="back-btn" title="Back">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <h1 class="view-title">${escapeHtml(group.name)}</h1>
                <div class="header-action-area"></div>
            </div>

            <div class="view-body" style="padding-bottom: 12px !important;">
                <!-- Modern Dashboard Container -->
                <div class="dashboard-container">
                    <!-- Header Section with Server Pill -->
                    <div class="header-section">
                        <h2>Sync Settings</h2>
                        
                        <div class="server-pill" id="manage-servers-btn">
                            <span class="server-manage">Manage Servers</span>
                        </div>
                    </div>

                    <!-- Sync Cards - Vertical Pills with Toggles -->
                    <div class="sync-pills-container">
                        <!-- Preview Banner (shown when sync is disabled) -->
                        <div class="preview-banner" id="preview-banner" style="display: none;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                            <span>Preview Mode - Sync Disabled. Enable toggle and click Update to activate syncing.</span>
                        </div>

                        <!-- Custom Rules - Active -->
                        <div class="sync-pill ${syncSettings.customRules ? 'active' : 'inactive'}" data-sync-type="customRules">
                            <div class="pill-top">
                                <div class="pill-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 2.5L4.5 5.5V11.5C4.5 16.2 8 19.5 12 21.5C16 19.5 19.5 16.2 19.5 11.5V5.5L12 2.5Z" stroke-width="1.8" stroke-linejoin="round"/>
                                        <path d="M8.8 12.5L11 14.7L15.2 10.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                                <label class="sync-toggle">
                                    <input type="checkbox" class="sync-toggle-input" data-sync-type="customRules" ${syncSettings.customRules ? 'checked' : ''}>
                                    <span class="sync-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="pill-text">
                                <div class="pill-title">Custom Rules</div>
                                <div class="pill-subtitle">Manage local block/allow entries</div>
                                <div class="pill-count">${ruleCount} rules</div>
                            </div>
                        </div>

                        <!-- DNS Blocklists - Active -->
                        <div class="sync-pill ${syncSettings.dnsBlocklists ? 'active' : 'inactive'}" data-sync-type="dnsBlocklists">
                            <div class="pill-top">
                                <div class="pill-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 7C21 8.65685 16.9706 10 12 10C7.02944 10 3 8.65685 3 7C3 5.34315 7.02944 4 12 4C16.9706 4 21 5.34315 21 7Z" />
                                        <path d="M3 7V12C3 13.6569 7.02944 15 12 15C13.8 15 15.5 14.8 17 14.5" />
                                        <path d="M3 12V17C3 18.6569 7.02944 20 12 20C12.5 20 13 19.9 13.5 19.9" />
                                        <path d="M21 7V12" />
                                        <circle cx="18.5" cy="18.5" r="4.5" fill="transparent" stroke="currentColor" />
                                        <path d="M15.5 15.5L21.5 21.5" />
                                    </svg>
                                </div>
                                <label class="sync-toggle">
                                    <input type="checkbox" class="sync-toggle-input" data-sync-type="dnsBlocklists" ${syncSettings.dnsBlocklists ? 'checked' : ''}>
                                    <span class="sync-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="pill-text">
                                <div class="pill-title">DNS Blocklists</div>
                                <div class="pill-subtitle">Subscribe to external filters</div>
                                <div class="pill-count">${blocklistCount} lists</div>
                            </div>
                        </div>

                        <!-- DNS Rewrites - Active -->
                        <div class="sync-pill ${syncSettings.dnsRewrites ? 'active' : 'inactive'}" data-sync-type="dnsRewrites">
                            <div class="pill-top">
                                <div class="pill-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M5 12C5 8.7 7.7 6 11 6H16" stroke-width="1.8" stroke-linecap="round"/>
                                        <path d="M14 4L16 6L14 8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M19 12C19 15.3 16.3 18 13 18H8" stroke-width="1.8" stroke-linecap="round"/>
                                        <path d="M10 20L8 18L10 16" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                                <label class="sync-toggle">
                                    <input type="checkbox" class="sync-toggle-input" data-sync-type="dnsRewrites" ${syncSettings.dnsRewrites ? 'checked' : ''}>
                                    <span class="sync-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="pill-text">
                                <div class="pill-title">DNS Rewrites</div>
                                <div class="pill-subtitle">Redirect domains locally</div>
                                <div class="pill-count">${rewriteCount} rewrites</div>
                            </div>
                        </div>

                        <!-- Home Clients - Active -->
                        <div class="sync-pill ${syncSettings.homeClients ? 'active' : 'inactive'}" data-sync-type="homeClients">
                            <div class="pill-top">
                                <div class="pill-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1.8 9.2L12 1.8L22.2 9.2" stroke-width="2.2"/>
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-width="2"/>
                                        <path d="M6.5 13.5a7 7 0 0 1 11 0" stroke-width="2"/>
                                        <path d="M8.8 15.8a4.5 4.5 0 0 1 6.4 0" stroke-width="2"/>
                                        <circle cx="12" cy="18.2" r="1.3" fill="currentColor" stroke="none"/>
                                    </svg>
                                </div>
                                <label class="sync-toggle">
                                    <input type="checkbox" class="sync-toggle-input" data-sync-type="homeClients" ${syncSettings.homeClients ? 'checked' : ''}>
                                    <span class="sync-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="pill-text">
                                <div class="pill-title">Home Clients</div>
                                <div class="pill-subtitle">Manage devices on your network</div>
                                <div class="pill-count">${clientCount} clients</div>
                            </div>
                        </div>

                        <!-- Query Log Ignored - Active -->
                        <div class="sync-pill ${syncSettings.queryLogIgnored ? 'active' : 'inactive'}" data-sync-type="queryLogIgnored">
                            <div class="pill-top">
                                <div class="pill-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2"/>
                                        <polyline points="14 2 14 8 20 8" stroke-width="2"/>
                                        <line x1="16" y1="13" x2="8" y2="13" stroke-width="2"/>
                                        <line x1="16" y1="17" x2="8" y2="17" stroke-width="2"/>
                                        <polyline points="10 9 9 9 8 9" stroke-width="2"/>
                                    </svg>
                                </div>
                                <label class="sync-toggle">
                                    <input type="checkbox" class="sync-toggle-input" data-sync-type="queryLogIgnored" ${syncSettings.queryLogIgnored ? 'checked' : ''}>
                                    <span class="sync-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="pill-text">
                                <div class="pill-title">Logs Config</div>
                                <div class="pill-subtitle">Domains ignored in query logs</div>
                                <div class="pill-count">${queryLogIgnoredCount} domains</div>
                            </div>
                        </div>

                        <!-- Stats Ignored - Active -->
                        <div class="sync-pill ${syncSettings.statsIgnored ? 'active' : 'inactive'}" data-sync-type="statsIgnored">
                            <div class="pill-top">
                                <div class="pill-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="18" y1="20" x2="18" y2="10" stroke-width="2"/>
                                        <line x1="12" y1="20" x2="12" y2="4" stroke-width="2"/>
                                        <line x1="6" y1="20" x2="6" y2="14" stroke-width="2"/>
                                    </svg>
                                </div>
                                <label class="sync-toggle">
                                    <input type="checkbox" class="sync-toggle-input" data-sync-type="statsIgnored" ${syncSettings.statsIgnored ? 'checked' : ''}>
                                    <span class="sync-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="pill-text">
                                <div class="pill-title">Stats Config</div>
                                <div class="pill-subtitle">Domains ignored in statistics</div>
                                <div class="pill-count">${statsIgnoredCount} domains</div>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="action-buttons">
                        <button class="btn-cancel" id="cancel-btn">Close</button>
                        <button class="btn-update" id="update-btn" disabled>Update</button>
                    </div>
                    
                    <!-- Spacer to push buttons away from edge -->
                    <div style="height: 24px;"></div>
                </div>

                <style>
                    .dashboard-container {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        padding-bottom: 12px;
                    }

                    .header-section {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding-bottom: 12px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    }

                    .header-section h2 {
                        font-size: 1rem;
                        font-weight: 600;
                        letter-spacing: -0.5px;
                        color: var(--color-text-primary);
                        margin: 0;
                    }

                    .server-pill {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        background: rgba(76, 175, 80, 0.1);
                        border: 1px solid rgba(76, 175, 80, 0.3);
                        padding: 6px 12px;
                        border-radius: 6px;
                        font-size: 0.75rem;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    }

                    .server-pill:hover {
                        border-color: var(--color-success);
                        background: rgba(76, 175, 80, 0.15);
                    }

                    .server-text {
                        color: var(--color-text-secondary);
                    }

                    .server-manage {
                        color: var(--color-success);
                        font-size: 0.75rem;
                        font-weight: 600;
                        letter-spacing: 0.3px;
                    }

                    .sync-pills-container {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 6px;
                    }

                    .preview-banner {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        padding: 5px 7px;
                        background: rgba(255, 152, 0, 0.1);
                        border: 1px solid rgba(255, 152, 0, 0.3);
                        border-radius: 6px;
                        font-size: 0.65rem;
                        color: #ffa726;
                        margin-bottom: 8px;
                        grid-column: 1 / -1; /* Span all columns */
                    }

                    .preview-banner svg {
                        flex-shrink: 0;
                        color: #ffa726;
                        width: 14px;
                        height: 14px;
                    }

                    .sync-pill {
                        display: flex;
                        flex-direction: column;
                        padding: 8px;
                        border-radius: 8px;
                        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                        cursor: pointer;
                    }

                    .sync-pill.active,
                    .sync-pill.inactive {
                        cursor: pointer;
                    }

                    .sync-pill.active:hover,
                    .sync-pill.inactive:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
                    }

                    .pill-top {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 6px;
                    }

                    .pill-left {
                        display: flex;
                        align-items: center;
                        gap: 0;
                        flex: 0;
                    }

                    .pill-icon {
                        width: 32px;
                        height: 32px;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }
                    
                    .pill-icon svg {
                        width: 20px;
                        height: 20px;
                    }

                    .pill-text {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        text-align: left;
                    }

                    .pill-title {
                        font-size: 0.85rem;
                        font-weight: 600;
                        line-height: 1.1;
                    }

                    .pill-subtitle {
                        font-size: 0.7rem;
                        line-height: 1.2;
                    }

                    .pill-count {
                        font-size: 0.7rem;
                        font-weight: 600;
                        margin-top: 1px;
                        opacity: 0.9;
                    }

                    .pill-right {
                        flex-shrink: 0;
                    }

                    .pill-badge {
                        font-size: 0.65rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        padding: 4px 10px;
                        border-radius: 10px;
                    }

                    /* Toggle Switch */
                    .sync-toggle {
                        position: relative;
                        display: inline-block;
                        width: 40px;
                        height: 22px;
                    }

                    .sync-toggle-input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }

                    .sync-toggle-slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: #f44336;
                        transition: 0.3s;
                        border-radius: 22px;
                    }

                    .sync-toggle-slider:before {
                        position: absolute;
                        content: "";
                        height: 16px;
                        width: 16px;
                        left: 3px;
                        bottom: 3px;
                        background-color: white;
                        transition: 0.3s;
                        border-radius: 50%;
                    }

                    .sync-toggle-input:checked + .sync-toggle-slider {
                        background-color: #3db87e;
                    }

                    .sync-toggle-input:checked + .sync-toggle-slider:before {
                        transform: translateX(18px);
                    }

                    /* Active Pill - Deep Green */
                    .sync-pill.active {
                        background: #0a7c0a;
                        border: 1px solid rgba(10, 124, 10, 0.4);
                        box-shadow: 0 4px 16px rgba(10, 124, 10, 0.25);
                    }

                    .sync-pill.active .pill-icon {
                        background: rgba(255, 255, 255, 0.2);
                        color: #ffffff;
                    }

                    .sync-pill.active .pill-title {
                        color: #ffffff;
                    }

                    .sync-pill.active .pill-subtitle {
                        color: rgba(255, 255, 255, 0.85);
                    }

                    /* Inactive Pills - Individual Colors */
                    .sync-pill.inactive {
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                    }

                    /* All Cards - Solid Deep Blood Red */
                    .sync-pill.inactive[data-sync-type="customRules"],
                    .sync-pill.inactive[data-sync-type="dnsBlocklists"],
                    .sync-pill.inactive[data-sync-type="dnsRewrites"],
                    .sync-pill.inactive[data-sync-type="homeClients"],
                    .sync-pill.inactive[data-sync-type="queryLogIgnored"],
                    .sync-pill.inactive[data-sync-type="statsIgnored"] {
                        background: #8b0000;
                    }

                    .sync-pill.inactive .pill-icon {
                        background: rgba(255, 255, 255, 0.2);
                        color: #ffffff;
                    }

                    .sync-pill.inactive .pill-title {
                        color: #ffffff;
                    }

                    .sync-pill.inactive .pill-subtitle {
                        color: rgba(255, 255, 255, 0.85);
                    }

                    /* Disabled Pill */
                    .sync-pill.disabled {
                        background: transparent;
                        border: 1px dashed var(--color-border);
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    .sync-pill.disabled .pill-icon {
                        background: rgba(255, 255, 255, 0.05);
                        color: var(--color-text-tertiary);
                    }

                    .sync-pill.disabled .pill-title {
                        color: var(--color-text-secondary);
                    }

                    .sync-pill.disabled .pill-subtitle {
                        color: var(--color-text-tertiary);
                    }

                    .sync-pill.disabled .pill-badge {
                        background: rgba(255, 255, 255, 0.05);
                        color: var(--color-text-tertiary);
                    }

                    /* Action Buttons */
                    .action-buttons {
                        display: flex;
                        gap: 10px;
                        margin-top: 12px;
                        padding: 0 20px 20px 20px;
                    }

                    .btn-cancel,
                    .btn-update {
                        flex: 1;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        border: none;
                    }

                    .btn-cancel {
                        background: #dc3545;
                        color: #ffffff;
                        border: none;
                    }

                    .btn-cancel:hover {
                        background: #c82333;
                        border: none;
                    }

                    .btn-update {
                        background: #3db87e;
                        color: #ffffff;
                    }

                    .btn-update:hover:not(:disabled) {
                        background: #2a8a5f;
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(61, 184, 126, 0.3);
                    }

                    .btn-update:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                </style>
            </div>
        </div>
    `;

    // Track changes
    let hasChanges = false;
    const pendingChanges = { ...syncSettings };

    // Event Listeners
    const backBtn = container.querySelector('#back-btn');
    const manageBtn = container.querySelector('#manage-servers-btn');
    const cancelBtn = container.querySelector('#cancel-btn');
    const updateBtn = container.querySelector('#update-btn');
    const toggles = container.querySelectorAll('.sync-toggle-input');

    backBtn?.addEventListener('click', async (e) => {
        if (hasChanges) {
            const confirmed = await showConfirmDialog(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to leave?',
                'Your changes will be lost if you leave without updating.',
                'Cancel',
                'Leave'
            );
            if (!confirmed) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }
        }
        window.app.navigateTo('settings');
    });

    manageBtn?.addEventListener('click', () => {
        window.app.navigateTo('group-server-selection', { mode: 'edit', groupId });
    });

    // Toggle change handlers (preview mode)
    toggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const syncType = toggle.dataset.syncType;
            const isEnabled = toggle.checked;
            // Update pending changes
            pendingChanges[syncType] = isEnabled;

            console.log('[GroupSettings] Toggle changed', {
                syncType,
                isEnabled,
                pendingChanges
            });

            // Update pill visual state
            const pill = container.querySelector(`.sync-pill[data-sync-type="${syncType}"]`);
            if (pill && !pill.classList.contains('disabled')) {
                if (isEnabled) {
                    pill.classList.remove('inactive');
                    pill.classList.add('active');
                } else {
                    pill.classList.remove('active');
                    pill.classList.add('inactive');
                }
            }

            // Check if there are changes
            hasChanges = Object.keys(pendingChanges).some(key => pendingChanges[key] !== syncSettings[key]);
            updateBtn.disabled = !hasChanges;

            console.log('[GroupSettings] Changes detected', { hasChanges, updateBtnDisabled: updateBtn.disabled });

            // Update preview banner
            updatePreviewBanner();
        });
    });

    // Helper function to update preview banner visibility
    const updatePreviewBanner = () => {
        const previewBanner = container.querySelector('#preview-banner');
        // Always show the banner to remind users to click Update
        if (previewBanner) {
            previewBanner.style.display = 'flex';
        }
    };

    // Set initial banner state
    updatePreviewBanner();

    // Custom Rules card click handler
    const customRulesCard = container.querySelector('.sync-pill[data-sync-type="customRules"]');
    customRulesCard?.addEventListener('click', (e) => {
        // Don't navigate if clicking on the toggle
        if (e.target.closest('.sync-toggle')) {
            return;
        }
        window.app.navigateTo('group-merged-rules', { groupId });
    });

    // DNS Blocklists card click handler
    const blocklistsCard = container.querySelector('.sync-pill[data-sync-type="dnsBlocklists"]');
    blocklistsCard?.addEventListener('click', (e) => {
        // Don't navigate if clicking on the toggle
        if (e.target.closest('.sync-toggle')) {
            return;
        }
        window.app.navigateTo('group-blocklists', { groupId });
    });

    // DNS Rewrites card click handler
    const rewritesCard = container.querySelector('.sync-pill[data-sync-type="dnsRewrites"]');
    rewritesCard?.addEventListener('click', (e) => {
        // Don't navigate if clicking on the toggle
        if (e.target.closest('.sync-toggle')) {
            return;
        }
        window.app.navigateTo('group-rewrites', { groupId });
    });

    // Home Clients card click handler
    const clientsCard = container.querySelector('.sync-pill[data-sync-type="homeClients"]');
    clientsCard?.addEventListener('click', (e) => {
        // Don't navigate if clicking on the toggle
        if (e.target.closest('.sync-toggle')) {
            return;
        }
        window.app.navigateTo('group-clients', { groupId });
    });

    // Query Log Ignored card click handler
    const queryLogCard = container.querySelector('.sync-pill[data-sync-type="queryLogIgnored"]');
    queryLogCard?.addEventListener('click', (e) => {
        // Don't navigate if clicking on the toggle
        if (e.target.closest('.sync-toggle')) {
            return;
        }
        window.app.navigateTo('group-querylog-ignored', { groupId });
    });

    // Stats Ignored card click handler
    const statsCard = container.querySelector('.sync-pill[data-sync-type="statsIgnored"]');
    statsCard?.addEventListener('click', (e) => {
        // Don't navigate if clicking on the toggle
        if (e.target.closest('.sync-toggle')) {
            return;
        }
        window.app.navigateTo('group-stats-ignored', { groupId });
    });

    // Cancel button - reset to original state
    cancelBtn?.addEventListener('click', () => {
        console.log('[GroupSettings] Cancel button clicked - resetting changes', {
            oldPendingChanges: { ...pendingChanges },
            restoringTo: syncSettings
        });

        toggles.forEach(toggle => {
            const syncType = toggle.dataset.syncType;
            toggle.checked = syncSettings[syncType];

            // Reset pending changes
            pendingChanges[syncType] = syncSettings[syncType];

            // Reset pill visual state
            const pill = container.querySelector(`.sync-pill[data-sync-type="${syncType}"]`);
            if (pill && !pill.classList.contains('disabled')) {
                if (syncSettings[syncType]) {
                    pill.classList.remove('inactive');
                    pill.classList.add('active');
                } else {
                    pill.classList.remove('active');
                    pill.classList.add('inactive');
                }
            }
        });

        // Update preview banner
        updatePreviewBanner();

        hasChanges = false;
        updateBtn.disabled = true;

        // Navigate back to settings
        window.app.navigateTo('settings');
    });

    // Update button - save changes
    updateBtn?.addEventListener('click', async () => {
        try {
            console.log('[GroupSettings] Update button clicked', {
                groupId: group.id,
                groupName: group.name,
                oldSyncSettings: syncSettings,
                newSyncSettings: pendingChanges
            });

            // Check if any sync type was just enabled
            const customRulesEnabled = syncSettings.customRules === false && pendingChanges.customRules === true;
            const blocklistsEnabled = syncSettings.dnsBlocklists === false && pendingChanges.dnsBlocklists === true;
            const rewritesEnabled = syncSettings.dnsRewrites === false && pendingChanges.dnsRewrites === true;
            const clientsEnabled = syncSettings.homeClients === false && pendingChanges.homeClients === true;

            const anySyncEnabled = customRulesEnabled || blocklistsEnabled || rewritesEnabled || clientsEnabled;

            // Update group with new sync settings
            const updatedGroup = {
                ...group,
                syncSettings: pendingChanges
            };

            await window.app.sendMessage('saveGroup', { group: updatedGroup });
            console.log('[GroupSettings] Group saved successfully', { groupId: group.id });

            window.app.showToast('Sync settings updated successfully', 'success');

            // Reset change tracking
            Object.assign(syncSettings, pendingChanges);
            hasChanges = false;
            updateBtn.disabled = true;

            // If any sync was just enabled, show informative merge notification
            if (anySyncEnabled) {
                let mergeMessage = 'Merging ';
                const enabledTypes = [];
                if (customRulesEnabled) enabledTypes.push('rules');
                if (blocklistsEnabled) enabledTypes.push('blocklists');
                if (rewritesEnabled) enabledTypes.push('rewrites');
                if (clientsEnabled) enabledTypes.push('clients');

                mergeMessage += enabledTypes.join(', ') + ' across group members...';

                console.log('[GroupSettings] Sync enabled - triggering merge:', enabledTypes);
                window.app.showToast(mergeMessage, 'info');

                try {
                    // Trigger background sync for all servers in the group
                    await window.app.sendMessage('refreshAllServers', { force: true });
                    console.log('[GroupSettings] Sync triggered successfully');

                    window.app.showToast('Sync completed successfully', 'success');

                } catch (syncError) {
                    console.error('[GroupSettings] Failed to trigger sync:', syncError);
                    window.app.showToast('Sync settings saved, but merge failed. Please refresh manually.', 'warning');
                }
            }

        } catch (error) {
            console.error('[GroupSettings] Error updating sync settings:', error);
            window.app.showToast('Failed to update sync settings', 'error');
        }
    });
}
