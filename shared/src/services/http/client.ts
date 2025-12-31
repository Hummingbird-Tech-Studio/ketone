import type { HttpClientError } from '@effect/platform';
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';

/**
 * Base HttpClient Layer using Fetch
 */
export const HttpClientLive = FetchHttpClient.layer;

/**
 * Re-export HttpClient utilities for use in services
 */
export { HttpClient, HttpClientRequest, HttpClientResponse };
export type { HttpClientError };
