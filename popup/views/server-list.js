// Server List View
// Displays list of configured servers

export async function renderServerList(container) {
    // Show loading skeleton
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

    // Set up event listeners
    document.getElementById('add-server-btn').addEventListener('click', () => {
        window.app.navigateTo('server-form', { mode: 'add' });
    });

    try {
        // Fetch servers
        const servers = await window.app.sendMessage('getServers');

        // Render servers
        if (servers.length === 0) {
            renderEmptyState(container);
        } else {
            renderServersList(container, servers);
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

    // Event listeners
    document.getElementById('add-server-btn').addEventListener('click', () => {
        navigateTo('server-form', { mode: 'add' });
    });

    document.getElementById('add-first-server-btn').addEventListener('click', () => {
        window.app.navigateTo('server-form', { mode: 'add' });
    });
}

function renderServersList(container, servers) {
    const serverItems = servers.map(server => `
    <div class="list-item" data-server-id="${server.id}">
      <div class="list-item-content">
        <div class="list-item-title">${escapeHtml(server.name)}</div>
        <div class="list-item-subtitle">${escapeHtml(server.host)}</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-ghost edit-server-btn" data-server-id="${server.id}">
          Edit
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
        ${serverItems}
      </div>
    </div>
  `;

    // Event listeners
    document.getElementById('add-server-btn').addEventListener('click', () => {
        navigateTo('server-form', { mode: 'add' });
    });

    // Edit buttons
    document.querySelectorAll('.edit-server-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const serverId = btn.dataset.serverId;
            window.app.navigateTo('server-form', { mode: 'edit', serverId });
        });
    });

    // Click on list item (future: navigate to server details)
    document.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => {
            const serverId = item.dataset.serverId;
            window.app.showToast('Server details view coming in future phases', 'info');
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
