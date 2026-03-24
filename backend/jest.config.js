module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'services/**/*.js',
        'middleware/**/*.js',
        'routes/**/*.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    verbose: true,
    testTimeout: 10000,
    setupFilesAfterEnv: ['./tests/setup.js'],
    modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid')
    }
};
