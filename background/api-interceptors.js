// API Interceptor System
// Provides middleware-like functionality for API requests/responses
// Enables logging, request IDs, error context, and custom transformations

export class APIInterceptor {
    constructor() {
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];
    }

    /**
     * Register request interceptor
     * @param {Function} interceptor - Function(url, options) => modifiedOptions
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * Register response interceptor
     * @param {Function} interceptor - Function(response, url, options) => modifiedResponse
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    /**
     * Register error interceptor
     * @param {Function} interceptor - Function(error, url, options) => modifiedError
     */
    addErrorInterceptor(interceptor) {
        this.errorInterceptors.push(interceptor);
    }

    /**
     * Process request through all interceptors
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Modified {url, options}
     */
    async interceptRequest(url, options) {
        let modifiedOptions = { ...options };

        for (const interceptor of this.requestInterceptors) {
            const result = await interceptor(url, modifiedOptions);
            if (result) {
                modifiedOptions = result;
            }
        }

        return { url, options: modifiedOptions };
    }

    /**
     * Process response through all interceptors
     * @param {Response} response - Fetch response
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Modified response
     */
    async interceptResponse(response, url, options) {
        let modifiedResponse = response;

        for (const interceptor of this.responseInterceptors) {
            const result = await interceptor(modifiedResponse, url, options);
            if (result) {
                modifiedResponse = result;
            }
        }

        return modifiedResponse;
    }

    /**
     * Process error through all interceptors
     * @param {Error} error - Error object
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Error>} Modified error
     */
    async interceptError(error, url, options) {
        let handledError = error;

        for (const interceptor of this.errorInterceptors) {
            const result = await interceptor(handledError, url, options);
            if (result) {
                handledError = result;
            }
        }

        return handledError;
    }
}

// ============================================================================
// GLOBAL INTERCEPTOR INSTANCE
// ============================================================================

const apiInterceptor = new APIInterceptor();

// ============================================================================
// BUILT-IN INTERCEPTORS
// ============================================================================

// 1. Request ID Interceptor (for tracing)
apiInterceptor.addRequestInterceptor((url, options) => {
    if (!options.headers) {
        options.headers = {};
    }
    options.headers['X-Request-ID'] = generateRequestId();
    options.headers['X-Request-Timestamp'] = new Date().toISOString();
    return options;
});

// 2. Request Logging Interceptor
apiInterceptor.addRequestInterceptor((url, options) => {
    const method = options.method || 'GET';
    const requestId = options.headers?.['X-Request-ID'];

    console.log(`[API Request] ${method} ${url}`, {
        requestId,
        headers: sanitizeHeaders(options.headers),
        hasBody: !!options.body,
        bodyLength: options.body?.length
    });

    return options;
});

// 3. Response Logging Interceptor
apiInterceptor.addResponseInterceptor((response, url, options) => {
    const method = options.method || 'GET';
    const requestId = options.headers?.['X-Request-ID'];

    console.log(`[API Response] ${method} ${url}`, {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers?.get('content-type')
    });

    return response;
});

// 4. Error Context Interceptor
apiInterceptor.addErrorInterceptor((error, url, options) => {
    // Add rich context to error for debugging
    error.requestUrl = url;
    error.requestMethod = options.method || 'GET';
    error.requestId = options.headers?.['X-Request-ID'];
    error.timestamp = new Date().toISOString();

    // Add user-friendly error type
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
        error.type = 'TimeoutError';
        error.userMessage = 'Request timed out. Server may be slow or unreachable.';
        error.retryable = true;
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        error.type = 'NetworkError';
        error.userMessage = 'Network error. Check your connection and server URL.';
        error.retryable = true;
    } else if (error.message.includes('401')) {
        error.type = 'AuthenticationError';
        error.userMessage = 'Authentication failed. Check your credentials.';
        error.retryable = false;
    } else if (error.message.includes('403')) {
        error.type = 'AuthorizationError';
        error.userMessage = 'Access denied. You may not have permission.';
        error.retryable = false;
    } else if (error.message.includes('404')) {
        error.type = 'NotFoundError';
        error.userMessage = 'Endpoint not found. Server may not support this feature.';
        error.retryable = false;
    } else if (error.message.includes('429')) {
        error.type = 'RateLimitError';
        error.userMessage = 'Too many requests. Please wait and try again.';
        error.retryable = true;
    } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        error.type = 'ServerError';
        error.userMessage = 'Server error. The AdGuard Home server encountered a problem.';
        error.retryable = true;
    } else {
        error.type = 'UnknownError';
        error.userMessage = error.message;
        error.retryable = false;
    }

    // Log enriched error
    console.error(`[API Error] ${error.type}:`, {
        requestId: error.requestId,
        url: error.requestUrl,
        method: error.requestMethod,
        message: error.message,
        userMessage: error.userMessage,
        retryable: error.retryable
    });

    return error;
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique request ID
 * @returns {string} Request ID in format: req_{timestamp}_{random}
 */
function generateRequestId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `req_${timestamp}_${random}`;
}

/**
 * Sanitize headers for logging (remove sensitive data)
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
    if (!headers) return {};

    const sanitized = { ...headers };

    // Redact sensitive headers
    const sensitiveKeys = ['Authorization', 'Cookie', 'X-Auth-Token', 'Api-Key'];

    for (const key of sensitiveKeys) {
        if (sanitized[key]) {
            sanitized[key] = '[REDACTED]';
        }
    }

    return sanitized;
}

export { apiInterceptor };
