// AdGuard Home API Client
// Based on OpenAPI specification from AdGuardHome repository
// Base path: /control
// Auth: HTTP Basic Auth

import { withTimeout, withRetry, sanitizeServerForLog } from './helpers.js';
import { apiInterceptor } from './api-interceptors.js';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_RETRIES = 2;

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Create Basic Auth header
 */
function createAuthHeader(username, password) {
    const credentials = btoa(`${username}:${password}`);
    return `Basic ${credentials}`;
}

/**
 * Normalize host URL by removing trailing slash
 * Prevents double-slash in API endpoints
 */
function normalizeHost(host) {
    return host.endsWith('/') ? host.slice(0, -1) : host;
}

/**
 * Make API request with timeout and error handling
 * Now includes interceptor support for logging, tracing, and error enrichment
 */
async function apiRequest(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

    try {
        // ===== REQUEST INTERCEPTORS =====
        const { url: interceptedUrl, options: interceptedOptions } =
            await apiInterceptor.interceptRequest(url, fetchOptions);

        const response = await withTimeout(
            fetch(interceptedUrl, interceptedOptions),
            timeout
        );

        // Check for HTTP errors
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // ===== RESPONSE INTERCEPTORS =====
        const interceptedResponse = await apiInterceptor.interceptResponse(
            response,
            interceptedUrl,
            interceptedOptions
        );

        // Parse JSON response only if there's content
        const contentLength = interceptedResponse.headers.get('content-length');
        const contentType = interceptedResponse.headers.get('content-type');

        // If response is empty or not JSON, return success
        if (contentLength === '0' || !contentType || !contentType.includes('application/json')) {
            return { success: true };
        }

        // Try to parse JSON
        const text = await interceptedResponse.text();
        if (!text || text.trim() === '') {
            return { success: true };
        }

        const data = JSON.parse(text);
        return data;
    } catch (error) {
        // ===== ERROR INTERCEPTORS =====
        const interceptedError = await apiInterceptor.interceptError(
            error,
            url,
            fetchOptions
        );

        // Enhance error message (now done in interceptor, but keep fallback)
        if (interceptedError.message.includes('timed out')) {
            throw new Error('Request timed out. Check server connectivity.');
        }
        if (interceptedError.message.includes('Failed to fetch')) {
            throw new Error('Network error. Check server URL and connectivity.');
        }
        throw interceptedError;
    }
}

// ============================================================================
// PUBLIC API METHODS
// ============================================================================

/**
 * Test connection to AdGuard Home server
 * GET /control/filtering/status
 * Returns: { success: boolean, error?: string }
 */
export async function testConnection(host, username, password) {
    try {
        // Note: With optional_host_permissions, Chrome will automatically
        // prompt the user for permission when we try to access the host.
        // We don't need to manually request permission here.

        const normalizedHost = normalizeHost(host);
        const url = `${normalizedHost}/control/filtering/status`;
        const authHeader = createAuthHeader(username, password);

        await apiRequest(url, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        return { success: true };
    } catch (error) {
        console.error('Connection test failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get filtering status including user rules
 * GET /control/filtering/status
 * Returns: FilterStatus object from API
 */
export async function getFilteringStatus(server) {
    const normalizedHost = normalizeHost(server.host);
    const url = `${normalizedHost}/control/filtering/status`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Fetching filtering status for:', sanitizeServerForLog(server));

    const data = await withRetry(async () => {
        return await apiRequest(url, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });
    }, DEFAULT_RETRIES);

    return data;
}

/**
 * Get server information including version
 * GET /control/status
 * Returns: { version: string, ... }
 */
export async function getServerInfo(server) {
    const normalizedHost = normalizeHost(server.host);
    const url = `${normalizedHost}/control/status`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Fetching server info for:', sanitizeServerForLog(server));

    const data = await withRetry(async () => {
        return await apiRequest(url, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });
    }, DEFAULT_RETRIES);

    return data;
}

/**
 * Set user-defined filtering rules
 * POST /control/filtering/set_rules
 * @param {Object} server - Server configuration
 * @param {string[]} rules - Array of filtering rules
 * Returns: void (success) or throws error
 */
export async function setRules(server, rules) {
    const normalizedHost = normalizeHost(server.host);
    const url = `${normalizedHost}/control/filtering/set_rules`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Setting rules for:', sanitizeServerForLog(server), `(${rules.length} rules)`);

    await withRetry(async () => {
        return await apiRequest(url, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rules })
        });
    }, DEFAULT_RETRIES);

    console.log('Rules set successfully');
}

/**
 * Get current user rules from server
 * Convenience method that extracts user_rules from filtering status
 */
export async function getUserRules(server) {
    const status = await getFilteringStatus(server);
    return status.user_rules || [];
}

