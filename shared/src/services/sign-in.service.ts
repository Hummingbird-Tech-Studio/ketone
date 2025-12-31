import type { HttpBodyError } from '@effect/platform/HttpBody';
import type { HttpClientError as PlatformHttpClientError } from '@effect/platform/HttpClientError';
import { Effect, Match, Schema as S } from 'effect';
import { LoginResponseSchema } from '../schemas/auth';
import { HttpClient, HttpClientRequest, HttpClientResponse } from './http/client';
import { extractErrorMessage, ServerError, ValidationError } from './http/errors';

/**
 * HTTP Status codes
 */
const HttpStatus = {
  Ok: 200,
  BadRequest: 400,
  Unauthorized: 401,
} as const;

/**
 * Error response schema for parsing API errors
 */
const ErrorResponseSchema = S.Struct({
  message: S.optional(S.String),
});

/**
 * Sign-In Specific Error Types
 */
export class InvalidCredentialsError extends S.TaggedError<InvalidCredentialsError>()('InvalidCredentialsError', {
  message: S.String,
}) {}

/**
 * Response Types
 */
export type SignInServiceSuccess = S.Schema.Type<typeof LoginResponseSchema>;
export type SignInServiceError =
  | PlatformHttpClientError
  | HttpBodyError
  | ValidationError
  | InvalidCredentialsError
  | ServerError;

/**
 * Handle sign-in response based on status code
 */
const handleSignInResponse = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<SignInServiceSuccess, SignInServiceError> =>
  Match.value(response.status).pipe(
    Match.when(HttpStatus.Ok, () =>
      HttpClientResponse.schemaBodyJson(LoginResponseSchema)(response).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              message: 'Invalid response from server',
              issues: [error],
            }),
        ),
      ),
    ),
    Match.when(HttpStatus.Unauthorized, () =>
      response.json.pipe(
        Effect.flatMap((body) =>
          S.decodeUnknown(ErrorResponseSchema)(body).pipe(
            Effect.orElseSucceed(() => ({ message: undefined })),
            Effect.flatMap((errorData) =>
              Effect.fail(
                new InvalidCredentialsError({
                  message: errorData.message ?? 'Invalid email or password',
                }),
              ),
            ),
          ),
        ),
      ),
    ),
    Match.when(HttpStatus.BadRequest, () =>
      response.json.pipe(
        Effect.flatMap((body) =>
          S.decodeUnknown(ErrorResponseSchema)(body).pipe(
            Effect.orElseSucceed(() => ({ message: undefined })),
            Effect.flatMap((errorData) =>
              Effect.fail(
                new ValidationError({
                  message: errorData.message ?? 'Invalid email or password',
                }),
              ),
            ),
          ),
        ),
      ),
    ),
    Match.orElse(() =>
      response.json.pipe(
        Effect.flatMap((body) =>
          S.decodeUnknown(ErrorResponseSchema)(body).pipe(
            Effect.orElseSucceed(() => ({ message: undefined })),
            Effect.flatMap((errorData) =>
              Effect.fail(
                new ServerError({
                  message: errorData.message ?? `Server error: ${response.status}`,
                }),
              ),
            ),
          ),
        ),
      ),
    ),
  );

/**
 * Factory to create a sign-in program with the given API base URL
 * Returns an Effect that requires HttpClient to be provided
 */
export const createSignInProgram =
  (apiBaseUrl: string) =>
  (email: string, password: string): Effect.Effect<SignInServiceSuccess, SignInServiceError, HttpClient.HttpClient> =>
    Effect.gen(function* () {
      const defaultClient = yield* HttpClient.HttpClient;
      const client = defaultClient.pipe(HttpClient.mapRequest(HttpClientRequest.prependUrl(apiBaseUrl)));

      const request = yield* HttpClientRequest.post('/auth/login').pipe(HttpClientRequest.bodyJson({ email, password }));

      const response = yield* client.execute(request).pipe(Effect.scoped);

      return yield* handleSignInResponse(response);
    }).pipe(
      Effect.tapError((error) => Effect.logError('Sign in failed', { cause: extractErrorMessage(error) })),
      Effect.annotateLogs({ service: 'SignInService' }),
    );
