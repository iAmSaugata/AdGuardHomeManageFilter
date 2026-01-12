// Keyboard Navigation Handler
// Implements keyboard shortcuts and focus management

/**
 * Keyboard shortcuts configuration
 */
const shortcuts = {
    // Navigation
    'Escape': () => handleEscape(),

    // Creation shortcuts
    'n': (e) => e.ctrlKey || e.metaKey ? handleNewServer(e) : null,
    'g': (e) => e.ctrlKey || e.metaKey ? handleNewGroup(e) : null,

    // Settings
    ',': (e) => e.ctrlKey || e.metaKey ? handleOpenSettings(e) : null,

    // Refresh
    'r': (e) => e.ctrlKey || e.metaKey ? handleRefresh(e) : null,

    // Help
    '?': () => handleShowHelp()
};

/**
 * Initialize keyboard handler
 */
export function initializeKeyboardHandler() {
    document.addEventListener('keydown', handleKeyDown);

    // Add visual focus styles if needed
    addFocusStyles();

    console.log('[Keyboard] Handler initialized');
}

/**
 * Handle keydown events
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
    const key = event.key;
    const handler = shortcuts[key];

    if (!handler) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Exception: Allow Escape in inputs
        if (key !== 'Escape') return;
    }

    const result = handler(event);

    // Prevent default if handler returned true or preventDefault explicitly
    if (result !== null) {
        event.preventDefault();
    }
}

/**
 * Handle Escape key - Close modals/forms
 */
function handleEscape() {
    const currentView = window.app.currentView;

    // Close any open modals first
    const modal = document.querySelector('.modal.active');
    if (modal) {
        modal.classList.remove('active');
        return true;
    }

    // Navigate back from form views
    if (currentView.includes('-form') || currentView.includes('-detail')) {
        const backButton = document.querySelector('#back-btn, #cancel-btn');
        if (backButton) {
            backButton.click();
            return true;
        }
    }

    // Navigate to dashboard from other views
    if (currentView !== 'dashboard') {
        window.app.navigateTo('dashboard');
        return true;
    }

    return null;
}

/**
 * Handle Ctrl/Cmd+N - New Server
 */
function handleNewServer(event) {
    window.app.navigateTo('server-form', { mode: 'add' });
    return true;
}

/**
 * Handle Ctrl/Cmd+G - New Group
 */
function handleNewGroup(event) {
    window.app.navigateTo('group-server-selection', { mode: 'create' });
    return true;
}

/**
 * Handle Ctrl/Cmd+, - Open Settings
 */
function handleOpenSettings(event) {
    window.app.navigateTo('settings');
    return true;
}

/**
 * Handle Ctrl/Cmd+R - Refresh All
 */
function handleRefresh(event) {
    const refreshButton = document.querySelector('#refresh-all-btn, [data-action="refresh-all"]');
    if (refreshButton) {
        refreshButton.click();
        return true;
    }
    return null;
}

/**
 * Handle ? - Show keyboard shortcuts help
 */
function handleShowHelp() {
    showKeyboardShortcutsDialog();
    return true;
}

/**
 * Show keyboard shortcuts help dialog
 */
function showKeyboardShortcutsDialog() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'shortcuts-title');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
                <button class="btn btn-ghost btn-sm" id="close-shortcuts-modal" aria-label="Close">✕</button>
            </div>
            <div class="modal-body">
                <table class="shortcuts-table">
                    <thead>
                        <tr>
                            <th>Action</th>
                            <th>Shortcut</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>New Server</td>
                            <td><kbd>Ctrl</kbd>+<kbd>N</kbd> (Windows/Linux) or <kbd>⌘</kbd>+<kbd>N</kbd> (Mac)</td>
                        </tr>
                        <tr>
                            <td>New Group</td>
                            <td><kbd>Ctrl</kbd>+<kbd>G</kbd> or <kbd>⌘</kbd>+<kbd>G</kbd></td>
                        </tr>
                        <tr>
                            <td>Settings</td>
                            <td><kbd>Ctrl</kbd>+<kbd>,</kbd> or <kbd>⌘</kbd>+<kbd>,</kbd></td>
                        </tr>
                        <tr>
                            <td>Refresh All</td>
                            <td><kbd>Ctrl</kbd>+<kbd>R</kbd> or <kbd>⌘</kbd>+<kbd>R</kbd></td>
                        </tr>
                        <tr>
                            <td>Close/Go Back</td>
                            <td><kbd>Esc</kbd></td>
                        </tr>
                        <tr>
                            <td>Show This Help</td>
                            <td><kbd>?</kbd></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="close-shortcuts-btn">Got it</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus the close button
    setTimeout(() => {
        document.getElementById('close-shortcuts-btn').focus();
    }, 100);

    // Close handlers
    const closeModal = () => {
        modal.remove();
    };

    document.getElementById('close-shortcuts-modal').addEventListener('click', closeModal);
    document.getElementById('close-shortcuts-btn').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Trap focus within modal
    trapFocus(modal.querySelector('.modal-content'));
}

/**
 * Trap focus within an element
 * @param {HTMLElement} element - Element to trap focus within
 */
export function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    });
}

/**
 * Set focus on first interactive element in a container
 * @param {HTMLElement} container - Container element
 */
export function focusFirstElement(container) {
    const firstFocusable = container.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    );

    if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
    }
}

/**
 * Store and restore focus
 */
let previousFocus = null;

export function storeFocus() {
    previousFocus = document.activeElement;
}

export function restoreFocus() {
    if (previousFocus && typeof previousFocus.focus === 'function') {
        setTimeout(() => previousFocus.focus(), 100);
    }
}

/**
 * Add visual focus styles if not present
 */
function addFocusStyles() {
    // Check if focus styles already exist
    if (document.querySelector('style[data-focus-styles]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-focus-styles', 'true');
    style.textContent = `
        /* Enhanced keyboard focus indicators */
        *:focus {
            outline: 2px solid var(--color-primary, #0ea5e9);
            outline-offset: 2px;
        }
        
        *:focus:not(:focus-visible) {
            outline: none;
        }
        
        *:focus-visible {
            outline: 2px solid var(--color-primary, #0ea5e9);
            outline-offset: 2px;
        }
        
        /* Keyboard shortcuts table */
        .shortcuts-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .shortcuts-table th,
        .shortcuts-table td {
            padding: var(--space-2, 8px);
            text-align: left;
            border-bottom: 1px solid var(--color-border, #334155);
        }
        
        .shortcuts-table th {
            font-weight: 600;
            color: var(--color-text-primary, #f1f5f9);
        }
        
        .shortcuts-table kbd {
            background: var(--color-bg-secondary, #1e293b);
            border: 1px solid var(--color-border, #334155);
            border-radius: 4px;
            padding: 2px 6px;
            font-family: monospace;
            font-size: 0.875em;
        }
    `;

    document.head.appendChild(style);
}
