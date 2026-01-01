// Shared Utility Functions
// Consolidates common utilities used across views
// Eliminates code duplication and provides single source of truth

/**
 * Normalize a filtering rule
 * @param {string} rule - Raw rule text
 * @returns {string} Normalized rule or empty string
 */
export function normalizeRule(rule) {
    if (!rule || typeof rule !== 'string') return '';

    const trimmed = rule.trim();

    // Comments and empty lines are preserved
    if (trimmed.startsWith('!') || trimmed.startsWith('#')) {
        return trimmed;
    }

    // Skip very short rules (likely invalid)
    if (trimmed.length < 2) return '';

    return trimmed;
}

/**
 * Deduplicate array of rules while preserving order
 * [FIXED] Now deduplicates ALL rules including comments
 * @param {string[]} rules - Array of rules
 * @returns {string[]} Deduplicated array
 */
export function dedupRules(rules) {
    if (!Array.isArray(rules)) return [];

    const seen = new Set();
    const result = [];

    for (const rule of rules) {
        const normalized = normalizeRule(rule);

        // Skip empty rules
        if (!normalized) continue;

        // [BUG FIX] Deduplicate ALL rules including comments
        // Previously, comments were always kept without dedup check,
        // causing double counting in group merges
        if (seen.has(normalized)) continue;

        seen.add(normalized);
        result.push(normalized);
    }

    return result;
}

/**
 * Classify a rule using STRICT golden rule
 * @param {string} rule - Rule to classify
 * @returns {'block'|'allow'|'disabled'} Rule type
 * 
 * GOLDEN RULE:
 * - "@@" at start = Allow
 * - "||" at start = Block
 * - Everything else = Disabled/Inactive
 */
export function classifyRule(rule) {
    if (!rule || typeof rule !== 'string') return 'disabled';

    const trimmed = rule.trim();

    // Empty
    if (!trimmed) return 'disabled';

    // GOLDEN RULE: Apply strict matching
    if (trimmed.startsWith('@@')) return 'allow';
    if (trimmed.startsWith('||')) return 'block';

    // Everything else is disabled/inactive
    return 'disabled';
}

/**
 * Count rules by type
 * @param {string[]} rules - Array of rules
 * @returns {{block: number, allow: number, disabled: number, total: number}}
 */
export function getRuleCounts(rules) {
    const counts = { block: 0, allow: 0, disabled: 0, total: 0 };

    if (!Array.isArray(rules)) return counts;

    for (const rule of rules) {
        const type = classifyRule(rule);
        counts[type]++;
        counts.total++;
    }

    return counts;
}

/**
 * Generate a unique ID (simple version for UI use)
 * For crypto-secure IDs, use background/helpers.js generateUUID
 * @returns {string} Unique ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format a number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Truncate text to max length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncate(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
