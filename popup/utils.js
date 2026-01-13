// Shared Utility Functions for Popup Views
// Eliminates code duplication across view files

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Classify a filtering rule by type using STRICT golden rule
 * @param {string} rule - AdGuard filtering rule
 * @returns {string} Rule type: 'allow' | 'block' | 'disabled' | 'unknown'
 * 
 * GOLDEN RULE:
 * - "@@" at start = Allow (green)
 * - "||" at start = Block (red)
 * - Everything else = Disabled/Inactive (gray)
 */
export function classifyRule(rule) {
    if (typeof rule !== 'string') return 'unknown';

    const trimmed = rule.trim();

    // Empty lines are disabled
    if (!trimmed) return 'disabled';

    // GOLDEN RULE: Apply strict matching
    if (trimmed.startsWith('@@')) return 'allow';
    if (trimmed.startsWith('||')) return 'block';

    // Everything else is disabled/inactive
    // This includes: comments (!, #), single pipe (|), domain-only, etc.
    return 'disabled';
}

/**
 * Get rule counts by type
 * @param {string[]} rules - Array of filtering rules
 * @returns {Object} Counts object with allow, block, disabled, and total
 */
export function getRuleCounts(rules) {
    if (!Array.isArray(rules)) {
        return { allow: 0, block: 0, disabled: 0, total: 0 };
    }

    let allow = 0;
    let block = 0;
    let disabled = 0;

    for (const rule of rules) {
        const type = classifyRule(rule);
        if (type === 'allow') {
            allow++;
        } else if (type === 'disabled') {
            disabled++;
        } else {
            // 'block' or 'unknown' (treat unknown as block)
            block++;
        }
    }

    return {
        allow,
        block,
        disabled,
        total: rules.length
    };
}

/**
 * Show custom confirmation dialog that stays within popup bounds
 * @param {string} title - Dialog title
 * @param {string} message - Main message
 * @param {string} subtitle - Optional subtitle
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
export function showConfirmDialog(title, message, subtitle = '') {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="confirm-header">
                <h3 class="confirm-title">${escapeHtml(title)}</h3>
            </div>
            <div class="confirm-body">
                <p class="confirm-message">${escapeHtml(message)}</p>
                ${subtitle ? `<p class="confirm-subtitle">${escapeHtml(subtitle)}</p>` : ''}
            </div>
            <div class="confirm-actions">
                <button class="btn btn-secondary btn-block" id="confirm-cancel">Cancel</button>
                <button class="btn btn-danger btn-block" id="confirm-ok">Delete</button>
            </div>
        `;

        overlay.appendChild(dialog);

        // Append to app container instead of body to respect popup bounds
        const appContainer = document.getElementById('app') || document.querySelector('.app-container');
        if (appContainer) {
            appContainer.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }

        // Event listeners
        const cancelBtn = overlay.querySelector('#confirm-cancel');
        const okBtn = overlay.querySelector('#confirm-ok');

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        okBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

/**
 * Format large numbers with K/M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted string (e.g., "1.2K", "14M")
 */
export function formatCount(num) {
    if (!num) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
}

// ============================================================================
// DEDUPLICATION UTILITIES FOR SYNC FEATURES
// ============================================================================

/**
 * Deduplicate DNS blocklists (filter URLs)
 * Merge strategy:
 * - Dedupe by URL (exact match)
 * - enabled: true if ANY server has it enabled
 * - rules_count: keep highest count
 * - last_updated: keep most recent
 * 
 * @param {Array} blocklists - Array of filter objects from multiple servers
 * @returns {Array} Deduplicated array of filters
 */
export function dedupBlocklists(blocklists) {
    if (!Array.isArray(blocklists) || blocklists.length === 0) {
        return [];
    }

    const map = new Map();

    for (const filter of blocklists) {
        if (!filter || !filter.url) continue;

        const key = filter.url.trim();

        if (!map.has(key)) {
            map.set(key, { ...filter });
        } else {
            const existing = map.get(key);

            // Merge: enabled if ANY server has it enabled
            existing.enabled = existing.enabled || filter.enabled;

            // Keep highest rules count
            if (filter.rules_count > (existing.rules_count || 0)) {
                existing.rules_count = filter.rules_count;
            }

            // Keep most recent update
            if (filter.last_updated && (!existing.last_updated ||
                new Date(filter.last_updated) > new Date(existing.last_updated))) {
                existing.last_updated = filter.last_updated;
            }

            // Prefer non-empty name
            if (!existing.name && filter.name) {
                existing.name = filter.name;
            }
        }
    }

    return Array.from(map.values());
}

/**
 * Deduplicate DNS rewrites
 * Merge strategy:
 * - Dedupe by domain (exact match, case-insensitive)
 * - For conflicts (same domain, different answer): first-wins
 * - Log warnings for conflicts
 * 
 * @param {Array} rewrites - Array of rewrite objects {domain, answer}
 * @returns {Array} Deduplicated array of rewrites
 */
