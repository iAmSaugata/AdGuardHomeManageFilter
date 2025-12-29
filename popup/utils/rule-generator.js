/**
 * Rule Generator - AdGuard DNS Filtering Syntax
 * Official syntax with $important modifier
 */

export function generateRule(hostname, isBlock = true, isImportant = false) {
    if (!hostname || typeof hostname !== 'string') {
        throw new Error('Hostname required');
    }

    const clean = hostname.trim().toLowerCase();
    let rule = '';

    // Block or allow
    if (isBlock) {
        rule = `||${clean}^`;
    } else {
        rule = `@@||${clean}^`;
    }

    // Add importance modifier
    if (isImportant) {
        rule += '$important';
    }

    return rule;
}
