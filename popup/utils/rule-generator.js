/**
 * Rule Generator - AdGuard DNS Filtering Syntax
 * Official syntax - no custom formats
 */

export function generateRule(hostname, isBlock = true, isImportant = false) {
    if (!hostname || typeof hostname !== 'string') {
        throw new Error('Hostname required');
    }

    const clean = hostname.trim().toLowerCase();
    let rule = '';

    // Importance prefix
    if (isImportant) {
        rule += '!#';
    }

    // Block or allow
    if (isBlock) {
        rule += `||${clean}^`;
    } else {
        rule += `@@||${clean}^`;
    }

    return rule;
}
