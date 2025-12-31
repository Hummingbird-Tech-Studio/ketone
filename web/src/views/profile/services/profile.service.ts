import {
  extractErrorMessage,
  handleServerErrorResponse,
  handleUnauthorizedResponse,
  ServerError,
  UnauthorizedError,
  ValidationError,
} from '@/services/http/errors';
import {
  API_BASE_URL,
  AuthenticatedHttpClient,
  AuthenticatedHttpClientLive,
  HttpClientLive,
  HttpClientRequest,
  HttpClientResponse,
  HttpClientWith401Interceptor,
} from '@/services/http/http-client.service';
import { HttpStatus } from '@/shared/constants/http-status';
import type { HttpBodyError } from '@effect/platform/HttpBody';
import type { HttpClientError } from '@effect/platform/HttpClientError';
import {
  type Gender,
  type HeightUnit,
  NullablePhysicalInfoResponseSchema,
  NullableProfileResponseSchema,
  PhysicalInfoResponseSchema,
  ProfileResponseSchema,
  type WeightUnit,
} from '@ketone/shared';
import { Effect, Layer, Match, Schema as S } from 'effect';

/**
 * Response Types
 */
export type GetProfileSuccess = S.Schema.Type<typeof NullableProfileResponseSchema>;
export type GetProfileError = HttpClientError | HttpBodyError | ValidationError | UnauthorizedError | ServerError;

export type SaveProfileSuccess = S.Schema.Type<typeof ProfileResponseSchema>;
export type SaveProfileError = HttpClientError | HttpBodyError | ValidationError | UnauthorizedError | ServerError;

export type GetPhysicalInfoSuccess = S.Schema.Type<typeof NullablePhysicalInfoResponseSchema>;
export type GetPhysicalInfoError = HttpClientError | HttpBodyError | ValidationError | UnauthorizedError | ServerError;

export type SavePhysicalInfoSuccess = S.Schema.Type<typeof PhysicalInfoResponseSchema>;
export type SavePhysicalInfoError = HttpClientError | HttpBodyError | ValidationError | UnauthorizedError | ServerError;

export type SavePhysicalInfoPayload = {
  weight?: number | null;
  height?: number | null;
  gender?: Gender | null;
  weightUnit?: WeightUnit | null;
  heightUnit?: HeightUnit | null;
};

/**
 * Handle Get Profile Response
 */
const handleGetProfileResponse = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<GetProfileSuccess, GetProfileError> =>
  Match.value(response.status).pipe(
    Match.when(HttpStatus.Ok, () =>
      HttpClientResponse.schemaBodyJson(NullableProfileResponseSchema)(response).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              message: 'Invalid response from server',
              issues: [error],
            }),
        ),
      ),
    ),
    Match.when(HttpStatus.Unauthorized, () => handleUnauthorizedResponse(response)),
    Match.orElse(() => handleServerErrorResponse(response)),
  );

/**
 * Handle Save Profile Response
 */
const handleSaveProfileResponse = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<SaveProfileSuccess, SaveProfileError> =>
  Match.value(response.status).pipe(
    Match.when(HttpStatus.Ok, () =>
      HttpClientResponse.schemaBodyJson(ProfileResponseSchema)(response).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              message: 'Invalid response from server',
              issues: [error],
            }),
        ),
      ),
    ),
    Match.when(HttpStatus.Unauthorized, () => handleUnauthorizedResponse(response)),
    Match.orElse(() => handleServerErrorResponse(response)),
  );

/**
 * Handle Get Physical Info Response
 */
const handleGetPhysicalInfoResponse = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<GetPhysicalInfoSuccess, GetPhysicalInfoError> =>
  Match.value(response.status).pipe(
    Match.when(HttpStatus.Ok, () =>
      HttpClientResponse.schemaBodyJson(NullablePhysicalInfoResponseSchema)(response).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              message: 'Invalid response from server',
              issues: [error],
            }),
        ),
      ),
    ),
    Match.when(HttpStatus.Unauthorized, () => handleUnauthorizedResponse(response)),
    Match.orElse(() => handleServerErrorResponse(response)),
  );

/**
 * Handle Save Physical Info Response
 */
const handleSavePhysicalInfoResponse = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<SavePhysicalInfoSuccess, SavePhysicalInfoError> =>
  Match.value(response.status).pipe(
    Match.when(HttpStatus.Ok, () =>
      HttpClientResponse.schemaBodyJson(PhysicalInfoResponseSchema)(response).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              message: 'Invalid response from server',
              issues: [error],
            }),
        ),
      ),
    ),
    Match.when(HttpStatus.Unauthorized, () => handleUnauthorizedResponse(response)),
    Match.orElse(() => handleServerErrorResponse(response)),
  );

