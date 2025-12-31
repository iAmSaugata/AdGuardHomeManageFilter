// Shared UI Components
// Reusable UI component generators to eliminate duplication

/**
 * Create a badge element for displaying counts
 * @param {number} count - Count to display
 * @param {'block'|'allow'|'disabled'|'total'} type - Badge type for styling
 * @returns {string} HTML string
 */
export function createBadge(count, type = 'total') {
    const classMap = {
        block: 'badge badge-block',
        allow: 'badge badge-allow',
        disabled: 'badge badge-disabled',
        total: 'badge badge-total'
    };

    const className = classMap[type] || 'badge';
    return `<span class="${className}">${count}</span>`;
}

/**
 * Create a toggle switch element
 * @param {string} id - Toggle ID
 * @param {string} label - Toggle label
 * @param {boolean} checked - Initial checked state
 * @param {Object} options - Additional options
 * @returns {string} HTML string
 */
export function createToggle(id, label, checked = false, options = {}) {
    const { disabled = false, className = '' } = options;

    return `
        <div class="toggle-group ${className}">
            <label class="toggle-label">
                <input 
                    type="checkbox" 
                    id="${id}" 
                    class="toggle-input"
                    ${checked ? 'checked' : ''}
                    ${disabled ? 'disabled' : ''}
                />
                <span class="toggle-slider"></span>
                <span class="toggle-text">${label}</span>
            </label>
        </div>
    `;
}

/**
 * Create an empty state message
 * @param {string} title - Empty state title
 * @param {string} message - Empty state message
 * @param {string|null} actionButton - Optional action button HTML
 * @returns {string} HTML string
 */
export function createEmptyState(title, message, actionButton = null) {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h3 class="empty-state-title">${title}</h3>
            <p class="empty-state-message">${message}</p>
            ${actionButton || ''}
        </div>
    `;
}

/**
 * Create a loading spinner
 * @param {string} message - Loading message
 * @returns {string} HTML string
 */
export function createLoadingSpinner(message = 'Loading...') {
    return `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p class="loading-message">${message}</p>
        </div>
    `;
}

/**
 * Create a server card stat
 * @param {string} label - Stat label
 * @param {number} value - Stat value
 * @param {string} className - Additional CSS class
 * @returns {string} HTML string
 */
export function createStat(label, value, className = '') {
    return `
        <div class="stat ${className}">
            <div class="stat-value">${value.toLocaleString()}</div>
            <div class="stat-label">${label}</div>
        </div>
    `;
}

/**
 * Create a button element
 * @param {string} text - Button text
 * @param {Object} options - Button options
 * @returns {string} HTML string
 */
export function createButton(text, options = {}) {
    const {
        id = '',
        className = 'btn btn-primary',
        type = 'button',
        disabled = false,
        icon = ''
    } = options;

    const idAttr = id ? `id="${id}"` : '';
    const iconHtml = icon ? `<span class="btn-icon">${icon}</span>` : '';

    return `
        <button 
            ${idAttr}
            type="${type}"
            class="${className}"
            ${disabled ? 'disabled' : ''}
        >
            ${iconHtml}
            <span class="btn-text">${text}</span>
        </button>
    `;
}

/**
 * Create an input field
 * @param {string} id - Input ID
 * @param {string} label - Input label
 * @param {Object} options - Input options
 * @returns {string} HTML string
 */
export function createInput(id, label, options = {}) {
    const {
        type = 'text',
        placeholder = '',
        value = '',
        required = false,
        disabled = false
    } = options;

    return `
        <div class="form-group">
            <label for="${id}" class="form-label">
                ${label}
                ${required ? '<span class="required">*</span>' : ''}
            </label>
            <input 
                type="${type}"
                id="${id}"
                class="form-input"
                placeholder="${placeholder}"
                value="${value}"
                ${required ? 'required' : ''}
                ${disabled ? 'disabled' : ''}
            />
        </div>
    `;
}
