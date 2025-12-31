import type { HttpClientError } from '@effect/platform';
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';

/**
 * API Base URL Configuration
 *
 * For development with Android emulator:
 * Run: adb reverse tcp:3000 tcp:3000
 * This forwards the emulator's localhost:3000 to the host's localhost:3000
 *
 * For production: Set VITE_API_BASE_URL environment variable
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * HttpClient Layer
 */
export const HttpClientLive = FetchHttpClient.layer;

/**
 * Export HttpClient and utilities for use in services
 */
export { HttpClient, HttpClientRequest, HttpClientResponse };
export type { HttpClientError };
