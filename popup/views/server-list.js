// Server List View - Professional Design with Interactive Donut Charts
// Displays list of configured servers with visual rule statistics

import { escapeHtml, classifyRule, getRuleCounts, formatCount } from '../utils.js';
import { Logger } from '../utils/logger.js';

/**
 * Create an interactive SVG donut chart with hoverable slices
 */
function createDonutChart(counts) {
  const total = counts.allow + counts.block + counts.disabled;

  if (total === 0) {
    return `
      <div class="chart-loading">
        <span class="chart-loading-text">No Rules</span>
      </div>
    `;
  }

  // Calculate angles for each segment
  const allowAngle = (counts.allow / total) * 360;
  const blockAngle = (counts.block / total) * 360;
  const disabledAngle = (counts.disabled / total) * 360;

  // SVG dimensions
  const size = 84;
  const center = size / 2;
  const radius = 42;
  const innerRadius = 28.5;

  // Helper function to describe SVG arc path
  function describeArc(startAngle, endAngle, outerR, innerR) {
    const start = polarToCartesian(center, center, outerR, endAngle);
    const end = polarToCartesian(center, center, outerR, startAngle);
    const innerStart = polarToCartesian(center, center, innerR, endAngle);
    const innerEnd = polarToCartesian(center, center, innerR, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', outerR, outerR, 0, largeArcFlag, 0, end.x, end.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerR, innerR, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
      'Z'
    ].join(' ');
  }

  function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  // Build SVG paths for each segment
  let svgPaths = '';
  let currentAngle = 0;

  if (counts.allow > 0) {
    const path = describeArc(currentAngle, currentAngle + allowAngle, radius, innerRadius);
    svgPaths += `<path class="pie-slice" d="${path}" fill="var(--color-accent)" data-count="${counts.allow}" data-label="Allow Rules">
      <title>Allow: ${counts.allow}</title>
    </path>`;
    currentAngle += allowAngle;
  }

  if (counts.block > 0) {
    const path = describeArc(currentAngle, currentAngle + blockAngle, radius, innerRadius);
    svgPaths += `<path class="pie-slice" d="${path}" fill="var(--color-danger)" data-count="${counts.block}" data-label="Block Rules">
      <title>Block: ${counts.block}</title>
    </path>`;
    currentAngle += blockAngle;
  }

  if (counts.disabled > 0) {
    const path = describeArc(currentAngle, currentAngle + disabledAngle, radius, innerRadius);
    svgPaths += `<path class="pie-slice" d="${path}" fill="var(--color-warning)" data-count="${counts.disabled}" data-label="Inactive Rules">
      <title>Inactive: ${counts.disabled}</title>
    </path>`;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart">
      ${svgPaths}
    </svg>
    <div class="donut-center" title="Total Rules: ${total}">
      <div class="donut-total">${total}</div>
    </div>
  `;
}

export async function renderServerList(container) {
  // Try to get cached snapshot for instant rendering
  const snapshot = await getUISnapshotFromBackground();

  if (snapshot && snapshot.servers && snapshot.servers.length > 0) {
    // INSTANT RENDER from cache
    Logger.info('[Performance] Rendering from cache');
    Logger.debug('[DEBUG] Cached serverData:', snapshot.serverData);
    renderServersList(container, snapshot.servers, snapshot.groups, snapshot.serverData);

    // Background: Check for changes and update if needed
    checkAndUpdateInBackground(container, snapshot);
  } else {
    // No cache - show skeleton and fetch fresh
    Logger.info('[Performance] No cache, fetching fresh data');
    container.innerHTML = `
      <div class="view-header">
        <button class="header-icon-btn btn-about" id="about-btn" title="About">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </button>
        <h1 class="view-title">Servers</h1>
        <div class="header-action-area">
          <button class="header-icon-btn btn-add" id="add-server-btn" title="Add Server">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="view-body">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
    `;

    try {
      await fetchAndRenderFresh(container);
    } catch (error) {
      console.error('Failed to load servers:', error);
      window.app.showToast('Failed to load servers: ' + error.message, 'error');
      renderEmptyState(container);
    }
  }
}

// Helper to get UI snapshot via message passing
async function getUISnapshotFromBackground() {
  try {
    return await window.app.sendMessage('getUISnapshot');
  } catch (error) {
    Logger.error('Failed to get UI snapshot:', error);
    return null;
  }
}

// Fetch fresh data and render
async function fetchAndRenderFresh(container) {
  const [servers, groups] = await Promise.all([
    window.app.sendMessage('getServers'),
    window.app.sendMessage('getGroups')
  ]);

  if (servers.length === 0) {
    renderEmptyState(container);
    return;
  }

  // Render with skeleton charts (will update progressively)
  renderServersList(container, servers, groups);

  // Save snapshot for next time
  await saveUISnapshot(servers, groups, {});
}

// Background check for changes
async function checkAndUpdateInBackground(container, cachedSnapshot) {
  try {
    const [freshServers, freshGroups] = await Promise.all([
      window.app.sendMessage('getServers'),
      window.app.sendMessage('getGroups')
    ]);

    // Quick check: server/group count changed?
    if (freshServers.length !== cachedSnapshot.servers.length ||
      freshGroups.length !== cachedSnapshot.groups.length) {
      Logger.info('[Performance] Server/group count changed, refreshing');
      renderServersList(container, freshServers, freshGroups);
      await saveUISnapshot(freshServers, freshGroups, {});
      return;
    }

    // Check for rule changes (optimized per requirements)
    const hasChanges = await detectRuleChanges(freshServers, freshGroups, cachedSnapshot.serverData);

    if (hasChanges) {
      Logger.info('[Performance] Rule changes detected, refreshing');
      // Re-render with fresh data
      renderServersList(container, freshServers, freshGroups);
    } else {
      Logger.info('[Performance] No changes detected, keeping cached UI');
      // Still save snapshot to update timestamp
      await saveUISnapshot(freshServers, freshGroups, cachedSnapshot.serverData);
    }
  } catch (error) {
    Logger.error('[Performance] Background check failed:', error);
    // Keep showing cached data - don't interrupt user
  }
}

// Detect rule changes across servers
async function detectRuleChanges(servers, groups, cachedServerData) {
  const checkedServers = new Set();

  for (const server of servers) {
    // Skip if already checked
    if (checkedServers.has(server.id)) continue;

    // Check if server belongs to a group
    const parentGroup = groups.find(g => g.serverIds && g.serverIds.includes(server.id));

    if (parentGroup) {
      // Server in group: only check FIRST server in group
      const firstInGroup = parentGroup.serverIds[0];
      if (server.id !== firstInGroup) {
        continue; // Skip, will be checked by first server
      }

      // Mark all servers in group as checked
      parentGroup.serverIds.forEach(id => checkedServers.add(id));
    } else {
      checkedServers.add(server.id);
    }

    // Check this server for changes
    try {
      const rulesResult = await window.app.sendMessage('getServerRules', { serverId: server.id });
      const currentRules = rulesResult.data?.rules || [];
      const cachedRules = cachedServerData[server.id]?.rules || [];

      // Compare rule counts (fast check)
      if (currentRules.length !== cachedRules.length) {
        return true; // Changes detected
      }
    } catch (error) {
      Logger.error(`Failed to check server ${server.id}:`, error);
      // Continue checking other servers
    }
  }

  return false; // No changes detected
}

// Save UI snapshot for next popup open
async function saveUISnapshot(servers, groups, serverData) {
  try {
    // Include protection status in snapshot for instant render
    const protectionStatus = await chrome.storage.local.get('protectionStatus');

    // Add protection status to each server's data
    for (const serverId of Object.keys(serverData)) {
      serverData[serverId].protectionEnabled = protectionStatus.protectionStatus?.[serverId];
    }

    await window.app.sendMessage('setUISnapshot', { servers, groups, serverData });
  } catch (error) {
    Logger.error('Failed to save UI snapshot:', error);
  }
}

function renderEmptyState(container) {
  container.innerHTML = `
    <div class="view-header">
      <button class="header-icon-btn btn-about" id="about-btn" title="About">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </button>
      <h1 class="view-title">Servers</h1>
      <button class="header-icon-btn btn-add" id="add-server-btn" title="Add Server">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#42A5F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="13" height="10" rx="2"></rect>
          <line x1="8.5" y1="14" x2="8.5" y2="17"></line>
          <line x1="4.5" y1="17" x2="12.5" y2="17"></line>
          <rect x="17" y="4" width="5" height="13" rx="1"></rect>
          <circle cx="19.5" cy="7" r="1" fill="#42A5F5" stroke="none"></circle>
          <line x1="18.5" y1="12" x2="20.5" y2="12"></line>
          <line x1="18.5" y1="14" x2="20.5" y2="14"></line>
        </svg>
      </div>
      <div class="empty-state-title">No Servers Yet</div>
      <div class="empty-state-text">
        Add your first AdGuard Home server to get started.
      </div>
      <button class="btn btn-primary" id="add-first-server-btn">
        Add Your First Server
      </button>
    </div>
  `;

  // Attach event listeners AFTER rendering
  const addServerBtn = document.getElementById('add-server-btn');
  if (addServerBtn) {
    addServerBtn.addEventListener('click', () => {
      window.app.navigateTo('server-form', { mode: 'add' });
    });
  }

  const aboutBtn = document.getElementById('about-btn');
  if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
      window.app.navigateTo('about');
    });
  }

  const addFirstServerBtn = document.getElementById('add-first-server-btn');
  if (addFirstServerBtn) {
    addFirstServerBtn.addEventListener('click', () => {
      window.app.navigateTo('server-form', { mode: 'add' });
    });
  }
}

async function renderServersList(container, servers, groups, cachedServerData = null) {
  // Render server cards immediately with loading charts
  const initialServerItems = servers.map(server => {
    // Check if we have cached data for this server
    const cached = cachedServerData?.[server.id];
    const chartHtml = cached?.counts ? createDonutChart(cached.counts) : `
      <div class="chart-loading">
        <span class="chart-loading-text">Loading</span>
      </div>
    `;

    // Find groups this server belongs to (for initial render)
    const serverGroups = groups.filter(g => g.serverIds && g.serverIds.includes(server.id));
    const groupBadgesHtml = serverGroups.length > 0 ? `
      <div class="server-groups-inline">
        ${serverGroups.map(group => `
          <span class="group-badge-inline" data-group-id="${group.id}" title="Click to edit group: ${escapeHtml(group.name)}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="#FFA726" stroke="#F57C00" stroke-width="2" style="margin-right:4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${escapeHtml(group.name.substring(0, 4).toUpperCase())}
          </span>
        `).join('')}
      </div>
    ` : '';

    return `
      <div class="server-card" data-server-id="${server.id}" id="server-${server.id}">
        <div class="server-info">
          <div class="server-name">
            <span class="server-icon-large">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="13" height="10" rx="2"></rect>
                    <line x1="8.5" y1="14" x2="8.5" y2="17"></line>
                    <line x1="4.5" y1="17" x2="12.5" y2="17"></line>
                    <rect x="17" y="4" width="5" height="13" rx="1"></rect>
                    <circle cx="19.5" cy="7" r="1" fill="currentColor" stroke="none"></circle>
                    <line x1="18.5" y1="12" x2="20.5" y2="12"></line>
                    <line x1="18.5" y1="14" x2="20.5" y2="14"></line>
                </svg>
                ${cached?.isOnline !== undefined ?
        `<span class="status-dot-overlay ${cached.isOnline ? 'online' : 'offline'}"></span>` :
        ''}
            </span>
            <span class="server-name-text" title="${escapeHtml(server.name)}">${escapeHtml(server.name.substring(0, 7))}</span>
            ${groupBadgesHtml}
            <span class="server-version-capsule">${escapeHtml(cached?.version || 'v...')}</span>
          </div>
        </div>
        <div class="chart-legend-container">
          <div class="protection-group">
            <button class="btn btn-icon protection-btn ${cached?.protectionEnabled !== undefined ? (cached.protectionEnabled ? 'protection-on' : 'protection-off') : 'protection-loading'}" data-server-id="${server.id}" title="${cached?.protectionEnabled !== undefined ? `Protection ${cached.protectionEnabled ? 'enabled' : 'disabled'}. Click to ${cached.protectionEnabled ? 'disable' : 'enable'}.` : 'Loading status...'}">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13" /></svg>
            </button>
            <div class="stats-capsule" data-server-id="${server.id}" title="Allow: ${formatCount(cached?.counts?.allow || 0)} | Block: ${formatCount(cached?.counts?.block || 0)}">
                <span class="allow-part">${formatCount(cached?.counts?.allow || 0)}</span>
                <span class="block-part">${formatCount(cached?.counts?.block || 0)}</span>
            </div>
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-dot allow"></span>
              <span class="legend-text">Allow</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot block"></span>
              <span class="legend-text">Block</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot inactive"></span>
              <span class="legend-text">Disabled</span>
            </div>
          </div>
          <div class="donut-chart-container">
            ${chartHtml}
          </div>
        </div>
        <div class="server-actions">
          <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}" title="Edit server">
            <svg viewBox="0 0 24 24" class="icon-gear-svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
      <div class="view-header">
      <button class="header-icon-btn btn-about" id="about-btn" title="About">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </button>
        <h1 class="view-title">Servers</h1>
        <div class="header-action-area">
          <button class="header-icon-btn btn-add" id="add-server-btn" title="Add Server">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="view-body">
        <div class="list">
          ${initialServerItems}
        </div>
      </div>
    `;

  // Event listeners
  document.getElementById('add-server-btn').addEventListener('click', () => {
    window.app.navigateTo('server-form', { mode: 'add' });
  });

  const aboutBtn = document.getElementById('about-btn');
  if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
      window.app.navigateTo('about');
    });
  }

  // Edit buttons
  document.querySelectorAll('.edit-server-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const serverId = btn.dataset.serverId;
      window.app.navigateTo('server-form', { mode: 'edit', serverId });
    });
  });

  // Protection toggle buttons
  document.querySelectorAll('.protection-btn').forEach(btn => {
    setupProtectionButton(btn, btn.dataset.serverId);
  });

  // Group badge click handlers (initial render)
  document.querySelectorAll('.group-badge-inline').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = badge.dataset.groupId;
      window.app.navigateTo('group-form', { mode: 'edit', groupId });
    });
  });

  // Stats Capsule click handlers
  document.querySelectorAll('.stats-capsule').forEach(capsule => {
    capsule.addEventListener('click', (e) => {
      e.stopPropagation();
      const serverId = capsule.dataset.serverId;
      window.app.navigateTo('query-log', { serverId });
    });
  });

  // Click on server card to view details
  document.querySelectorAll('.server-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on button
      if (e.target.closest('button')) return;

      const serverId = card.dataset.serverId;
      window.app.navigateTo('server-detail', { serverId });
    });
  });

  // Fetch data for each server progressively (even if we have cache, update it)
  const shouldFetch = !cachedServerData || Object.keys(cachedServerData).length === 0;

  // Fetch protection status for all servers in parallel
  // This updates buttons after initial cache render
  const protectionPromises = servers.map(server =>
    window.app.sendMessage('getProtectionStatus', { serverId: server.id })
      .then(result => ({ serverId: server.id, serverName: server.name, result }))
      .catch(error => ({ serverId: server.id, serverName: server.name, error }))
  );

  Promise.all(protectionPromises).then(results => {
    results.forEach(({ serverId, serverName, result, error }) => {
      if (error) {
        Logger.error(`Failed to get protection for ${serverName}:`, error);
        return;
      }

      const protectionBtn = document.querySelector(`.protection-btn[data-server-id="${serverId}"]`);
      if (protectionBtn && result.success) {
        // Remove ALL state classes first
        protectionBtn.classList.remove('protection-loading', 'protection-on', 'protection-off');
        protectionBtn.classList.add(result.enabled ? 'protection-on' : 'protection-off');
        protectionBtn.title = `Protection ${result.enabled ? 'enabled' : 'disabled'}. Click to ${result.enabled ? 'disable' : 'enable'}.`;
        Logger.debug(`${serverName} protection: ${result.enabled ? 'ON' : 'OFF'}${result.fromCache ? ' (cached)' : ''}`);
      }
    });
  });

  if (shouldFetch) {
    Logger.info('[Performance] Fetching fresh server data');
    const serverDataMap = {};

    // Use for...of instead of forEach to properly await async operations
    for (const server of servers) {
      try {
        // Fetch server info, rules, and protection status in parallel
        const [serverInfo, rulesResult, protectionResult] = await Promise.all([
          window.app.sendMessage('getServerInfo', { serverId: server.id }).catch(() => null),
          window.app.sendMessage('getServerRules', { serverId: server.id }),
          window.app.sendMessage('getProtectionStatus', { serverId: server.id }).catch(err => {
            Logger.error(`Failed to get protection status for ${server.name}:`, err);
            return null;
          })
        ]);

        const rules = rulesResult.data?.rules || [];
        const counts = getRuleCounts(rules);
        const version = serverInfo?.version || 'Unknown';
        const isOnline = serverInfo !== null;

        // Store server data for change detection
        serverDataMap[server.id] = { rules, counts, version, isOnline, protectionEnabled: protectionResult?.enabled };
        Logger.debug(`${server.name}: ${rules.length} rules, counts:`, counts);

        // Update protection button immediately if we got status
        if (protectionResult) {
          // Render protection button with cached status if available
          const protectionBtn = document.querySelector(`.protection-btn[data-server-id="${server.id}"]`);
          if (protectionBtn && cachedServerData?.[server.id]?.protectionEnabled !== undefined) {
            protectionBtn.classList.remove('protection-loading', 'protection-on', 'protection-off');
            protectionBtn.classList.add(cachedServerData[server.id].protectionEnabled ? 'protection-on' : 'protection-off');
            protectionBtn.title = `Protection ${cachedServerData[server.id].protectionEnabled ? 'enabled' : 'disabled'}. Click to ${cachedServerData[server.id].protectionEnabled ? 'disable' : 'enable'}.`;
          }
        } else {
          Logger.warn(`${server.name}: No protection status received`);
        }

        // Find groups this server belongs to
        const serverGroups = groups.filter(g => g.serverIds && g.serverIds.includes(server.id));
        const groupBadgesHtml = serverGroups.length > 0 ? `
        <div class="server-groups-inline">
          ${serverGroups.map(group => `
            <span class="group-badge-inline" data-group-id="${group.id}" title="Click to edit group: ${escapeHtml(group.name)}">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="#FFA726" stroke="#F57C00" stroke-width="2" style="margin-right:4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${escapeHtml(group.name.substring(0, 4).toUpperCase())}
            </span>
          `).join('')}
        </div>
      ` : '';

        // Update the server card
        const serverCard = document.getElementById(`server-${server.id}`);
        if (serverCard) {
          const chartHtml = createDonutChart(counts);

          const statusHtml = `
          <div class="server-info">
            <div class="server-name">
              <span class="server-icon-large">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                <span class="status-dot-overlay ${isOnline ? 'online' : 'offline'}"></span>
              </span>
              <span class="server-name-text">${escapeHtml(server.name)}</span>
              ${groupBadgesHtml}
              <span class="server-version-capsule">${escapeHtml(version)}</span>
            </div>
          </div>
          <div class="chart-legend-container">
            <div class="protection-group">
              <button class="btn btn-icon protection-btn protection-loading" data-server-id="${server.id}" title="Loading status...">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13" /></svg>
              </button>
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <span class="legend-dot allow"></span>
                <span class="legend-text">Allow</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot block"></span>
                <span class="legend-text">Block</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot inactive"></span>
                <span class="legend-text">Disabled</span>
              </div>
            </div>
            <div class="donut-chart-container">
              ${chartHtml}
            </div>
          </div>
          <div class="server-actions">
            <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}" title="Edit server">
              <svg viewBox="0 0 24 24" class="icon-gear-svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        `;
          serverCard.innerHTML = statusHtml;

          // Re-attach click handler
          serverCard.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            window.app.navigateTo('server-detail', { serverId: server.id });
          });

          // Re-attach edit button listener
          const editBtn = serverCard.querySelector('.edit-server-btn');
          if (editBtn) {
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              window.app.navigateTo('server-form', { mode: 'edit', serverId: server.id });
            });
          }

          // Re-attach Protection Button
          const srvProtectionBtn = serverCard.querySelector('.protection-btn');
          if (srvProtectionBtn) {
            setupProtectionButton(srvProtectionBtn, server.id);
            // Update state based on fetched result
            if (protectionResult) {
              updateProtectionButtonState(srvProtectionBtn, protectionResult.enabled);
            }
          }

          // Add group badge click handlers
          serverCard.querySelectorAll('.group-badge-inline').forEach(badge => {
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              const groupId = badge.dataset.groupId;
              window.app.navigateTo('group-form', { mode: 'edit', groupId });
            });
          });

          // Add Stats Capsule click handlers (Async update)
          const capsule = serverCard.querySelector('.stats-capsule');
          if (capsule) {
            capsule.addEventListener('click', (e) => {
              e.stopPropagation();
              window.app.navigateTo('query-log', { serverId: server.id });
            });
          }

          // Save snapshot after last server is done
          if (Object.keys(serverDataMap).length === servers.length) {
            saveUISnapshot(servers, groups, serverDataMap);
          }
        }
      } catch (error) {
        Logger.error(`Failed to fetch data for ${server.name}:`, error);

        // Update with error state
        const serverCard = document.getElementById(`server-${server.id}`);
        if (serverCard) {
          const errorHtml = `
          <div class="server-info">
            <div class="server-name">
              <span class="server-icon-large">
                🖥️
                <span class="status-dot-overlay offline"></span>
              </span>
              ${escapeHtml(server.name)}
            </div>
          </div>
          <div class="donut-chart-container">
            <div class="chart-loading">
              <span class="chart-loading-text">Error</span>
            </div>
          </div>
          <div class="server-actions">
            <span class="badge badge-danger">Error</span>
            <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}" title="Edit server">
              <svg viewBox="0 0 24 24" class="icon-gear-svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        `;
          serverCard.innerHTML = errorHtml;

          // Re-attach event listeners
          const editBtn = serverCard.querySelector('.edit-server-btn');
          if (editBtn) {
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              window.app.navigateTo('server-form', { mode: 'edit', serverId: server.id });
            });
          }
        }
      }
    }

    // Save snapshot after all servers are loaded
    Logger.debug('Saving snapshot. serverDataMap:', serverDataMap);
    await saveUISnapshot(servers, groups, serverDataMap);
  }
}