/**
 * Profile Service
 */
export class ProfileService extends Effect.Service<ProfileService>()('ProfileService', {
  effect: Effect.gen(function* () {
    const authenticatedClient = yield* AuthenticatedHttpClient;

    return {
      /**
       * Get user profile
       * @returns Profile data or null if not found
       */
      getProfile: (): Effect.Effect<GetProfileSuccess, GetProfileError> =>
        HttpClientRequest.get(`${API_BASE_URL}/v1/profile`).pipe(
          (request) => authenticatedClient.execute(request),
          Effect.scoped,
          Effect.flatMap(handleGetProfileResponse),
        ),

      /**
       * Save (create or update) user profile
       * @param data - Profile data to save
       */
      saveProfile: (data: {
        name?: string | null;
        dateOfBirth?: string | null;
      }): Effect.Effect<SaveProfileSuccess, SaveProfileError> =>
        HttpClientRequest.put(`${API_BASE_URL}/v1/profile`).pipe(
          HttpClientRequest.bodyJson(data),
          Effect.flatMap((request) => authenticatedClient.execute(request)),
          Effect.scoped,
          Effect.flatMap(handleSaveProfileResponse),
        ),

      /**
       * Get user physical info
       * @returns Physical info data or null if not found
       */
      getPhysicalInfo: (): Effect.Effect<GetPhysicalInfoSuccess, GetPhysicalInfoError> =>
        HttpClientRequest.get(`${API_BASE_URL}/v1/profile/physical`).pipe(
          (request) => authenticatedClient.execute(request),
          Effect.scoped,
          Effect.flatMap(handleGetPhysicalInfoResponse),
        ),

      /**
       * Save (create or update) user physical info
       * @param data - Physical info data to save
       */
      savePhysicalInfo: (
        data: SavePhysicalInfoPayload,
      ): Effect.Effect<SavePhysicalInfoSuccess, SavePhysicalInfoError> =>
        HttpClientRequest.put(`${API_BASE_URL}/v1/profile/physical`).pipe(
          HttpClientRequest.bodyJson(data),
          Effect.flatMap((request) => authenticatedClient.execute(request)),
          Effect.scoped,
          Effect.flatMap(handleSavePhysicalInfoResponse),
        ),
    };
  }),
  dependencies: [AuthenticatedHttpClient.Default],
  accessors: true,
}) {}

/**
 * Live implementation of ProfileService
 */
export const ProfileServiceLive = ProfileService.Default.pipe(
  Layer.provide(AuthenticatedHttpClientLive),
  Layer.provide(HttpClientWith401Interceptor),
  Layer.provide(HttpClientLive),
);

/**
 * Program to get user profile
 */
export const programGetProfile = () =>
  ProfileService.getProfile().pipe(
    Effect.tapError((error) => Effect.logError('Failed to get profile', { cause: extractErrorMessage(error) })),
    Effect.annotateLogs({ service: 'ProfileService' }),
    Effect.provide(ProfileServiceLive),
  );

/**
 * Program to save user profile
 */
export const programSaveProfile = (data: { name?: string | null; dateOfBirth?: string | null }) =>
  ProfileService.saveProfile(data).pipe(
    Effect.tapError((error) => Effect.logError('Failed to save profile', { cause: extractErrorMessage(error) })),
    Effect.annotateLogs({ service: 'ProfileService' }),
    Effect.provide(ProfileServiceLive),
  );

/**
 * Program to get user physical info
 */
export const programGetPhysicalInfo = () =>
  ProfileService.getPhysicalInfo().pipe(
    Effect.tapError((error) => Effect.logError('Failed to get physical info', { cause: extractErrorMessage(error) })),
    Effect.annotateLogs({ service: 'ProfileService' }),
    Effect.provide(ProfileServiceLive),
  );

/**
 * Program to save user physical info
 */
export const programSavePhysicalInfo = (data: SavePhysicalInfoPayload) =>
  ProfileService.savePhysicalInfo(data).pipe(
    Effect.tapError((error) => Effect.logError('Failed to save physical info', { cause: extractErrorMessage(error) })),
    Effect.annotateLogs({ service: 'ProfileService' }),
    Effect.provide(ProfileServiceLive),
  );
