// Server Detail View
// Displays server rules with search and color coding

import { escapeHtml, classifyRule, getRuleCounts, showConfirmDialog } from '../utils.js';
import { handleEditRule, handleDeleteRule } from './rule-handlers.js';
import { Logger } from '../utils/logger.js';

export async function renderServerDetail(container, data = {}) {
  const { serverId } = data;
  const startTime = performance.now();
  Logger.info(`[Performance] Server detail view started for ${serverId}`);

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
  const loadingStartTime = performance.now();
  container.innerHTML = `
    <div class="view-header">
      <button class="header-back-btn" id="back-btn">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        <span>Back</span>
      </button>
      <div class="header-action-area"></div>
    </div>
    <div class="view-body">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
  `;
  Logger.debug(`[Performance] Loading skeleton rendered in ${(performance.now() - loadingStartTime).toFixed(2)}ms`);

  // Set up back button immediately
  document.getElementById('back-btn').addEventListener('click', () => {
    window.app.navigateTo('server-list');
  });

  try {
    // Fetch server info and rules
    const getServerStartTime = performance.now();
    const server = await window.app.sendMessage('getServer', { id: serverId });
    Logger.debug(`[Performance] getServer completed in ${(performance.now() - getServerStartTime).toFixed(2)}ms`);

    if (!server) {
      throw new Error('Server not found');
    }

    // Fetch server info (version) and rules in parallel
    let serverInfo = null;
    let rulesResult = null;
    let fromCache = false;
    let warning = null;

    try {
      const fetchStartTime = performance.now();
      Logger.info(`[Performance] Starting parallel fetch for serverInfo and rules...`);

      // Try to get cached version from UI snapshot first
      const snapshot = await window.app.sendMessage('getUISnapshot');
      const cachedVersion = snapshot?.serverData?.[serverId]?.version;

      if (cachedVersion) {
        Logger.info(`[Performance] Using cached version: ${cachedVersion}`);
        serverInfo = { version: cachedVersion };

        // Only fetch rules (skip slow serverInfo API call)
        rulesResult = await window.app.sendMessage('getServerRules', { serverId });
      } else {
        Logger.warn(`[Performance] No cached version, fetching from network...`);
        // No cache - fetch both (fallback to network)
        [serverInfo, rulesResult] = await Promise.all([
          window.app.sendMessage('getServerInfo', { serverId }).catch(() => null),
          window.app.sendMessage('getServerRules', { serverId })
        ]);
      }

      const fetchDuration = performance.now() - fetchStartTime;
      Logger.info(`[Performance] Parallel fetch completed in ${fetchDuration.toFixed(2)}ms`);
      Logger.debug(`[Performance] - serverInfo: ${serverInfo ? 'success' : 'null'}`);
      Logger.debug(`[Performance] - rulesResult fromCache: ${rulesResult.fromCache || false}`);
      Logger.debug(`[Performance] - rules count: ${rulesResult.data?.rules?.length || 0}`);

      fromCache = rulesResult.fromCache || false;
      warning = rulesResult.warning || null;

      if (fromCache) {
        Logger.info(`[Performance] ✅ Rules loaded from CACHE (instant)`);
      } else {
        Logger.warn(`[Performance] ⚠️ Rules loaded from NETWORK (slow) - Duration: ${fetchDuration.toFixed(2)}ms`);
      }
    } catch (error) {
      // If fetch fails, try cache
      Logger.error('[Performance] Failed to fetch rules:', error);
      const cacheStartTime = performance.now();
      const cached = await window.app.sendMessage('getCache', { serverId });
      Logger.debug(`[Performance] Cache fallback took ${(performance.now() - cacheStartTime).toFixed(2)}ms`);

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
    const renderStartTime = performance.now();
    renderServerDetailView(container, server, version, rules, fromCache, warning, serverId);
    const renderDuration = performance.now() - renderStartTime;
    Logger.debug(`[Performance] View rendered in ${renderDuration.toFixed(2)}ms`);

    const totalDuration = performance.now() - startTime;
    Logger.info(`[Performance] ⏱️ TOTAL server detail load: ${totalDuration.toFixed(2)}ms`);

    if (totalDuration > 500) {
      Logger.warn(`[Performance] ⚠️ SLOW LOAD detected (${totalDuration.toFixed(2)}ms > 500ms)`);
    }

  } catch (error) {
    Logger.error('Failed to load server detail:', error);
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
        <button class="header-back-btn" id="back-btn">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          <span>Back</span>
        </button>
        <div class="view-title">${escapeHtml(server.name)}</div>
        <div class="header-action-area">
          <!-- Awesome Refresh Button -->
          <button class="header-icon-btn btn-refresh" id="refresh-btn" title="Refresh rules">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
          <!-- Awesome Delete Button -->
          <button class="header-icon-btn btn-delete" id="delete-server-btn" title="Delete server">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
    // Pass full rules array so we can find correct indices
    document.getElementById('rules-list').innerHTML = renderRulesList(filtered, allRules);

    // Re-attach event listeners after re-rendering
    attachRuleEventListeners(serverId, allRules);
  });

  // Attach initial event listeners
  attachRuleEventListeners(serverId, allRules);
}

// Separate function for event listeners to avoid duplication
function attachRuleEventListeners(serverId, allRules) {
  // Rule edit/delete event delegation
  const rulesList = document.getElementById('rules-list');

  // Remove old listeners by cloning
  const newRulesList = rulesList.cloneNode(true);
  rulesList.parentNode.replaceChild(newRulesList, rulesList);

  newRulesList.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('.rule-action-btn');
    if (!actionBtn) return;

    const ruleItem = actionBtn.closest('.rule-item');
    const ruleIndex = parseInt(ruleItem.dataset.ruleIndex, 10);
    const action = actionBtn.dataset.action;

    // Validate index
    if (isNaN(ruleIndex) || ruleIndex < 0 || ruleIndex >= allRules.length) {
      window.app.showToast('Rule not found', 'error');
      return;
    }

    if (action === 'edit') {
      handleEditRule(ruleItem, serverId, allRules, ruleIndex);
    } else if (action === 'delete') {
      handleDeleteRule(ruleItem, serverId, allRules, ruleIndex);
    }
  });
}

function renderRulesList(rules, allRules = null) {
  if (!rules || rules.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-text">No rules configured</div>
      </div>
    `;
  }

  // If allRules is not provided, use rules as the source
  const sourceRules = allRules || rules;

  return rules.map((rule, index) => {
    const type = classifyRule(rule);
    const colorClass = type === 'allow' ? 'rule-allow' :
      type === 'disabled' ? 'rule-disabled' :
        'rule-block';

    // Find the actual index in the full rules array
    const actualIndex = sourceRules.indexOf(rule);

    // Store index instead of text to avoid HTML escaping issues
    return `
      <div class="rule-item ${colorClass}" data-rule-index="${actualIndex}" style="position: relative;">
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
    document.getElementById('rules-list').innerHTML = renderRulesList(rules, rules);

    // Re-attach event listeners
    attachRuleEventListeners(serverId, rules);

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

