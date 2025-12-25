// AdGuard Home API Client
// Based on OpenAPI specification from AdGuardHome repository
// Base path: /control
// Auth: HTTP Basic Auth

import { withTimeout, withRetry, sanitizeServerForLog } from './helpers.js';

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
 * Make API request with timeout and error handling
 */
async function apiRequest(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

    try {
        const response = await withTimeout(
            fetch(url, fetchOptions),
            timeout
        );

        // Check for HTTP errors
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Parse JSON response
        const data = await response.json();
        return data;
    } catch (error) {
        // Enhance error message
        if (error.message.includes('timed out')) {
            throw new Error('Request timed out. Check server connectivity.');
        }
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Network error. Check server URL and connectivity.');
        }
        throw error;
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
        const url = `${host}/control/filtering/status`;
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
    const url = `${server.host}/control/filtering/status`;
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
 * Set user-defined filtering rules
 * POST /control/filtering/set_rules
 * @param {Object} server - Server configuration
 * @param {string[]} rules - Array of filtering rules
 * Returns: void (success) or throws error
 */
export async function setRules(server, rules) {
    const url = `${server.host}/control/filtering/set_rules`;
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
