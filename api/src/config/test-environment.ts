/**
 * Test Environment Configuration
 * Shared configuration constants for integration tests and test utilities
 */

/**
 * API server base URL for integration tests
 * Can be overridden via API_BASE_URL environment variable
 * Default: http://localhost:3000
 */
export const API_BASE_URL = Bun.env.API_BASE_URL || 'http://localhost:3000';

/**
 * Orleans sidecar base URL for integration tests
 * Can be overridden via ORLEANS_BASE_URL environment variable
 * Default: http://localhost:5174
 */
export const ORLEANS_BASE_URL = Bun.env.ORLEANS_BASE_URL || 'http://localhost:5174';