/**
 * Add rules to existing user rules (merge operation)
 * Fetches current rules, merges with new rules, and sets them back
 */
export async function addRules(server, newRules) {
    const currentRules = await getUserRules(server);
    const mergedRules = [...currentRules, ...newRules];
    await setRules(server, mergedRules);
    return mergedRules;
}

/**
 * Remove specific rules from user rules
 * Fetches current rules, filters out specified rules, and sets them back
 */
export async function removeRules(server, rulesToRemove) {
    const currentRules = await getUserRules(server);
    const rulesToRemoveSet = new Set(rulesToRemove);
    const filteredRules = currentRules.filter(rule => !rulesToRemoveSet.has(rule));
    await setRules(server, filteredRules);
    return filteredRules;
}

// ============================================================================
// NEW API ENDPOINTS (Following OpenAPI Spec)
// ============================================================================

/**
 * Add a filter subscription URL
 * POST /control/filtering/add_url
 * @param {Object} server - Server configuration
 * @param {string} url - URL to filter list
 * @param {string} name - Name for the filter
 * @param {boolean} whitelist - Whether it's a whitelist (true) or blocklist (false)
 * @returns {Promise<void>}
 */
export async function addFilterURL(server, url, name, whitelist = false) {
    const normalizedHost = normalizeHost(server.host);
    const endpoint = `${normalizedHost}/control/filtering/add_url`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Adding filter URL:', sanitizeServerForLog(server), { url, name, whitelist });

    await withRetry(async () => {
        return await apiRequest(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, name, whitelist })
        });
    }, DEFAULT_RETRIES);

    console.log('Filter URL added successfully');
}

/**
 * Remove a filter subscription URL
 * POST /control/filtering/remove_url
 * @param {Object} server - Server configuration
 * @param {string} url - URL to remove
 * @param {boolean} whitelist - Whether it's a whitelist
 * @returns {Promise<void>}
 */
export async function removeFilterURL(server, url, whitelist = false) {
    const normalizedHost = normalizeHost(server.host);
    const endpoint = `${normalizedHost}/control/filtering/remove_url`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Removing filter URL:', sanitizeServerForLog(server), { url, whitelist });

    await withRetry(async () => {
        return await apiRequest(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, whitelist })
        });
    }, DEFAULT_RETRIES);

    console.log('Filter URL removed successfully');
}

/**
 * Set filtering configuration
 * POST /control/filtering/set_config
 * @param {Object} server - Server configuration
 * @param {Object} config - Filtering configuration
 * @param {boolean} config.enabled - Enable/disable filtering
 * @param {number} config.interval - Update interval in hours
 * @returns {Promise<void>}
 */
export async function setFilteringConfig(server, config) {
    const normalizedHost = normalizeHost(server.host);
    const endpoint = `${normalizedHost}/control/filtering/set_config`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Setting filtering config:', sanitizeServerForLog(server), config);

    await withRetry(async () => {
        return await apiRequest(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
    }, DEFAULT_RETRIES);

    console.log('Filtering config updated');
}

/**
 * Force refresh all filter lists
 * POST /control/filtering/refresh
 * @param {Object} server - Server configuration
 * @param {boolean} force - Force update even if not stale
 * @returns {Promise<Object>} Refresh result with updated count
 */
export async function refreshFilters(server, force = false) {
    const normalizedHost = normalizeHost(server.host);
    const endpoint = `${normalizedHost}/control/filtering/refresh`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Refreshing filters:', sanitizeServerForLog(server), { force });

    const result = await withRetry(async () => {
        return await apiRequest(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ whitelist: false })
        });
    }, DEFAULT_RETRIES);

    console.log('Filters refreshed');
    return result;
}

/**
 * Check if a host is blocked
 * POST /control/filtering/check_host
 * @param {Object} server - Server configuration
 * @param {string} name - Hostname to check
 * @returns {Promise<Object>} Result with reason, rule, filterId, etc.
 * Result format: {
 *   reason: string, // 'NotFilteredNotFound', 'FilteredBlackList', 'FilteredWhiteList', etc.
 *   rule: string,   // Matching rule (if blocked)
 *   filter_id: number,
 *   service_name: string
 * }
 */
export async function checkHost(server, name) {
    const normalizedHost = normalizeHost(server.host);
    const endpoint = `${normalizedHost}/control/filtering/check_host`;
    const authHeader = createAuthHeader(server.username, server.password);

    console.log('Checking host:', sanitizeServerForLog(server), { name });

    const result = await withRetry(async () => {
        return await apiRequest(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
    }, DEFAULT_RETRIES);

    console.log('Host check result:', {
        name,
        reason: result.reason,
        blocked: result.reason !== 'NotFilteredNotFound'
    });

    return result;
}