export function dedupRewrites(rewrites) {
    if (!Array.isArray(rewrites) || rewrites.length === 0) {
        return [];
    }

    const map = new Map();
    const conflicts = [];

    for (const rewrite of rewrites) {
        if (!rewrite || !rewrite.domain) continue;

        const key = rewrite.domain.toLowerCase().trim();

        if (!map.has(key)) {
            map.set(key, { ...rewrite });
        } else {
            const existing = map.get(key);

            // Check for conflict (same domain, different answer)
            if (existing.answer !== rewrite.answer) {
                conflicts.push({
                    domain: rewrite.domain,
                    existingAnswer: existing.answer,
                    conflictingAnswer: rewrite.answer
                });
            }
            // First-wins: keep existing, ignore new
        }
    }

    // Log conflicts if any (debug level)
    if (conflicts.length > 0) {
        console.debug('[Dedup] DNS Rewrite conflicts detected (first-wins applied):', conflicts);
    }

    return Array.from(map.values());
}

/**
 * Deduplicate Home Clients
 * Merge strategy:
 * - Dedupe by name (exact match, case-sensitive)
 * - Merge ids arrays (union of all IPs/MACs)
 * - Merge settings: most restrictive wins for safety
 * 
 * @param {Array} clients - Array of client objects
 * @returns {Array} Deduplicated array of clients
 */
export function dedupClients(clients) {
    if (!Array.isArray(clients) || clients.length === 0) {
        return [];
    }

    const map = new Map();

    for (const client of clients) {
        if (!client || !client.name) continue;

        const key = client.name.trim();

        if (!map.has(key)) {
            map.set(key, {
                ...client,
                ids: Array.isArray(client.ids) ? [...client.ids] : []
            });
        } else {
            const existing = map.get(key);

            // Merge IDs (union)
            if (Array.isArray(client.ids)) {
                const idsSet = new Set([...existing.ids, ...client.ids]);
                existing.ids = Array.from(idsSet);
            }

            // Merge settings: most restrictive wins (for safety)
            // If ANY server has filtering enabled, enable it
            if (client.filtering_enabled) {
                existing.filtering_enabled = true;
            }

            if (client.parental_enabled) {
                existing.parental_enabled = true;
            }

            if (client.safebrowsing_enabled) {
                existing.safebrowsing_enabled = true;
            }

            // Merge safesearch (if any server has it enabled, enable it)
            if (client.safesearch?.enabled) {
                existing.safesearch = existing.safesearch || {};
                existing.safesearch.enabled = true;
            }

            // Merge blocked services (union)
            if (client.blocked_services?.ids && Array.isArray(client.blocked_services.ids)) {
                existing.blocked_services = existing.blocked_services || { ids: [] };
                const servicesSet = new Set([
                    ...(existing.blocked_services.ids || []),
                    ...client.blocked_services.ids
                ]);
                existing.blocked_services.ids = Array.from(servicesSet);
            }

            // Merge tags (union)
            if (client.tags && Array.isArray(client.tags)) {
                const tagsSet = new Set([
                    ...(existing.tags || []),
                    ...client.tags
                ]);
                existing.tags = Array.from(tagsSet);
            }
        }
    }

    return Array.from(map.values());
}

/**
 * Normalize a blocklist filter object
 * Ensures consistent structure for comparison
 * 
 * @param {Object} filter - Filter object
 * @returns {Object} Normalized filter
 */
export function normalizeBlocklist(filter) {
    if (!filter || !filter.url) return null;

    return {
        url: filter.url.trim(),
        name: filter.name || '',
        enabled: Boolean(filter.enabled),
        rules_count: filter.rules_count || 0,
        last_updated: filter.last_updated || null
    };
}

/**
 * Normalize a DNS rewrite object
 * Ensures consistent structure for comparison
 * 
 * @param {Object} rewrite - Rewrite object
 * @returns {Object} Normalized rewrite
 */
export function normalizeRewrite(rewrite) {
    if (!rewrite || !rewrite.domain) return null;

    return {
        domain: rewrite.domain.trim(),
        answer: rewrite.answer.trim()
    };
}

/**
 * Normalize a home client object
 * Ensures consistent structure for comparison
 * 
 * @param {Object} client - Client object
 * @returns {Object} Normalized client
 */
export function normalizeClient(client) {
    if (!client || !client.name) return null;

    return {
        name: client.name.trim(),
        ids: Array.isArray(client.ids) ? client.ids.map(id => id.trim()) : [],
        use_global_settings: Boolean(client.use_global_settings),
        filtering_enabled: Boolean(client.filtering_enabled),
        parental_enabled: Boolean(client.parental_enabled),
        safebrowsing_enabled: Boolean(client.safebrowsing_enabled),
        safesearch: client.safesearch || { enabled: false },
        blocked_services: client.blocked_services || { ids: [] },
        upstreams: client.upstreams || [],
        tags: Array.isArray(client.tags) ? client.tags : []
    };
}
