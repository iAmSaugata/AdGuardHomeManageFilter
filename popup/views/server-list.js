// Server List View - Professional Design with Interactive Donut Charts
// Displays list of configured servers with visual rule statistics

import { escapeHtml, classifyRule, getRuleCounts } from '../utils.js';

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
    console.log('[Performance] Rendering from cache');
    renderServersList(container, snapshot.servers, snapshot.groups, snapshot.serverData);

    // Background: Check for changes and update if needed
    checkAndUpdateInBackground(container, snapshot);
  } else {
    // No cache - show skeleton and fetch fresh
    console.log('[Performance] No cache, fetching fresh data');
    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Servers</h1>
        <button class="btn btn-primary btn-sm" id="add-server-btn">
          Add Server
        </button>
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
    console.error('Failed to get UI snapshot:', error);
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
      console.log('[Performance] Server/group count changed, refreshing');
      renderServersList(container, freshServers, freshGroups);
      await saveUISnapshot(freshServers, freshGroups, {});
      return;
    }

    // Check for rule changes (optimized per requirements)
    const hasChanges = await detectRuleChanges(freshServers, freshGroups, cachedSnapshot.serverData);

    if (hasChanges) {
      console.log('[Performance] Rule changes detected, refreshing');
      // Re-render with fresh data
      renderServersList(container, freshServers, freshGroups);
    } else {
      console.log('[Performance] No changes detected, keeping cached UI');
      // Still save snapshot to update timestamp
      await saveUISnapshot(freshServers, freshGroups, cachedSnapshot.serverData);
    }
  } catch (error) {
    console.error('[Performance] Background check failed:', error);
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
      const currentRules = rulesResult.rules || [];
      const cachedRules = cachedServerData[server.id]?.rules || [];

      // Compare rule counts (fast check)
      if (currentRules.length !== cachedRules.length) {
        return true; // Changes detected
      }
    } catch (error) {
      console.error(`Failed to check server ${server.id}:`, error);
      // Continue checking other servers
    }
  }

  return false; // No changes detected
}

// Save UI snapshot for next popup open
async function saveUISnapshot(servers, groups, serverData) {
  try {
    await window.app.sendMessage('setUISnapshot', { servers, groups, serverData });
  } catch (error) {
    console.error('Failed to save UI snapshot:', error);
  }
}

function renderEmptyState(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Servers</h1>
      <button class="btn btn-primary btn-sm" id="add-server-btn">
        Add Server
      </button>
    </div>
    <div class="empty-state">
      <div class="empty-state-icon">🖥️</div>
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

    return `
      <div class="server-card" data-server-id="${server.id}" id="server-${server.id}">
        <div class="server-info">
          <div class="server-name">
            <span class="server-icon-large">🖥️</span>
            ${escapeHtml(server.name)}
          </div>
          <div class="server-version">
            ${cached?.isOnline !== undefined ?
        `<span class="status-indicator ${cached.isOnline ? 'status-online' : 'status-offline'}"></span>
              <span class="badge badge-secondary" style="font-size: 10px;">${escapeHtml(cached.version || 'Unknown')}</span>` :
        `<span class="badge badge-secondary">Loading...</span>`
      }
          </div>
        </div>
        <div class="donut-chart-container">
          ${chartHtml}
        </div>
        <div class="server-actions">
          <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}" title="Edit server">
            ⚙️
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Servers</h1>
        <button class="btn btn-primary btn-sm" id="add-server-btn">
          Add Server
        </button>
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

  // Edit buttons
  document.querySelectorAll('.edit-server-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const serverId = btn.dataset.serverId;
      window.app.navigateTo('server-form', { mode: 'edit', serverId });
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
  // Skip fetching only if we have complete cached data
  const shouldFetch = !cachedServerData || Object.keys(cachedServerData).length === 0;

  if (shouldFetch || true) { // Always fetch to ensure fresh data for charts
    const serverDataMap = {};

    servers.forEach(async (server) => {
      try {
        // Fetch server info and rules in parallel
        const [serverInfo, rulesResult] = await Promise.all([
          window.app.sendMessage('getServerInfo', { serverId: server.id }).catch(() => null),
          window.app.sendMessage('getServerRules', { serverId: server.id })
        ]);

        const rules = rulesResult.rules || [];
        const counts = getRuleCounts(rules);
        const version = serverInfo?.version || 'Unknown';
        const isOnline = serverInfo !== null;

        // Store server data for change detection
        serverDataMap[server.id] = { rules, counts, version, isOnline };

        // Find groups this server belongs to
        const serverGroups = groups.filter(g => g.serverIds && g.serverIds.includes(server.id));
        const groupBadgesHtml = serverGroups.length > 0 ? `
        <div class="server-groups-inline">
          ${serverGroups.map(group => `
            <span class="group-badge-inline" data-group-id="${group.id}" title="Click to edit group: ${escapeHtml(group.name)}">
              📁 ${escapeHtml(group.name)}
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
              <span class="server-icon-large">🖥️</span>
              ${escapeHtml(server.name)}
              ${groupBadgesHtml}
            </div>
            <div class="server-version">
              <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span>
              <span class="badge badge-secondary" style="font-size: 10px;">${escapeHtml(version)}</span>
            </div>
          </div>
          <div class="chart-legend-container">
            <div class="donut-chart-container">
              ${chartHtml}
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
                <span class="legend-text">Inactive</span>
              </div>
            </div>
          </div>
          <div class="server-actions">
            <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}" title="Edit server">
              ⚙️
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

          // Add group badge click handlers
          serverCard.querySelectorAll('.group-badge-inline').forEach(badge => {
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              const groupId = badge.dataset.groupId;
              window.app.navigateTo('group-form', { mode: 'edit', groupId });
            });
          });

          // Save snapshot after last server is done
          if (Object.keys(serverDataMap).length === servers.length) {
            saveUISnapshot(servers, groups, serverDataMap);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch data for ${server.name}:`, error);

        // Update with error state
        const serverCard = document.getElementById(`server-${server.id}`);
        if (serverCard) {
          const errorHtml = `
          <div class="server-info">
            <div class="server-name">
              <span class="server-icon-large">🖥️</span>
              ${escapeHtml(server.name)}
            </div>
            <div class="server-version">
              <span class="status-indicator status-offline"></span>
              <span class="text-xs text-tertiary">Offline</span>
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
              ⚙️
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
    });
  }
}






