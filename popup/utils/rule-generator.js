/**
 * Rule Generator Utility
 * Generates AdGuard DNS filtering syntax rules
 * 
 * Syntax Reference:
 * - Block: ||domain^
 * - Block Important: ||domain^$important
 * - Allow (whitelist): @@||domain^
 * - Allow Important: @@||domain^$important
 */

/**
 * Generate AdGuard DNS filtering rule
 * @param {string} hostname - Domain to block/allow
 * @param {boolean} isBlock - True for block, false for allow
 * @param {boolean} isImportant - True to add $important modifier
 * @returns {string} AdGuard rule syntax
 */
export function generateRule(hostname, isBlock = true, isImportant = false) {
    if (!hostname || typeof hostname !== 'string') {
        throw new Error('Hostname is required');
    }

    const cleanHostname = hostname.trim().toLowerCase();

    let rule;
    if (isBlock) {
        // Block rule: ||domain^
        rule = `||${cleanHostname}^`;
    } else {
        // Allow/whitelist rule: @@||domain^
        rule = `@@||${cleanHostname}^`;
    }

    // Add importance modifier if requested
    if (isImportant) {
        rule += '$important';
    }

    return rule;
}
