// Server Detail View
// Displays server rules with search and color coding

import { escapeHtml, classifyRule, getRuleCounts, showConfirmDialog } from '../utils.js';
import { handleEditRule, handleDeleteRule } from './rule-handlers.js';

export async function renderServerDetail(container, data = {}) {
  const { serverId } = data;

  if (!serverId) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Invalid Server</div>
        <div class="empty-state-text">No server ID provided.</div>
        <button class="btn btn-primary" onclick="window.app.navigateTo('server-list')">
          Back to Servers
        </button>
      </div>
    `;
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost btn-sm" id="back-btn">
        ← Back
      </button>
      <div class="flex-1"></div>
    </div>
    <div class="view-body">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
  `;

  // Set up back button immediately
  document.getElementById('back-btn').addEventListener('click', () => {
    window.app.navigateTo('server-list');
  });

  try {
    // Fetch server info and rules
    const server = await window.app.sendMessage('getServer', { id: serverId });

    if (!server) {
      throw new Error('Server not found');
    }

    // Fetch server info (version) and rules in parallel
    let serverInfo = null;
    let rulesResult = null;
    let fromCache = false;
    let warning = null;

    try {
      [serverInfo, rulesResult] = await Promise.all([
        window.app.sendMessage('getServerInfo', { serverId }).catch(() => null),
        window.app.sendMessage('getServerRules', { serverId })
      ]);

      fromCache = rulesResult.fromCache || false;
      warning = rulesResult.warning || null;
    } catch (error) {
      // If fetch fails, try cache
      console.error('Failed to fetch rules:', error);
      const cached = await window.app.sendMessage('getCache', { serverId });

      if (cached && cached.rules) {
        rulesResult = { success: true, data: cached };
        fromCache = true;
        warning = `Network fetch failed: ${error.message}`;
      } else {
        throw new Error('Failed to load rules and no cache available');
      }
    }

    const rules = rulesResult.data?.rules || [];
    const version = serverInfo?.version || 'Unknown';

    // Render the view
    renderServerDetailView(container, server, version, rules, fromCache, warning, serverId);

  } catch (error) {
    console.error('Failed to load server detail:', error);
    window.app.showToast('Failed to load server: ' + error.message, 'error');

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Error Loading Server</div>
        <div class="empty-state-text">${error.message}</div>
        <button class="btn btn-primary" onclick="window.app.navigateTo('server-list')">
          Back to Servers
        </button>
      </div>
    `;
  }
}

function renderServerDetailView(container, server, version, rules, fromCache, warning, serverId) {
  // Calculate rule counts
  const counts = getRuleCounts(rules);

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <button class="btn btn-ghost btn-sm" id="back-btn">
          ← Back
        </button>
        <div class="flex-1 text-center">
          <div class="view-title">${escapeHtml(server.name)}</div>
          <div class="text-xs text-tertiary">v${escapeHtml(version)}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="refresh-btn" title="Refresh rules">
            ↻
          </button>
          <button class="btn btn-danger btn-sm" id="delete-server-btn" title="Delete server">
            ✕
          </button>
        </div>
      </div>

      <div class="view-body">
        ${warning ? `
          <div class="warning-banner">
            ⚠️ ${escapeHtml(warning)}
          </div>
        ` : ''}

        <div class="rule-counts-card">
          <span class="badge badge-success">${counts.allow} Allow</span>
          <span class="badge badge-danger">${counts.block} Block</span>
          <span class="badge badge-warning">${counts.disabled} Disabled</span>
          <span class="badge badge-info">${counts.total} Total</span>
        </div>

        <div class="search-card">
          <input
            type="text"
            id="rule-search"
            class="form-input"
            placeholder="🔍 Search rules..."
          />
        </div>

        <div id="rules-list" class="rules-list">
          ${renderRulesList(rules)}
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('back-btn').addEventListener('click', () => {
    window.app.navigateTo('server-list');
  });

  let allRules = rules;

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    const updatedRules = await handleRefresh(serverId);
    if (updatedRules) {
      allRules = updatedRules;
    }
  });

  document.getElementById('delete-server-btn').addEventListener('click', async () => {
    await handleDeleteServer(serverId);
  });

  // Search functionality
  document.getElementById('rule-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allRules.filter(rule =>
      rule.toLowerCase().includes(searchTerm)
    );
    document.getElementById('rules-list').innerHTML = renderRulesList(filtered);
  });

  // Rule edit/delete event delegation
  const rulesList = document.getElementById('rules-list');
  rulesList.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('.rule-action-btn');
    if (!actionBtn) return;

    const ruleItem = actionBtn.closest('.rule-item');
    const ruleIndex = parseInt(ruleItem.dataset.ruleIndex);
    const action = actionBtn.dataset.action;

    if (action === 'edit') {
      handleEditRule(ruleItem, serverId, allRules, ruleIndex);
    } else if (action === 'delete') {
      handleDeleteRule(ruleItem, serverId, allRules, ruleIndex);
    }
  });
}

function renderRulesList(rules) {
  if (!rules || rules.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-text">No rules configured</div>
      </div>
    `;
  }

  return rules.map((rule, index) => {
    const type = classifyRule(rule);
    const colorClass = type === 'allow' ? 'rule-allow' :
      type === 'disabled' ? 'rule-disabled' :
        'rule-block';

    return `
      <div class="rule-item ${colorClass}" data-rule-index="${index}" style="position: relative;">
        <span class="rule-indicator"></span>
        <span class="rule-text">${escapeHtml(rule)}</span>
        <div class="rule-actions">
          <button class="rule-action-btn" data-action="edit" title="Edit rule">✏️</button>
          <button class="rule-action-btn" data-action="delete" title="Delete rule">⛔</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleRefresh(serverId) {
  try {
    window.app.showLoading();

    // Force refresh (ignore cache)
    const rulesResult = await window.app.sendMessage('refreshServerRules', { serverId, force: true });

    const rules = rulesResult.data?.rules || [];
    const counts = getRuleCounts(rules);

    // Update rule counts
    document.querySelector('.badge-success').textContent = `${counts.allow} Allow`;
    document.querySelector('.badge-danger').textContent = `${counts.block} Block`;
    document.querySelector('.badge-warning').textContent = `${counts.disabled} Disabled`;
    document.querySelector('.badge-info').textContent = `${counts.total} Total`;

    // Update rules list
    document.getElementById('rules-list').innerHTML = renderRulesList(rules);

    // Clear search if any
    const searchInput = document.getElementById('rule-search');
    if (searchInput) {
      searchInput.value = '';
    }

    window.app.hideLoading();
    window.app.showToast('Rules refreshed successfully', 'success');

    return rules;

  } catch (error) {
    window.app.hideLoading();
    window.app.showToast('Refresh failed: ' + error.message, 'error');
    return null;
  }
}

async function handleDeleteServer(serverId) {
  // Get server info for confirmation
  const server = await window.app.sendMessage('getServer', { id: serverId });

  if (!server) {
    window.app.showToast('Server not found', 'error');
    return;
  }

  // Confirm deletion
  const confirmed = await showConfirmDialog(
    'Delete Server',
    `Are you sure you want to delete "${server.name}"?`,
    'This action cannot be undone.'
  );

  if (!confirmed) {
    return;
  }

  try {
    window.app.showLoading();

    // Delete the server
    await window.app.sendMessage('deleteServer', { id: serverId });

    window.app.hideLoading();
    window.app.showToast('Server deleted successfully', 'success');

    // Navigate back to server list
    window.app.navigateTo('server-list');

  } catch (error) {
    window.app.hideLoading();
    window.app.showToast('Delete failed: ' + error.message, 'error');
  }
}

// showConfirmDialog removed - now imported from utils.js

