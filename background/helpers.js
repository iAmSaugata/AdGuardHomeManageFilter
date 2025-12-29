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
