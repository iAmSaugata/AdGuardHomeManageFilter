/**
 * Rule Parser - Extract hostname from URL or FQDN
 * Reuses browser URL API - no custom logic
 */

export function parseInput(input) {
    if (!input || typeof input !== 'string') {
        return { hostname: null, error: 'Input required' };
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return { hostname: null, error: 'Input required' };
    }

    // Try URL parsing first
    try {
        const urlString = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
        const url = new URL(urlString);
        const hostname = url.hostname;

        if (isValidHostname(hostname)) {
            return { hostname, error: null };
        }
    } catch (e) {
        // Not a URL, try as FQDN
    }

    // Validate as FQDN
    if (isValidHostname(trimmed)) {
        return { hostname: trimmed, error: null };
    }

    return { hostname: null, error: 'Invalid domain format' };
}

function isValidHostname(hostname) {
    if (!hostname || hostname.length === 0) return false;

    const parts = hostname.split('.');
    if (parts.length < 2) return false;

    const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
    return parts.every(part => labelRegex.test(part));
}
