// Log Detail View
// Displays full details of a specific DNS query

import { escapeHtml, classifyRule } from '../utils.js';
import { renderAddRuleSection } from './add-rule.js';
import { Logger } from '../utils/logger.js';

export function renderLogDetail(container, data) {
    if (!data || !data.log) {
        window.app.showToast('Error: No log data', 'error');
        window.app.navigateTo('query-log', { serverId: data?.serverId });
        return;
    }

    const { log, serverId } = data;
    const domain = log.question.name;
    const client = log.client;
    // Status Logic
    const status = log.status || 'Processed';
    let isBlocked = (status === 'Blocked' || status === 'BlockedByUrl');
    // AdGuard returns 'Processed' for allowed, 'WhiteList' for explicit allow
    // Using simple heuristic: Blocked = Red, else Green
    let statusText = isBlocked ? 'Blocked' : 'Processed';
    let statusColor = isBlocked ? 'var(--color-danger)' : 'var(--color-accent)';

    if (status.includes('WhiteList')) {
        statusText = 'Processed (whitelist)';
        statusColor = 'var(--color-accent)';
    } else if (isBlocked) {
        statusText = 'Blocked (blacklist)';
        statusColor = 'var(--color-danger)';
    }

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-back-btn" id="detail-back-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    <span>Back</span>
                </button>
                <h1 class="view-title">Log details</h1>
                <button class="header-icon-btn" id="detail-add-rule-btn" title="Block/Allow this domain">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>

            <div class="view-body" style="padding: 16px; overflow-y: auto;">
                
                <!-- Status Section -->
                <div class="detail-section">
                    <div class="detail-section-title">Status</div>
                    
                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">Result</div>
                            <div class="detail-value" style="color: ${statusColor}">${statusText}</div>
                        </div>
                        ${log.cached ? '<div class="detail-badge">CACHE</div>' : ''}
                    </div>

                    ${log.rules && log.rules.length > 0 ? `
                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">Blocking rule</div>
                            <div class="detail-value" style="font-family: monospace;">${escapeHtml(log.rules[0].text)}</div>
                        </div>
                    </div>
                    ` : ''}

                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">Date</div>
                            <div class="detail-value">${new Date(log.time).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">Time</div>
                            <div class="detail-value">${new Date(log.time).toLocaleTimeString()}</div>
                        </div>
                    </div>
                </div>

                <!-- Request Section -->
                <div class="detail-section">
                    <div class="detail-section-title">Request</div>
                    
                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">Domain</div>
                            <div class="detail-value">${escapeHtml(domain)}</div>
                        </div>
                    </div>

                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">Type</div>
                            <div class="detail-value">${escapeHtml(log.question.type || 'A')}</div>
                        </div>
                    </div>
                </div>

                <!-- Client Section -->
                <div class="detail-section">
                    <div class="detail-section-title">Client</div>
                    
                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">IP address</div>
                            <div class="detail-value">${escapeHtml(log.client_info?.ip || 'N/A')}</div>
                        </div>
                    </div>

                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">Name</div>
                            <div class="detail-value">${escapeHtml(client)}</div>
                        </div>
                    </div>
                </div>

                ${log.answer && log.answer.length > 0 ? `
                <!-- Answers Section -->
                <div class="detail-section">
                    <div class="detail-section-title">Answers</div>
                    ${log.answer.map(ans => `
                    <div class="detail-row">
                        <div class="detail-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </div>
                        <div class="detail-content">
                            <div class="detail-label">${escapeHtml(ans.value)}</div>
                            <div class="detail-value" style="font-size:10px; opacity:0.7">TTL: ${ans.ttl}</div>
                        </div>
                        <div class="detail-badge">${escapeHtml(ans.type)}</div>
                    </div>
                    `).join('')}
                </div>
                ` : ''}

            </div>

             <!-- Overlay for Add Rule -->
            <div id="detail-add-rule-overlay" class="hidden" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 100; display: flex; flex-direction: column;">
                 <div style="margin: auto; width: 90%; max-height: 80%; background: var(--color-bg-primary); border-radius: 8px; border: 1px solid var(--color-border); display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                     <div style="padding: 12px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; background: var(--color-bg-secondary); border-radius: 8px 8px 0 0;">
                        <h3 style="margin: 0; font-size: 14px;">Add Rule</h3>
                        <button class="btn btn-sm btn-ghost" id="detail-close-overlay-btn">Close</button>
                     </div>
                     <div id="detail-overlay-content" style="flex: 1; overflow-y: auto; padding: 16px;">
                        <!-- Add Rule Form Injected Here -->
                     </div>
                 </div>
            </div>
        </div>

        <style>
            .detail-section {
                margin-bottom: 24px;
            }
            .detail-section-title {
                color: var(--color-accent);
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .detail-row {
                display: flex;
                align-items: center;
                margin-bottom: 16px;
            }
            .detail-icon {
                width: 24px;
                height: 24px;
                margin-right: 16px;
                color: var(--color-text-secondary);
                display: flex; /* Center SVG */
                align-items: center;
                justify-content: center;
            }
            .detail-icon svg {
                width: 18px;
                height: 18px;
            }
            .detail-content {
                flex: 1;
                min-width: 0;
            }
            .detail-label {
                font-size: 11px;
                color: var(--color-text-secondary);
                margin-bottom: 2px;
            }
            .detail-value {
                font-size: 13px;
                color: var(--color-text-primary);
                word-break: break-all;
            }
            .detail-badge {
                font-size: 10px;
                padding: 2px 6px;
                background: var(--color-bg-secondary);
                border-radius: 4px;
                color: var(--color-text-secondary);
                margin-left: 8px;
                white-space: nowrap;
            }
        </style>
    `;

    // Navigation
    document.getElementById('detail-back-btn').addEventListener('click', () => {
        window.app.navigateTo('query-log', { serverId });
    });

    // Add Rule Overlay Handling
    const overlay = document.getElementById('detail-add-rule-overlay');
    const closeOverlayBtn = document.getElementById('detail-close-overlay-btn');
    const addRuleBtn = document.getElementById('detail-add-rule-btn');

    closeOverlayBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
    });

    addRuleBtn.addEventListener('click', () => {
        overlay.classList.remove('hidden');

        // Render form
        const target = document.getElementById('detail-overlay-content');
        target.innerHTML = ''; // Clear prev

        // Logic similar to query-log but inside this view
        const container = document.createElement('div');
        target.appendChild(container);

        renderAddRuleSection(container);

        // Pre-fill
        setTimeout(() => {
            const ruleInput = container.querySelector('.add-rule-input');
            if (ruleInput) {
                ruleInput.value = domain;
                ruleInput.dispatchEvent(new Event('input'));
            }

            // Toggle Client Mode if client exists
            if (client) {
                const clientToggle = container.querySelector('.client-toggle-input');
                if (clientToggle) {
                    clientToggle.click();
                    setTimeout(() => {
                        const clientInput = container.querySelector('.compact-client-input');
                        if (clientInput) {
                            clientInput.value = client;
                            clientInput.dispatchEvent(new Event('input'));
                        }
                    }, 50);
                }
            }
        }, 100);
    });
}
