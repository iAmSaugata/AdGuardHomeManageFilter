// Server List View - Professional Design with Donut Charts
// Displays list of configured servers with visual rule statistics

import { escapeHtml, classifyRule, getRuleCounts } from '../utils.js';

/**
 * Create a donut chart using conic-gradient
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

  // Calculate percentages
  const allowPercent = (counts.allow / total) * 360;
  const blockPercent = (counts.block / total) * 360;
  const disabledPercent = (counts.disabled / total) * 360;

  // Create conic gradient
  const gradientStops = [];
  let currentDeg = 0;

  if (counts.allow > 0) {
    gradientStops.push(`var(--color-accent) ${currentDeg}deg ${currentDeg + allowPercent}deg`);
    currentDeg += allowPercent;
  }

  if (counts.block > 0) {
    gradientStops.push(`var(--color-danger) ${currentDeg}deg ${currentDeg + blockPercent}deg`);
    currentDeg += blockPercent;
  }

  if (counts.disabled > 0) {
    gradientStops.push(`var(--color-warning) ${currentDeg}deg ${currentDeg + disabledPercent}deg`);
  }

  const gradient = `conic-gradient(${gradientStops.join(', ')})`;

  const tooltipText = `Total: ${total}\nAllow: ${counts.allow}\nBlock: ${counts.block}\nInactive: ${counts.disabled}`;

  return `
    <div class="donut-chart" style="background: ${gradient};" title="${tooltipText}">
      <svg width="45" height="45" style="position: absolute; top: 0; left: 0;">
        <circle cx="22.5" cy="22.5" r="16" fill="var(--color-bg-secondary)" />
      </svg>
    </div>
    <div class="donut-center" title="Total Rules: ${total}">
      <div class="donut-total">${total}</div>
    </div>
  `;
}

export async function renderServerList(container) {
  // Show loading skeleton FIRST
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
    // Fetch servers and groups
    const [servers, groups] = await Promise.all([
      window.app.sendMessage('getServers'),
      window.app.sendMessage('getGroups')
    ]);

    // Render servers
    if (servers.length === 0) {
      renderEmptyState(container);
    } else {
      renderServersList(container, servers, groups);
    }
  } catch (error) {
    console.error('Failed to load servers:', error);
    window.app.showToast('Failed to load servers: ' + error.message, 'error');
    renderEmptyState(container);
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

async function renderServersList(container, servers, groups) {
  // Render server cards immediately with loading charts
  const initialServerItems = servers.map(server => `
      <div class="server-card" data-server-id="${server.id}" id="server-${server.id}">
        <div class="server-info">
          <div class="server-name">
            <span class="server-icon-large">🖥️</span>
            ${escapeHtml(server.name)}
          </div>
          <div class="server-version">
            <span class="badge badge-secondary">Loading...</span>
          </div>
        </div>
        <div class="donut-chart-container">
          <div class="chart-loading">
            <span class="chart-loading-text">Loading</span>
          </div>
        </div>
        <div class="server-actions">
          <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}" title="Edit server">
            ⚙️
          </button>
        </div>
      </div>
    `).join('');

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

  // Fetch data for each server progressively
  servers.forEach(async (server) => {
    try {
      // Fetch server info and rules in parallel
      const [serverInfo, rulesResult] = await Promise.all([
        window.app.sendMessage('getServerInfo', { serverId: server.id }).catch(() => null),
        window.app.sendMessage('getServerRules', { serverId: server.id })
      ]);

      const rules = rulesResult.data?.rules || [];
      const counts = getRuleCounts(rules);
      const version = serverInfo?.version || 'Unknown';
      const isOnline = serverInfo !== null;

      //Find groups this server belongs to
      const serverGroups = groups.filter(g => g.serverIds && g.serverIds.includes(server.id));
      const groupBadgesHtml = serverGroups.length > 0 ? `
        <div class="server-groups" style="margin-top: 4px;">
          ${serverGroups.map(group => `
            <span class="group-badge" data-group-id="${group.id}" title="Click to edit group" style="font-size: 11px; padding: 2px 6px;">
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
            </div>
            <div class="server-version">
              <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span>
              <span class="badge badge-secondary" style="font-size: 10px;">${escapeHtml(version)}</span>
            </div>
            ${groupBadgesHtml}
          </div>
          <div class="chart-legend-container">
            <div class="donut-chart-container">
              ${chartHtml}
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <span class="legend-dot allow"></span>
                <span class="legend-text">Allow</span>
                <span class="legend-value">${counts.allow}</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot block"></span>
                <span class="legend-text">Block</span>
                <span class="legend-value">${counts.block}</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot inactive"></span>
                <span class="legend-text">Inactive</span>
                <span class="legend-value">${counts.disabled}</span>
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
        serverCard.querySelectorAll('.group-badge').forEach(badge => {
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const groupId = badge.dataset.groupId;
            window.app.navigateTo('group-form', { mode: 'edit', groupId });
          });
        });
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

