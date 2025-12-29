/**
 * Rule Parser Utility
 * Parses URL or FQDN input and extracts hostname
 */

/**
 * Parse user input (URL or FQDN) and extract hostname
 * @param {string} input - User input (URL or FQDN)
 * @returns {Object} { hostname: string|null, error: string|null }
 */
export function parseInput(input) {
    if (!input || typeof input !== 'string') {
        return { hostname: null, error: 'Input is required' };
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return { hostname: null, error: 'Input is required' };
    }

    // Try parsing as URL first
    try {
        // Add protocol if missing for URL parsing
        const urlString = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
        const url = new URL(urlString);
        const hostname = url.hostname;

        if (isValidHostname(hostname)) {
            return { hostname, error: null };
        }
    } catch (e) {
        // Not a valid URL, fall through to FQDN validation
    }

    // Validate as FQDN
    if (isValidHostname(trimmed)) {
        return { hostname: trimmed, error: null };
    }

    return { hostname: null, error: 'Invalid domain or URL format' };
}

/**
 * Validate if string is a valid hostname
 * @param {string} hostname - Hostname to validate
 * @returns {boolean} True if valid
 */
function isValidHostname(hostname) {
    if (!hostname || hostname.length === 0) {
        return false;
    }

    // Basic validation: must have at least domain.tld format
    const parts = hostname.split('.');
    if (parts.length < 2) {
        return false;
    }

    // Check each part is valid (alphanumeric and hyphens, not starting/ending with hyphen)
    const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
    return parts.every(part => labelRegex.test(part));
}
