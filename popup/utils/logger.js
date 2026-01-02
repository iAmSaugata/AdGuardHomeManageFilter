// Logger Wrapper for Popup Context
// Provides Logger functionality that respects debug mode setting

let currentLogLevel = 0; // Default: ERROR only

// Log levels
export const LOG_LEVEL = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Initialize log level from storage
async function initLogLevel() {
    try {
        const result = await chrome.storage.local.get('debugMode');
        const debugMode = result.debugMode || false;
        currentLogLevel = debugMode ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR;
    } catch (error) {
        console.error('[Logger] Failed to initialize log level:', error);
        currentLogLevel = LOG_LEVEL.ERROR;
    }
}

// Listen for debug mode changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.debugMode) {
        currentLogLevel = changes.debugMode.newValue ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR;
    }
});

// Initialize on module load
initLogLevel();

/**
 * Production-ready logger with configurable verbosity
 * Respects user's debug mode setting
 */
export const Logger = {
    /**
     * Log error (always shown, cannot be disabled)
     */
    error(...args) {
        console.error('[ERROR]', ...args);
    },

    /**
     * Log warning (shown if debug mode enabled)
     */
    warn(...args) {
        if (currentLogLevel >= LOG_LEVEL.WARN) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Log info (shown if debug mode enabled)
     */
    info(...args) {
        if (currentLogLevel >= LOG_LEVEL.INFO) {
            console.log('[INFO]', ...args);
        }
    },

    /**
     * Log debug (shown if debug mode enabled)
     */
    debug(...args) {
        if (currentLogLevel >= LOG_LEVEL.DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    }
};
