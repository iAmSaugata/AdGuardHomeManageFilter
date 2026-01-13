// Helper Utilities
// Shared utility functions for rule processing, validation, and async operations

// ============================================================================
// UUID GENERATION
// ============================================================================

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================================================
// RULE PROCESSING
// ============================================================================

/**
 * Normalize a filtering rule
 * - Trim whitespace
 * - Validate basic syntax
 * - Preserve comments and special syntax
 */
export function normalizeRule(rule) {
    if (typeof rule !== 'string') return '';

    // Trim whitespace
    let normalized = rule.trim();

    // Empty lines
    if (!normalized) {
        return normalized;
    }

    // [BUG FIX] DO NOT strip prefixes - preserve FULL rule text
    // Comments (!, #) - preserve as-is
    if (normalized.startsWith('!') || normalized.startsWith('#')) {
        return normalized;
    }

    // Exception rule (@@) - preserve
    if (normalized.startsWith('@@')) {
        return normalized;
    }

    // Block rules (||) - preserve  
    if (normalized.startsWith('||')) {
        return normalized;
    }

    // Basic validation - must have some content
    if (normalized.length < 2) {
        return '';
    }

    return normalized;
}

/**
 * Deduplicate rules while preserving order
 * - Remove exact duplicates
 * - Keep first occurrence
 * - [FIXED] Now properly deduplicates comments/disabled rules
 */
export function dedupRules(rules) {
    if (!Array.isArray(rules)) return [];

    const seen = new Set();
    const deduped = [];

    for (const rule of rules) {
        const normalized = normalizeRule(rule);

        // Skip empty rules
        if (!normalized) continue;

        // [BUG FIX] Deduplicate ALL rules including comments
        // Previously, comments were always kept without dedup check,
        // causing double counting in group merges (e.g., 17 + 17 = 34 instead of 17)
        if (!seen.has(normalized)) {
            seen.add(normalized);
            deduped.push(normalized);
        }
    }

    return deduped;
}

/**
 * Parse input to extract hostname
 * Handles: URLs, FQDNs, IP addresses
 * Returns: hostname or original input if parsing fails
 */
export function parseInputToHostname(input) {
    if (typeof input !== 'string') return '';

    const trimmed = input.trim();
    if (!trimmed) return '';

    try {
        // Try parsing as URL
        if (trimmed.includes('://')) {
            const url = new URL(trimmed);
            return url.hostname;
        }

        // Try parsing with protocol prepended
        if (trimmed.includes('.')) {
            const url = new URL('http://' + trimmed);
            return url.hostname;
        }

        // Return as-is (might be a domain)
        return trimmed;
    } catch (e) {
        // Parsing failed, return original
        return trimmed;
    }
}

/**
 * Generate AdGuard rule to block a domain
 */
export function generateBlockRule(domain) {
    const hostname = parseInputToHostname(domain);
    return `||${hostname}^`;
}

/**
 * Generate AdGuard rule to allow a domain
 */
export function generateAllowRule(domain) {
    const hostname = parseInputToHostname(domain);
    return `@@||${hostname}^`;
}

/**
 * Classify rule type using STRICT golden rule
 * Returns: 'disabled' | 'allow' | 'block' | 'unknown'
 * 
 * GOLDEN RULE:
 * - "@@" at start = Allow
 * - "||" at start = Block
 * - Everything else = Disabled/Inactive
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
    // This includes: comments (!), single pipe (|), domain-only, etc.
    return 'disabled';
}

/**
 * Classify all rules into categories
 * Returns: { allow: Rule[], block: Rule[], disabled: Rule[] }
 */
export function classifyRules(rules) {
    if (!Array.isArray(rules)) {
        return { allow: [], block: [], disabled: [] };
    }

    const classified = {
        allow: [],
        block: [],
        disabled: []
    };

    for (const rule of rules) {
        const type = classifyRule(rule);
        if (type === 'allow') {
            classified.allow.push(rule);
        } else if (type === 'disabled') {
            classified.disabled.push(rule);
        } else {
            // 'block' or 'unknown' (treat unknown as block)
            classified.block.push(rule);
        }
    }

    return classified;
}

/**
 * Get rule counts by type
 * Returns: { allow: number, block: number, disabled: number, total: number }
 */
export function getRuleCounts(rules) {
    const classified = classifyRules(rules);

    return {
        allow: classified.allow.length,
        block: classified.block.length,
        disabled: classified.disabled.length,
        total: rules ? rules.length : 0
    };
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Wrap a promise with a timeout
 * Rejects if promise doesn't resolve within timeoutMs
 */
export function withTimeout(promise, timeoutMs = 10000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        })
    ]);
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @param {number} delayMs - Initial delay in ms (default: 1000)
 */
