// Server List View
// Displays list of configured servers

import { escapeHtml, classifyRule, getRuleCounts } from '../utils.js';

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
  // Render server cards immediately with "Refreshing..." status
  const initialServerItems = servers.map(server => `
      <div class="list-item server-item" data-server-id="${server.id}" id="server-${server.id}">
        <div class="list-item-content">
          <div class="list-item-title">
            <span class="server-icon">🖥️</span>
            ${escapeHtml(server.name)}
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <span class="badge badge-info">Refreshing...</span>
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

  // Click on server item to view details
  document.querySelectorAll('.server-item').forEach(item => {
    item.addEventListener('click', () => {
      const serverId = item.dataset.serverId;
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

      // Find groups this server belongs to
      const serverGroups = groups.filter(g => g.serverIds && g.serverIds.includes(server.id));
      const groupBadgesHtml = serverGroups.length > 0 ? `
        <div class="server-groups">
          ${serverGroups.map(group => `
            <span class="group-badge" data-group-id="${group.id}" title="Click to edit group">
              📁 ${escapeHtml(group.name)}
            </span>
          `).join('')}
        </div>
      ` : '';

      // Update the server card
      const serverCard = document.getElementById(`server-${server.id}`);
      if (serverCard) {
        const statusHtml = `
                  <div class="list-item-content">
                    <div class="list-item-title">
                      <span class="server-icon">🖥️</span>
                      ${escapeHtml(server.name)}
                    </div>
                    <div class="server-version">
                      <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span>
                      <span class="badge badge-secondary">${escapeHtml(version)}</span>
                    </div>
                    ${groupBadgesHtml}
                  </div>
                  <div class="flex gap-2 items-center">
                    <span class="badge badge-info">${counts.allow + counts.block + counts.disabled}</span>
                    <span class="badge badge-success">${counts.allow}</span>
                    <span class="badge badge-danger">${counts.block}</span>
                    <span class="badge badge-warning">${counts.disabled}</span>
                    <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}" title="Edit server">
                      ⚙️
                    </button>
                  </div>
                `;
        serverCard.innerHTML = statusHtml;

        // Re-attach event listeners
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

      // Update with offline status
      const serverCard = document.getElementById(`server-${server.id}`);
      if (serverCard) {
        const errorHtml = `
                  <div class="list-item-content">
                    <div class="list-item-title">
                      <span class="server-icon">🖥️</span>
                      ${escapeHtml(server.name)}
                    </div>
                    <div class="server-version">
                      <span class="status-indicator status-offline"></span>
                      <span class="text-xs text-tertiary">Offline</span>
                    </div>
                  </div>
                  <div class="flex gap-2 items-center">
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
