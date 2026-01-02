// Server Form View
// Add or edit server configuration

import { escapeHtml, showConfirmDialog } from '../utils.js';

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
      <form id="server-form" data-mode="${isEdit ? 'edit' : 'add'}" ${isEdit && serverId ? `data-server-id="${serverId}"` : ''}>
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
        
        ${mode === 'add' ? `
        <!-- Connection Security Info - Only shown when adding new server -->
        <div class="alert-box">
          <div class="alert-box-title">ℹ️ Connection Security for Home Networks</div>
          <div class="alert-box-content">
            <strong class="alert-box-strong">HTTP is fine for local networks</strong> (192.168.x.x, 10.x.x.x) when AdGuard Home runs on your private network.<br><br>
            <strong class="alert-box-strong">Use self-signed certificates?</strong> Enable "Bypass SSL Validation" below for HTTPS connections with self-signed certs.
          </div>
        </div>
        ` : ''}
        
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
        
        <div class="form-group">
          <label class="form-label toggle-label">
            <input
              type="checkbox"
              id="bypass-ssl"
              class="toggle-input"
              ${server && server.bypassSSL ? 'checked' : ''}
            />
            <span class="toggle-slider"></span>
            <span class="toggle-text">Bypass SSL Validation</span>
          </label>
          <div class="text-xs text-tertiary mt-1">Enable for self-signed certificates</div>
        </div>
        
        <div id="form-errors" class="form-error hidden"></div>
        
        <div>
          <div class="flex gap-2">
            <button type="button" class="btn btn-secondary flex-1" id="test-connection-btn">
              Test Connection
            </button>
            <button type="submit" class="btn btn-primary flex-1">
              ${isEdit ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
          
          ${isEdit ? `
            <div class="mt-3">
              <button type="button" class="btn btn-danger btn-block" id="delete-server-btn">
                Delete Server
              </button>
            </div>
          ` : ''}
        </div>
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
  let password = document.getElementById('server-password').value;

  // Get serverId from form data if editing
  const isEdit = document.querySelector('[data-mode="edit"]') !== null;
  const serverId = document.querySelector('[data-server-id]')?.dataset.serverId;

  // If editing and password not provided, fetch existing password
  if (isEdit && !password && serverId) {
    try {
      const existingServer = await window.app.sendMessage('getServer', { id: serverId });
      password = existingServer.password;
    } catch (error) {
      window.app.showToast('Please enter password to test connection', 'warning');
      return;
    }
  }

  // Validation
  if (!host || !username || !password) {
    window.app.showToast('Please fill in all required fields', 'warning');
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
  const bypassSSL = document.getElementById('bypass-ssl').checked;

  // Clear previous errors
  const errorsDiv = document.getElementById('form-errors');
  errorsDiv.classList.add('hidden');
  errorsDiv.textContent = '';

  // Build server object
  const server = {
    name,
    host,
    username,
    bypassSSL
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
  const confirmed = await showConfirmDialog(
    'Delete Server',
    'Are you sure you want to delete this server?',
    'This action cannot be undone.'
  );

  if (!confirmed) {
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

// escapeHtml removed - now imported from utils.js
