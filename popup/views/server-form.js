// Server Form View
// Add or edit server configuration

export async function renderServerForm(container, data = {}) {
    const { mode = 'add', serverId = null } = data;
    const isEdit = mode === 'edit';

    let server = null;

    // Load server data if editing
    if (isEdit && serverId) {
        try {
            window.app.showLoading();
            server = await window.app.sendMessage('getServer', { id: serverId });
            window.app.hideLoading();

            if (!server) {
                window.app.showToast('Server not found', 'error');
                window.app.navigateTo('server-list');
                return;
            }
        } catch (error) {
            window.app.hideLoading();
            window.app.showToast('Failed to load server: ' + error.message, 'error');
            window.app.navigateTo('server-list');
            return;
        }
    }

    // Render form
    container.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost btn-sm" id="back-btn">
        ← Back
      </button>
      <h1 class="view-title">${isEdit ? 'Edit Server' : 'Add Server'}</h1>
      <div style="width: 60px;"></div>
    </div>
    <div class="view-body">
      <form id="server-form">
        <div class="form-group">
          <label class="form-label" for="server-name">Server Name</label>
          <input
            type="text"
            id="server-name"
            class="form-input"
            placeholder="My AdGuard Home"
            value="${server ? escapeHtml(server.name) : ''}"
            required
          />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="server-host">Server URL</label>
          <input
            type="url"
            id="server-host"
            class="form-input"
            placeholder="https://192.168.1.1"
            value="${server ? escapeHtml(server.host) : ''}"
            required
          />
          <div class="text-xs text-tertiary mt-1">
            Include protocol (http:// or https://)
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="server-username">Username</label>
          <input
            type="text"
            id="server-username"
            class="form-input"
            placeholder="admin"
            value="${server ? escapeHtml(server.username) : ''}"
            required
            autocomplete="username"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="server-password">Password</label>
          <input
            type="password"
            id="server-password"
            class="form-input"
            placeholder="${isEdit ? '(unchanged)' : 'Enter password'}"
            ${isEdit ? '' : 'required'}
            autocomplete="current-password"
          />
          ${isEdit ? '<div class="text-xs text-tertiary mt-1">Leave blank to keep existing password</div>' : ''}
        </div>
        
        <div id="form-errors" class="form-error hidden"></div>
        
        <div class="flex gap-2 mt-6">
          <button type="button" class="btn btn-secondary" id="test-connection-btn">
            Test Connection
          </button>
          <button type="submit" class="btn btn-primary flex-1">
            ${isEdit ? 'Save Changes' : 'Add Server'}
          </button>
        </div>
        
        ${isEdit ? `
          <div class="mt-4">
            <button type="button" class="btn btn-danger btn-block" id="delete-server-btn">
              Delete Server
            </button>
          </div>
        ` : ''}
      </form>
    </div>
  `;

    // Event listeners
    document.getElementById('back-btn').addEventListener('click', () => {
        window.app.navigateTo('server-list');
    });

    document.getElementById('test-connection-btn').addEventListener('click', handleTestConnection);
    document.getElementById('server-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSaveServer(isEdit, serverId);
    });

    if (isEdit) {
        document.getElementById('delete-server-btn').addEventListener('click', () => {
            handleDeleteServer(serverId);
        });
    }
}

async function handleTestConnection() {
    const host = document.getElementById('server-host').value.trim();
    const username = document.getElementById('server-username').value.trim();
    const password = document.getElementById('server-password').value;

    // Validation
    if (!host || !username || !password) {
        window.app.showToast('Please fill in all fields to test connection', 'warning');
        return;
    }

    try {
        window.app.showLoading();
        const result = await window.app.sendMessage('testConnection', { host, username, password });
        window.app.hideLoading();

        if (result.success) {
            window.app.showToast('Connection successful!', 'success');
        } else {
            window.app.showToast('Connection failed: ' + result.error, 'error');
        }
    } catch (error) {
        window.app.hideLoading();
        window.app.showToast('Connection test failed: ' + error.message, 'error');
    }
}

async function handleSaveServer(isEdit, serverId) {
    const name = document.getElementById('server-name').value.trim();
    const host = document.getElementById('server-host').value.trim();
    const username = document.getElementById('server-username').value.trim();
    const password = document.getElementById('server-password').value;

    // Clear previous errors
    const errorsDiv = document.getElementById('form-errors');
    errorsDiv.classList.add('hidden');
    errorsDiv.textContent = '';

    // Build server object
    const server = {
        name,
        host,
        username
    };

    if (isEdit) {
        server.id = serverId;
        // Only update password if provided
        if (password) {
            server.password = password;
        } else {
            // Fetch existing password
            try {
                const existingServer = await window.app.sendMessage('getServer', { id: serverId });
                server.password = existingServer.password;
            } catch (error) {
                window.app.showToast('Failed to load existing server data', 'error');
                return;
            }
        }
    } else {
        // New server - password required
        if (!password) {
            errorsDiv.textContent = 'Password is required';
            errorsDiv.classList.remove('hidden');
            return;
        }
        server.password = password;
    }

    try {
        window.app.showLoading();
        await window.app.sendMessage('saveServer', { server });
        window.app.hideLoading();

        window.app.showToast(isEdit ? 'Server updated successfully' : 'Server added successfully', 'success');
        window.app.navigateTo('server-list');
    } catch (error) {
        window.app.hideLoading();
        errorsDiv.textContent = error.message;
        errorsDiv.classList.remove('hidden');
        window.app.showToast('Failed to save server: ' + error.message, 'error');
    }
}

async function handleDeleteServer(serverId) {
    if (!confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
        return;
    }

    try {
        window.app.showLoading();
        await window.app.sendMessage('deleteServer', { id: serverId });
        window.app.hideLoading();

        window.app.showToast('Server deleted successfully', 'success');
        window.app.navigateTo('server-list');
    } catch (error) {
        window.app.hideLoading();
        window.app.showToast('Failed to delete server: ' + error.message, 'error');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