export async function withRetry(fn, maxRetries = 2, delayMs = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on last attempt
            if (attempt < maxRetries) {
                // Exponential backoff
                const delay = delayMs * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate server configuration
 * Returns: { valid: boolean, errors: string[] }
 */
export function validateServer(server) {
    const errors = [];

    if (!server.name || server.name.trim().length === 0) {
        errors.push('Server name is required');
    }

    if (!server.host || server.host.trim().length === 0) {
        errors.push('Server host is required');
    } else {
        // Validate URL format
        try {
            new URL(server.host);
        } catch (e) {
            errors.push('Server host must be a valid URL (e.g., https://192.168.1.1)');
        }
    }

    if (!server.username || server.username.trim().length === 0) {
        errors.push('Username is required');
    }

    if (!server.password || server.password.trim().length === 0) {
        errors.push('Password is required');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize server data for logging (remove sensitive info)
 */
export function sanitizeServerForLog(server) {
    return {
        id: server.id,
        name: server.name,
        host: server.host,
        username: server.username ? '***' : undefined
        // Never log password
    };
}

// ============================================================================
// API RESPONSE VALIDATION (Phase 1 Security Fix)
// ============================================================================

/**
 * Validate and sanitize rules array from API response
 * Filters out invalid entries and ensures all rules are strings
 * @param {any} rules - Rules data from API
 * @param {string} source - Source identifier for logging
 * @returns {string[]} Validated array of rule strings
 */
export function validateRulesArray(rules, source = 'API') {
    // Handle non-array responses
    if (!Array.isArray(rules)) {
        console.error(`[Validation] ${source} returned non-array rules:`, typeof rules);
        return [];
    }

    // Filter and validate each rule
    const validRules = [];
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];

        // Check if rule is a string
        if (typeof rule !== 'string') {
            console.warn(`[Validation] ${source} rule[${i}] is not a string:`, typeof rule, rule);
            continue;
        }

        // Add valid rule
        validRules.push(rule);
    }

    // Log if any rules were filtered
    const filteredCount = rules.length - validRules.length;
    if (filteredCount > 0) {
        console.warn(`[Validation] Filtered ${filteredCount} invalid rule(s) from ${source}`);
    }

    return validRules;
}

/**
 * Validate and sanitize filtering status response from AdGuard Home API
 * Ensures response structure matches expected schema
 * @param {any} status - Raw status response from API
 * @returns {Object} Validated and sanitized status object
 * @throws {Error} If response is completely invalid
 */
export function validateFilteringStatus(status) {
    // Validate response is an object
    if (!status || typeof status !== 'object' || Array.isArray(status)) {
        console.error('[Validation] Invalid filtering status response:', typeof status);
        throw new Error('Server returned invalid filtering status (not an object)');
    }

    // Build validated response with defaults
    const validated = {
        enabled: Boolean(status.enabled),
        interval: typeof status.interval === 'number' ? status.interval : 24,
        user_rules: validateRulesArray(status.user_rules || [], 'filtering/status'),
        filters: Array.isArray(status.filters) ? status.filters : [],
        whitelist_filters: Array.isArray(status.whitelist_filters) ? status.whitelist_filters : [],
        filters_updated_count: typeof status.filters_updated_count === 'number' ? status.filters_updated_count : null
    };

    // Log validation summary
    console.log('[Validation] Filtering status validated:', {
        enabled: validated.enabled,
        userRulesCount: validated.user_rules.length,
        filtersCount: validated.filters.length
    });

    return validated;
}

/**
 * Validate server info response
 * @param {any} info - Raw server info from API
 * @returns {Object} Validated server info
 * @throws {Error} If response is invalid
 */
export function validateServerInfo(info) {
    if (!info || typeof info !== 'object' || Array.isArray(info)) {
        console.error('[Validation] Invalid server info response:', typeof info);
        throw new Error('Server returned invalid info (not an object)');
    }

    return {
        version: typeof info.version === 'string' ? info.version : 'unknown',
        dns_port: typeof info.dns_port === 'number' ? info.dns_port : null,
        http_port: typeof info.http_port === 'number' ? info.http_port : null,
        protection_enabled: Boolean(info.protection_enabled),
        dhcp_available: Boolean(info.dhcp_available),
        running: Boolean(info.running)
    };
}

// ============================================================================
// RUNTIME PERMISSIONS (Phase 1 Security Fix)
// ============================================================================

/**
 * Request runtime permission for a server's host
 * @param {string} serverUrl - Server URL (e.g., https://192.168.1.1)
 * @returns {Promise<boolean>} True if permission granted
 * @throws {Error} If permission request fails or is denied
 */
export async function requestHostPermission(serverUrl) {
    try {
        const url = new URL(serverUrl);
        const origin = `${url.protocol}//${url.host}/*`;

        console.log(`[Permissions] Requesting access to ${origin}`);

        const granted = await chrome.permissions.request({
            origins: [origin]
        });

        if (!granted) {
            throw new Error('Permission denied. Cannot access this server.');
        }

        console.log(`[Permissions] Granted access to ${origin}`);
        return true;
    } catch (error) {
        console.error('[Permissions] Request failed:', error);
        throw new Error(`Permission request failed: ${error.message}`);
    }
}

/**
 * Check if permission is already granted for a server's host
 * @param {string} serverUrl - Server URL
 * @returns {Promise<boolean>} True if permission is granted
 */
export async function checkHostPermission(serverUrl) {
    try {
        const url = new URL(serverUrl);
        const origin = `${url.protocol}//${url.host}/*`;

        return await chrome.permissions.contains({
            origins: [origin]
        });
    } catch (error) {
        console.error('[Permissions] Check failed:', error);
        return false;
    }
}

/**
 * Remove permission for a server's host
 * @param {string} serverUrl - Server URL
 * @returns {Promise<boolean>} True if permission was removed
 */
export async function revokeHostPermission(serverUrl) {
    try {
        const url = new URL(serverUrl);
        const origin = `${url.protocol}//${url.host}/*`;

        const removed = await chrome.permissions.remove({
            origins: [origin]
        });

        if (removed) {
            console.log(`[Permissions] Revoked access to ${origin}`);
        }

        return removed;
    } catch (error) {
        console.error('[Permissions] Revoke failed:', error);
        return false;
    }
}

// ============================================================================
// PRODUCTION LOGGING SYSTEM
// ============================================================================

/**
 * Log levels for production filtering
 * ERROR: Critical errors only (always shown)
 * WARN: Warnings that need attention
 * INFO: Informational messages
 * DEBUG: Verbose debugging (development only)
 */
export const LOG_LEVEL = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Current log level (loaded from settings)
let currentLogLevel = LOG_LEVEL.ERROR;

/**
 * Set the global log level
 * Should be called on extension startup with user's preference
 * @param {number} level - LOG_LEVEL constant
 */
export function setLogLevel(level) {
    if (typeof level === 'number' && level >= 0 && level <= 3) {
        currentLogLevel = level;
        console.log(`[Logger] Log level set to ${level} (${Object.keys(LOG_LEVEL)[level]})`);
    }
}

/**
 * Production-ready logger with configurable verbosity
 * Respects user's logLevel setting to prevent information disclosure
 */
export const Logger = {
    /**
     * Log error (always shown, cannot be disabled)
     */
    error(...args) {
        console.error('[ERROR]', ...args);
    },

    /**
     * Log warning (shown if logLevel >= WARN)
     */
    warn(...args) {
        if (currentLogLevel >= LOG_LEVEL.WARN) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Log info (shown if logLevel >= INFO)
     */
    info(...args) {
        if (currentLogLevel >= LOG_LEVEL.INFO) {
            console.log('[INFO]', ...args);
        }
    },

    /**
     * Log debug (shown if logLevel >= DEBUG)
     */
    debug(...args) {
        if (currentLogLevel >= LOG_LEVEL.DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    }
};

// ============================================================================
// DEDUPLICATION FOR SYNC FEATURES
// ============================================================================

/**
 * Deduplicate DNS blocklists (filter URLs)
 * Merge strategy:
 * - Dedupe by URL (exact match)
 * - enabled: true if ANY server has it enabled
 * - rules_count: keep highest count
 * - last_updated: keep most recent
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
 */
export function dedupRewrites(rewrites) {
    if (!Array.isArray(rewrites) || rewrites.length === 0) {
        return [];
    }

    const map = new Map();

    for (const rewrite of rewrites) {
        if (!rewrite || !rewrite.domain) continue;

        const key = rewrite.domain.toLowerCase().trim();

        if (!map.has(key)) {
            map.set(key, { ...rewrite });
        }
        // First-wins: keep existing, ignore new
    }

    return Array.from(map.values());
}

/**
 * Deduplicate Home Clients
 * Merge strategy:
 * - Dedupe by name (exact match, case-sensitive)
 * - Merge ids arrays (union of all IPs/MACs)
 * - Merge settings: most restrictive wins for safety
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
            if (client.filtering_enabled) {
                existing.filtering_enabled = true;
            }

            if (client.parental_enabled) {
                existing.parental_enabled = true;
            }

            if (client.safebrowsing_enabled) {
                existing.safebrowsing_enabled = true;
            }

            // Merge safesearch
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

