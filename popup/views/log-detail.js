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

    // --- CLASSIFICATION LOGIC (Matches query-log.js) ---
    const status = log.status || 'Processed';
    const lowerStatus = status.toLowerCase();

    let type = 'Processed'; // Default (covers NotFilteredNotFound)

    // Check for Exception/Whitelist Rules (@@...)
    // Check for Exception/Whitelist Rules (@@...)
    const hasExceptionRule = log.rules && log.rules.some(r => r.text && r.text.trim().startsWith('@@'));

    if (lowerStatus.includes('rewrite') || (log.reason && log.reason.toLowerCase().includes('rewrite'))) {
        type = 'Rewritten';
    } else if (lowerStatus.includes('white') || lowerStatus.includes('allow') || hasExceptionRule) {
        type = 'Allowed';
    } else if (
        lowerStatus.includes('block') ||
        lowerStatus.includes('safebrowsing') ||
        lowerStatus.includes('parental') ||
        lowerStatus.includes('filteredblacklist') ||
        (log.rules && log.rules.length > 0)
    ) {
        type = 'Blocked';
    } else {
        type = 'Processed';
    }

    // --- VISUALS ---
    let statusText = type;
    let statusColor = '#ffffff'; // Default White
    let iconSvg = '';

    if (type === 'Rewritten') {
        statusColor = '#38bdf8'; // Sky
        iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" class="text-sky" style="color: #38bdf8;">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.2"/>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0"/> 
            <circle cx="12" cy="12" r="3" fill="currentColor"/> 
        </svg>`;
    } else if (type === 'Allowed') {
        statusColor = '#42d392'; // Green
        iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" class="text-success" style="color: #42d392;">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.2"/>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    } else if (type === 'Blocked') {
        statusColor = '#ff4d4d'; // Red
        iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" class="text-danger" style="color: #ff4d4d;">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.2"/>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    } else {
        // Processed
        statusColor = '#ffffff'; // White
        iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" class="text-white" style="color: #ffffff;">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.2"/>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    const isRewritten = type === 'Rewritten';

    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <button class="header-icon-btn" id="detail-back-btn" title="Back">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div class="header-title app-title" style="flex:1;">LOG DETAILS</div>
                <div class="header-action-area">
                    <button class="header-icon-btn btn-add" id="detail-add-rule-btn" title="Block/Allow this domain" ${isRewritten ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="view-body" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
                <div id="log-detail-scroll-container" style="flex: 1; overflow-y: auto; padding: 16px;">
                    
                <!-- Hero Status Card -->
                <div class="log-detail-hero" style="background: linear-gradient(135deg, ${statusColor}15, ${statusColor}05); border: 1px solid ${statusColor}40; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <div style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                            ${iconSvg.replace('width="18px"', 'width="32px"').replace('height="18px"', 'height="32px"')}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 11px; color: ${statusColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${statusText}</div>
                            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); word-break: break-all;">${escapeHtml(domain)}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <div class="log-detail-pill">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>${new Date(log.time).toLocaleTimeString(undefined, { hour12: false })}</span>
                        </div>
                        <div class="log-detail-pill">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span>${new Date(log.time).toLocaleDateString()}</span>
                        </div>
                        <div class="log-detail-pill">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>${log.elapsed ? (parseFloat(log.elapsed) * 1000).toFixed(2) : (log.elapsedMs ? parseFloat(log.elapsedMs).toFixed(2) : '0.00')} ms</span>
                        </div>
                    </div>
                </div>

                <!-- Response Details Card -->
                <div class="log-detail-card">
                    <div class="log-detail-card-title">Response Details</div>
                    <div class="log-detail-grid">
                        ${log.upstream ? `
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6" y2="6"/><line x1="6" y1="18" x2="6" y2="18"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">DNS Server</div>
                                <div class="log-detail-item-value">${escapeHtml(log.upstream)}</div>
                            </div>
                        </div>` : ''}
                        
                        ${log.cached ? `
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-value" style="font-size: 13px;">Served from cache</div>
                            </div>
                        </div>` : ''}
                        
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">Response Code</div>
                                <div class="log-detail-item-value">${log.reason === 'Rewrite' ? 'NOERROR' : (log.status || 'NOERROR')}</div>
                            </div>
                        </div>
                    </div>
                    
                    ${log.rules && log.rules.length > 0 ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border);">
                        <div style="display: flex; align-items: center; margin-bottom: 12px;">
                            <div class="log-detail-item-icon" style="margin-right: 12px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <div class="log-detail-item-label" style="margin: 0;">Matching Rule(s)</div>
                        </div>
                        ${log.rules.map((rule, idx) => `
                            <div style="background: var(--color-bg-secondary); border-radius: 8px; padding: 12px; margin-bottom: ${idx < log.rules.length - 1 ? '8px' : '0'};">
                                <div style="font-family: monospace; font-size: 12px; color: var(--color-text-primary); word-break: break-all; margin-bottom: 6px;">${escapeHtml(rule.text)}</div>
                                <div class="rule-source-${rule.filter_list_id}" style="font-size: 10px; color: var(--color-text-secondary); font-style: italic;">
                                    ${rule.filter_list_id ? 'Loading source...' : 'Custom filtering rules'}
                                </div>
                            </div>
                        `).join('')}
                    </div>` : ''}
                </div>

                <!-- Request Details Card -->
                <div class="log-detail-card">
                    <div class="log-detail-card-title">Request Details</div>
                    <div class="log-detail-grid">
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">Type</div>
                                <div class="log-detail-item-value">
                                    <span class="log-detail-badge">${escapeHtml(log.question.type || 'A')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">Protocol</div>
                                <div class="log-detail-item-value">
                                    <span class="log-detail-badge">${escapeHtml(log.client_proto || 'UDP').toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Client Details Card -->
                <div class="log-detail-card">
                    <div class="log-detail-card-title">Client Details</div>
                    <div class="log-detail-grid">
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">Name</div>
                                <div class="log-detail-item-value">${escapeHtml(log.client_info?.name || log.client_id || 'Unknown')}</div>
                            </div>
                        </div>
                        
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">Address</div>
                                <div class="log-detail-item-value" style="font-family: monospace;">${escapeHtml(log.client)}</div>
                            </div>
                        </div>
                        
                        ${log.client_info?.whois?.country ? `
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon" style="display: flex; align-items: center; justify-content: center;">
                                <img 
                                    src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${log.client_info.whois.country.toUpperCase().split('').map(c => (127397 + c.charCodeAt(0)).toString(16)).join('-')}.png" 
                                    alt="${log.client_info.whois.country}"
                                    style="width: 24px; height: 24px; object-fit: contain;"
                                    onerror="this.style.display='none'; this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/><line x1=\\'2\\' y1=\\'12\\' x2=\\'22\\' y2=\\'12\\'/><path d=\\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\\'/></svg>'"
                                >
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">Country</div>
                                <div class="log-detail-item-value">${escapeHtml(log.client_info.whois.country)}</div>
                            </div>
                        </div>` : ''}
                        
                        ${log.client_info?.whois?.orgname ? `
                        <div class="log-detail-item">
                            <div class="log-detail-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M12 8v8M5 16v-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/></svg>
                            </div>
                            <div class="log-detail-item-content">
                                <div class="log-detail-item-label">Network</div>
                                <div class="log-detail-item-value">${escapeHtml(log.client_info.whois.orgname)}</div>
                            </div>
                        </div>` : ''}
                    </div>
                </div>

                ${log.answer && log.answer.length > 0 ? `
                <!-- Answers Card -->
                <div class="log-detail-card">
                    <div class="log-detail-card-title">DNS Answers</div>
                    ${log.answer.map(ans => `
                    <div class="log-detail-answer-row">
                        <div class="log-detail-item-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-family: monospace; font-size: 13px; color: var(--color-text-primary); word-break: break-all; margin-bottom: 4px;">${escapeHtml(ans.value)}</div>
                            <div style="font-size: 10px; color: var(--color-text-secondary);">TTL: ${ans.ttl}</div>
                        </div>
                        <span class="log-detail-badge">${escapeHtml(ans.type)}</span>
                    </div>
                    `).join('')}
                </div>` : ''}
                
                </div> 
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
            .log-detail-hero {
                position: relative;
                overflow: hidden;
            }
            
            .log-detail-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                background: var(--color-bg-secondary);
                border-radius: 20px;
                font-size: 10px;
                color: var(--color-text-secondary);
                white-space: nowrap;
            }
            
            .log-detail-card {
                background: var(--color-bg-secondary);
                border: 1px solid var(--color-border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
            }
            
            .log-detail-card-title {
                color: var(--color-accent);
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 16px;
            }
            
            .log-detail-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
            }
            
            .log-detail-item {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            
            .log-detail-item-icon {
                width: 32px;
                height: 32px;
                min-width: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--color-text-secondary);
            }
            
            .log-detail-item-icon svg {
                width: 20px;
                height: 20px;
            }
            
            .log-detail-item-content {
                flex: 1;
                min-width: 0;
            }
            
            .log-detail-item-label {
                font-size: 10px;
                color: var(--color-text-secondary);
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            
            .log-detail-item-value {
                font-size: 13px;
                color: var(--color-text-primary);
                word-break: break-word;
            }
            
            .log-detail-badge {
                display: inline-block;
                padding: 4px 10px;
                background: var(--color-accent-light);
                color: var(--color-accent);
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            
            .log-detail-answer-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--color-bg-primary);
                border-radius: 8px;
                margin-bottom: 8px;
            }
            
            .log-detail-answer-row:last-child {
                margin-bottom: 0;
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

    if (!isRewritten) {
        addRuleBtn.addEventListener('click', () => {
            overlay.classList.remove('hidden');

            // Render form
            const target = document.getElementById('detail-overlay-content');
            target.innerHTML = ''; // Clear prev

            // Logic similar to query-log but inside this view
            const container = document.createElement('div');
            target.appendChild(container);

            renderAddRuleSection(container, { compact: true });

            // Logic Adjustment based on Classification (type)
            setTimeout(() => {
                const ruleInput = container.querySelector('.add-rule-input');
                if (ruleInput) {
                    ruleInput.value = domain;
                    ruleInput.dispatchEvent(new Event('input'));
                }

                const blockToggle = container.querySelector('#block-toggle');
                const clientToggle = container.querySelector('#client-toggle');
                const clientInput = container.querySelector('#client-input');

                // 1. Block/Allow Logic
                if (type === 'Blocked') {
                    // If Blocked -> Set to Allow (unchecked) & Disable
                    if (blockToggle) {
                        blockToggle.checked = false; // Allow
                        blockToggle.disabled = true;
                        blockToggle.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else if (type === 'Allowed') {
                    // If Allowed -> Set to Block (checked) & Disable
                    if (blockToggle) {
                        blockToggle.checked = true; // Block
                        blockToggle.disabled = true;
                        blockToggle.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
                // Processed -> Normal (Enabled, Default Block checked usually)

                // 2. Client Toggle Logic
                if (clientToggle && clientInput) {
                    // Logic: If toggled IN (ON), auto-fill name/IP
                    clientToggle.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            // Auto-fill. Priority: Name -> IP
                            const clientName = log.client_info?.name || '';
                            const clientIP = log.client || '';

                            // Only fill if empty or we want to force? 
                            // Request says: "it will automatically field the text box"
                            clientInput.value = clientName || clientIP;
                            clientInput.dispatchEvent(new Event('input'));
                        }
                    });
                }

            }, 100);
        });
    }

    // Fetch filter info for rules if needed
    if (log.rules && log.rules.some(r => r.filter_list_id)) {
        window.app.sendMessage('getFilteringStatus', { serverId })
            .then(status => {
                if (status && (status.filters || status.whitelist_filters)) {
                    // Create ID -> Name map
                    const filterMap = new Map();
                    [...(status.filters || []), ...(status.whitelist_filters || [])].forEach(f => {
                        filterMap.set(f.id, f.name);
                    });

                    // Update DOM for each rule
                    log.rules.forEach(rule => {
                        if (rule.filter_list_id) {
                            const elements = container.querySelectorAll(`.rule-source-${rule.filter_list_id}`);
                            elements.forEach(el => {
                                const name = filterMap.get(rule.filter_list_id);
                                el.textContent = name || `Filter ID: ${rule.filter_list_id}`;
                            });
                        }
                    });
                }
            })
            .catch(err => Logger.warn('Failed to fetch filter info:', err));
    }
}
