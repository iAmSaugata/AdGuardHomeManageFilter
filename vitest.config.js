import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json', 'lcov'],
            include: ['background/**/*.js', 'popup/**/*.js'],
            exclude: [
                'tests/**',
                '**/*.test.js',
                '**/node_modules/**',
                'popup/views/server-list-temp.js',
                'popup/views/server-list.backup.js'
            ],
            thresholds: {
                global: {
                    statements: 60,
                    branches: 55,
                    functions: 60,
                    lines: 60
                },
                // Critical files need higher coverage
                'background/crypto.js': {
                    statements: 95,
                    branches: 90,
                    functions: 95,
                    lines: 95
                },
                'background/helpers.js': {
                    statements: 90,
                    branches: 85,
                    functions: 90,
                    lines: 90
                },
                'background/storage.js': {
                    statements: 85,
                    branches: 80,
                    functions: 85,
                    lines: 85
                }
            }
        },
        include: ['tests/**/*.test.js'],
        testTimeout: 10000,
        hookTimeout: 10000
    }
});
