import type { HttpClientResponse } from '@effect/platform';
import { Effect, Schema as S } from 'effect';

/**
 * Schema for parsing API error responses
 */
const ErrorResponseSchema = S.Struct({
  message: S.optional(S.String),
});

/**
 * Extracts error message from unknown error types
 */
export const extractErrorMessage = (error: unknown): string =>
  'message' in (error as object) && typeof (error as { message: unknown }).message === 'string'
    ? (error as { message: string }).message
    : String(error);

export class ValidationError extends S.TaggedError<ValidationError>()('ValidationError', {
  message: S.String,
  issues: S.optional(S.Array(S.Unknown)),
}) {}

export class ServerError extends S.TaggedError<ServerError>()('ServerError', {
  message: S.String,
}) {}

export class UnauthorizedError extends S.TaggedError<UnauthorizedError>()('UnauthorizedError', {
  message: S.String,
}) {}

/**
 * Generic helper for creating error response handlers
 */
const createErrorResponseHandler = <E>(
  response: HttpClientResponse.HttpClientResponse,
  errorFactory: (message: string) => E,
  defaultMessage: string,
) =>
  response.json.pipe(
    Effect.flatMap((body) =>
      S.decodeUnknown(ErrorResponseSchema)(body).pipe(
        Effect.orElseSucceed(() => ({ message: undefined })),
        Effect.flatMap((errorData) => Effect.fail(errorFactory(errorData.message ?? defaultMessage))),
      ),
    ),
  );

export const handleUnauthorizedResponse = (
  response: HttpClientResponse.HttpClientResponse,
  defaultMessage = 'Unauthorized - invalid or expired token',
) => createErrorResponseHandler(response, (message) => new UnauthorizedError({ message }), defaultMessage);

export const handleValidationErrorResponse = (
  response: HttpClientResponse.HttpClientResponse,
  defaultMessage = 'Validation error',
) => createErrorResponseHandler(response, (message) => new ValidationError({ message }), defaultMessage);

export const handleServerErrorResponse = (response: HttpClientResponse.HttpClientResponse, defaultMessage?: string) =>
  createErrorResponseHandler(
    response,
    (message) => new ServerError({ message }),
    defaultMessage ?? `Server error: ${response.status}`,
  );
