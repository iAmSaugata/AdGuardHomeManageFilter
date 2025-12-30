// Chrome Storage API Mock
// In-memory implementation for testing

class StorageMock {
    constructor() {
        this.data = {};
    }

    get(keys, callback) {
        const result = {};

        if (typeof keys === 'string') {
            if (this.data[keys] !== undefined) {
                result[keys] = this.data[keys];
            }
        } else if (Array.isArray(keys)) {
            keys.forEach(key => {
                if (this.data[key] !== undefined) {
                    result[key] = this.data[key];
                }
            });
        } else if (keys === null || keys === undefined) {
            // Get all
            Object.assign(result, this.data);
        }

        if (callback) {
            callback(result);
        }
        return Promise.resolve(result);
    }

    set(items, callback) {
        Object.assign(this.data, items);
        if (callback) {
            callback();
        }
        return Promise.resolve();
    }

    remove(keys, callback) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => {
            delete this.data[key];
        });
        if (callback) {
            callback();
        }
        return Promise.resolve();
    }

    clear(callback) {
        this.data = {};
        if (callback) {
            callback();
        }
        return Promise.resolve();
    }

    // Helper for tests to inspect storage
    _getData() {
        return JSON.parse(JSON.stringify(this.data));
    }
}

const localStorageMock = new StorageMock();
const syncStorageMock = new StorageMock();

export const storageMock = {
    local: localStorageMock,
    sync: syncStorageMock,

    // Helper to reset all storage in tests
    _reset() {
        localStorageMock.data = {};
        syncStorageMock.data = {};
    }
};
