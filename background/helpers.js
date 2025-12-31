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

    // Empty or comment - return as-is
    if (!normalized || normalized.startsWith('!')) {
        return normalized;
    }

    // Exception rule (@@) - preserve
    if (normalized.startsWith('@@')) {
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
 * - Preserve comments
 */
export function dedupRules(rules) {
    if (!Array.isArray(rules)) return [];

    const seen = new Set();
    const deduped = [];

    for (const rule of rules) {
        const normalized = normalizeRule(rule);

        // Skip empty rules
        if (!normalized) continue;

        // Always keep comments (they might be different)
        if (normalized.startsWith('!')) {
            deduped.push(normalized);
            continue;
        }

        // Deduplicate non-comments
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
 * Classify rule type
 * Returns: 'disabled' | 'allow' | 'block' | 'unknown'
 */
export function classifyRule(rule) {
    if (typeof rule !== 'string') return 'unknown';

    const trimmed = rule.trim();

    if (!trimmed) return 'disabled'; // Empty lines are disabled
    if (trimmed.startsWith('!')) return 'disabled'; // Comments with ! are disabled
    if (trimmed.startsWith('#')) return 'disabled'; // Comments with # are disabled
    if (trimmed.startsWith('@@')) return 'allow';
    if (trimmed.startsWith('||') || trimmed.startsWith('|')) return 'block';

    // Domain-only style or hosts-style
    if (trimmed.match(/^[a-zA-Z0-9.-]+$/)) return 'block';

    return 'block'; // Default assumption
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
        console.error([Validation]  returned non-array rules:, typeof rules);
        return [];
    }
    
    // Filter and validate each rule
    const validRules = [];
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        
        // Check if rule is a string
        if (typeof rule !== 'string') {
            console.warn([Validation]  rule[] is not a string:, typeof rule, rule);
            continue;
        }
        
        // Add valid rule
        validRules.push(rule);
    }
    
    // Log if any rules were filtered
    const filteredCount = rules.length - validRules.length;
    if (filteredCount > 0) {
        console.warn([Validation] Filtered  invalid rule(s) from );
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
        const origin = ${url.protocol}///*;
        
        console.log([Permissions] Requesting access to );
        
        const granted = await chrome.permissions.request({
            origins: [origin]
        });
        
        if (!granted) {
            throw new Error('Permission denied. Cannot access this server.');
        }
        
        console.log([Permissions] Granted access to );
        return true;
    } catch (error) {
        console.error('[Permissions] Request failed:', error);
        throw new Error(Permission request failed: );
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
        const origin = ${url.protocol}///*;
        
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
        const origin = ${url.protocol}///*;
        
        const removed = await chrome.permissions.remove({
            origins: [origin]
        });
        
        if (removed) {
            console.log([Permissions] Revoked access to );
        }
        
        return removed;
    } catch (error) {
        console.error('[Permissions] Revoke failed:', error);
        return false;
    }
}
