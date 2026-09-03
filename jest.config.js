// @ts-nocheck

/** @type {import('jest').Config} */
const config = {
    roots: ['<rootDir>'],
    transform: {
        '^.+\\.ts?$': ['ts-jest', {
            tsconfig: {
                target: 'ES2022',
                lib: ['ES2022'],
                types: ['jest', 'node'],
            },
        }],
    },
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts?$',
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    collectCoverage: true,
    clearMocks: true,
    coverageDirectory: 'coverage',
    testEnvironment: 'node',
}

module.exports = config
