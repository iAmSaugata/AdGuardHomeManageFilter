/**
 * Rule Domain Validator
 * Extracts domain from AdGuard rules and checks for duplicates
 */

/**
 * Extract domain from an AdGuard rule
 * @param {string} rule - AdGuard rule (e.g., "||domain.com^", "@@||domain.com^$important")
 * @returns {string|null} - Extracted domain or null
 */
export function extractDomainFromRule(rule) {
    if (!rule || typeof rule !== 'string') {
        return null;
    }

    const trimmed = rule.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#')) {
        return null;
    }

    // Remove exception marker @@
    let pattern = trimmed.startsWith('@@') ? trimmed.substring(2) : trimmed;

    // Remove modifiers (everything after $)
    const dollarIndex = pattern.indexOf('$');
    if (dollarIndex !== -1) {
        pattern = pattern.substring(0, dollarIndex);
    }

    // Extract domain from pattern
    let domain = pattern;

    // Remove ||  prefix
    if (domain.startsWith('||')) {
        domain = domain.substring(2);
    } else if (domain.startsWith('|')) {
        domain = domain.substring(1);
        // Remove protocol if present
        domain = domain.replace(/^https?:\/\//, '');
    }

    // Remove ^ separator and everything after
    const caretIndex = domain.indexOf('^');
    if (caretIndex !== -1) {
        domain = domain.substring(0, caretIndex);
    }

    // Remove / and everything after (path)
    const slashIndex = domain.indexOf('/');
    if (slashIndex !== -1) {
        domain = domain.substring(0, slashIndex);
    }

    // Remove wildcards and clean up
    domain = domain.replace(/[*?]/g, '');

    // Validate domain-like pattern
    if (domain && domain.match(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/)) {
        return domain.toLowerCase();
    }

    return null;
}

/**
 * Check if a rule exists for the same domain
 * @param {string} newRule - New rule to add
 * @param {Array<string>} existingRules - Existing rules array
 * @returns {Object} - { exists: boolean, conflictingRule: string|null, domain: string|null }
 */
export function checkDomainExists(newRule, existingRules) {
    const newDomain = extractDomainFromRule(newRule);

    if (!newDomain) {
        // Can't extract domain, allow it (might be a comment or special rule)
        return { exists: false, conflictingRule: null, domain: null };
    }

    // Check if any existing rule has the same domain
    for (const existingRule of existingRules) {
        const existingDomain = extractDomainFromRule(existingRule);

        if (existingDomain && existingDomain === newDomain) {
            return {
                exists: true,
                conflictingRule: existingRule,
                domain: newDomain
            };
        }
    }

    return { exists: false, conflictingRule: null, domain: newDomain };
}

/**
 * Get rule type from rule string
 * @param {string} rule - AdGuard rule
 * @returns {string} - 'allow' or 'block'
 */
export function getRuleType(rule) {
    if (!rule) return 'block';
    const trimmed = rule.trim();

    // Skip comments
    if (trimmed.startsWith('!') || trimmed.startsWith('#')) {
        return 'comment';
    }

    // Exception rule (allow)
    if (trimmed.startsWith('@@')) {
        return 'allow';
    }

    return 'block';
}

/**
 * Check if rule has important modifier
 * @param {string} rule - AdGuard rule
 * @returns {boolean}
 */
export function hasImportantModifier(rule) {
    if (!rule) return false;
    const dollarIndex = rule.indexOf('$');
    if (dollarIndex === -1) return false;

    const modifiers = rule.substring(dollarIndex + 1);
    return modifiers.split(',').some(m => m.trim() === 'important');
}
