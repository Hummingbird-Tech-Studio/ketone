import { HttpApiBuilder, HttpServerRequest } from '@effect/platform';
import { Effect } from 'effect';
import { Api } from '../../../api';
import { UserAccountService } from '../services';
import {
  InvalidPasswordErrorSchema,
  TooManyRequestsErrorSchema,
  SameEmailErrorSchema,
  EmailAlreadyInUseErrorSchema,
  UserAccountServiceErrorSchema,
} from './schemas';
import { CurrentUser } from '../../auth/api/middleware';

const getClientIp = (request: HttpServerRequest.HttpServerRequest): string => {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const firstIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return firstIp?.trim() || 'unknown';
  }
  return request.headers['x-real-ip'] || 'unknown';
};

export const UserAccountApiLive = HttpApiBuilder.group(Api, 'user-account', (handlers) =>
  Effect.gen(function* () {
    const userAccountService = yield* UserAccountService;

    return handlers.handle('updateEmail', ({ payload }) =>
      Effect.gen(function* () {
        const currentUser = yield* CurrentUser;
        const userId = currentUser.userId;
        const request = yield* HttpServerRequest.HttpServerRequest;
        const ip = getClientIp(request);

        yield* Effect.logInfo(`[Handler] PUT /api/v1/account/email - Request received for user ${userId} from IP ${ip}`);

        const result = yield* userAccountService.updateEmail(userId, payload.email, payload.password, ip).pipe(
          Effect.tapError((error) => Effect.logError(`[Handler] Error updating email: ${error._tag}`)),
          Effect.catchTags({
            TooManyRequestsError: (error) =>
              Effect.fail(
                new TooManyRequestsErrorSchema({
                  message: error.message,
                  remainingAttempts: error.remainingAttempts,
                  retryAfter: error.retryAfter,
                }),
              ),
            InvalidPasswordError: (error) =>
              Effect.fail(
                new InvalidPasswordErrorSchema({
                  message: error.message,
                  remainingAttempts: error.remainingAttempts,
                }),
              ),
            SameEmailError: (error) =>
              Effect.fail(
                new SameEmailErrorSchema({
                  message: error.message,
                }),
              ),
            EmailAlreadyInUseError: (error) =>
              Effect.fail(
                new EmailAlreadyInUseErrorSchema({
                  message: error.message,
                  email: error.email,
                }),
              ),
            UserAccountServiceError: (error) =>
              Effect.fail(
                new UserAccountServiceErrorSchema({
                  message: error.message,
                  cause: error.cause,
                }),
              ),
            UserRepositoryError: (error) =>
              Effect.fail(
                new UserAccountServiceErrorSchema({
                  message: error.message,
                  cause: error.cause,
                }),
              ),
            PasswordHashError: (error) =>
              Effect.fail(
                new UserAccountServiceErrorSchema({
                  message: error.message,
                  cause: error.cause,
                }),
              ),
          }),
        );

        yield* Effect.logInfo(`[Handler] Email updated successfully for user ${userId}`);
        return result;
      }),
    );
  }),
);