// Helper: Setup protection button click listener
function setupProtectionButton(btn, serverId) {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();

    // Determine new state (toggle)
    const isCurrentlyEnabled = btn.classList.contains('protection-on');
    const newState = !isCurrentlyEnabled;

    // Show loading
    btn.classList.remove('protection-on', 'protection-off');
    btn.classList.add('protection-loading');
    btn.disabled = true;

    try {
      const result = await window.app.sendMessage('toggleProtection', {
        serverId,
        enabled: newState
      });

      if (result.success) {
        // Update all affected server buttons
        result.affectedServers.forEach(affectedServer => {
          const affectedBtn = document.querySelector(`.protection-btn[data-server-id="${affectedServer.id}"]`);
          if (affectedBtn) {
            if (affectedServer.error) {
              // Error for this specific server
              affectedBtn.classList.remove('protection-loading');
              affectedBtn.classList.add('protection-off');
              const icon = affectedBtn.querySelector('.protection-icon');
              if (icon) icon.textContent = 'OFF';
              window.app.showToast(`Error for ${affectedServer.id}: ${affectedServer.error}`, 'error');
            } else {
              updateProtectionButtonState(affectedBtn, newState);
            }
          }
        });

        const successCount = result.affectedServers.filter(s => !s.error).length;
        window.app.showToast(
          `Protection ${newState ? 'enabled' : 'disabled'} for ${successCount} server(s)`,
          'success'
        );
      }
    } catch (error) {
      Logger.error('Failed to toggle protection:', error);
      updateProtectionButtonState(btn, !newState); // Revert visual
      window.app.showToast('Failed to toggle protection: ' + error.message, 'error');
    }
  });
}

// Helper: Update protection button visual state
function updateProtectionButtonState(btn, isEnabled) {
  btn.classList.remove('protection-loading', 'protection-on', 'protection-off');
  btn.classList.add(isEnabled ? 'protection-on' : 'protection-off');
  const icon = btn.querySelector('.protection-icon');
  if (icon) icon.textContent = isEnabled ? 'ON' : 'OFF';
  btn.disabled = false;
}
