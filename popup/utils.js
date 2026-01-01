// Shared Utility Functions for Popup Views
// Eliminates code duplication across view files

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Classify a filtering rule by type using STRICT golden rule
 * @param {string} rule - AdGuard filtering rule
 * @returns {string} Rule type: 'allow' | 'block' | 'disabled' | 'unknown'
 * 
 * GOLDEN RULE:
 * - "@@" at start = Allow (green)
 * - "||" at start = Block (red)
 * - Everything else = Disabled/Inactive (gray)
 */
export function classifyRule(rule) {
    if (typeof rule !== 'string') return 'unknown';

    const trimmed = rule.trim();

    // Empty lines are disabled
    if (!trimmed) return 'disabled';

    // GOLDEN RULE: Apply strict matching
    if (trimmed.startsWith('@@')) return 'allow';
    if (trimmed.startsWith('||')) return 'block';

    // Everything else is disabled/inactive
    // This includes: comments (!, #), single pipe (|), domain-only, etc.
    return 'disabled';
}

/**
 * Get rule counts by type
 * @param {string[]} rules - Array of filtering rules
 * @returns {Object} Counts object with allow, block, disabled, and total
 */
export function getRuleCounts(rules) {
    if (!Array.isArray(rules)) {
        return { allow: 0, block: 0, disabled: 0, total: 0 };
    }

    let allow = 0;
    let block = 0;
    let disabled = 0;

    for (const rule of rules) {
        const type = classifyRule(rule);
        if (type === 'allow') {
            allow++;
        } else if (type === 'disabled') {
            disabled++;
        } else {
            // 'block' or 'unknown' (treat unknown as block)
            block++;
        }
    }

    return {
        allow,
        block,
        disabled,
        total: rules.length
    };
}

/**
 * Show custom confirmation dialog that stays within popup bounds
 * @param {string} title - Dialog title
 * @param {string} message - Main message
 * @param {string} subtitle - Optional subtitle
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
export function showConfirmDialog(title, message, subtitle = '') {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="confirm-header">
                <h3 class="confirm-title">${escapeHtml(title)}</h3>
            </div>
            <div class="confirm-body">
                <p class="confirm-message">${escapeHtml(message)}</p>
                ${subtitle ? `<p class="confirm-subtitle">${escapeHtml(subtitle)}</p>` : ''}
            </div>
            <div class="confirm-actions">
                <button class="btn btn-secondary btn-block" id="confirm-cancel">Cancel</button>
                <button class="btn btn-danger btn-block" id="confirm-ok">Delete</button>
            </div>
        `;

        overlay.appendChild(dialog);

        // Append to app container instead of body to respect popup bounds
        const appContainer = document.getElementById('app') || document.querySelector('.app-container');
        if (appContainer) {
            appContainer.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }

        // Event listeners
        const cancelBtn = overlay.querySelector('#confirm-cancel');
        const okBtn = overlay.querySelector('#confirm-ok');

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        okBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}
