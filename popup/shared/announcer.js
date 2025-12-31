// Screen Reader Announcer
// Provides live announcements for dynamic content changes

/**
 * Initialize the announcer
 * Creates an ARIA live region if it doesn't exist
 */
export function initializeAnnouncer() {
    let announcer = document.getElementById('announcer');

    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'announcer';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        document.body.appendChild(announcer);
    }

    return announcer;
}

/**
 * Announce a message to screen readers
 * @param {string} message - Message to announce
 * @param {'polite'|'assertive'} priority - Announcement priority
 */
export function announce(message, priority = 'polite') {
    const announcer = initializeAnnouncer();

    // Update priority if needed
    if (announcer.getAttribute('aria-live') !== priority) {
        announcer.setAttribute('aria-live', priority);
    }

    // Clear and set new message
    // The delay ensures screen readers detect the change
    announcer.textContent = '';

    setTimeout(() => {
        announcer.textContent = message;
    }, 100);
}

/**
 * Announce view navigation
 * @param {string} viewName - Name of the new view
 */
export function announceNavigation(viewName) {
    const formattedName = viewName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());

    announce(`Navigated to ${formattedName}`, 'polite');
}

/**
 * Announce CRUD operation result
 * @param {string} action - Action performed (created, updated, deleted, etc.)
 * @param {string} itemType - Type of item (server, group, rule, etc.)
 * @param {boolean} success - Whether the action succeeded
 * @param {string} [details] - Additional details
 */
export function announceAction(action, itemType, success, details = '') {
    const status = success ? 'successfully' : 'failed';
    const message = `${itemType} ${action} ${status}${details ? '. ' + details : ''}`;

    announce(message, success ? 'polite' : 'assertive');
}

/**
 * Announce loading state
 * @param {boolean} isLoading - Whether loading started or finished
 * @param {string} [context] - What is being loaded
 */
export function announceLoading(isLoading, context = '') {
    if (isLoading) {
        announce(`Loading${context ? ' ' + context : ''}...`, 'polite');
    } else {
        announce(`Finished loading${context ? ' ' + context : ''}`, 'polite');
    }
}

/**
 * Announce error
 * @param {string} error - Error message
 */
export function announceError(error) {
    announce(`Error: ${error}`, 'assertive');
}

/**
 * Announce validation error
 * @param {string} fieldName - Name of the field with error
 * @param {string} errorMessage - Validation error message
 */
export function announceValidationError(fieldName, errorMessage) {
    announce(`${fieldName}: ${errorMessage}`, 'assertive');
}

/**
 * Announce count/stat change
 * @param {string} label - Label for the stat
 * @param {number} count - New count value
 */
export function announceCount(label, count) {
    announce(`${label}: ${count}`, 'polite');
}
