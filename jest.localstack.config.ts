import type { Config } from 'jest';

/**
 * Tests that talk to a real LocalStack SQS (`docker compose up -d --wait
 * localstack` first). Kept out of `npm test` and CI, which have no LocalStack.
 *
 * Standalone rather than importing jest.config.ts: Jest may load TS configs as
 * ES modules, where an extensionless relative import doesn't resolve.
 * Keep the transform settings in sync with jest.config.ts.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/localstack'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: false }],
    '^.+\\.js$': ['ts-jest', { useESM: false }],
  },
  testTimeout: 60_000,
  verbose: true,
};

export default config;
