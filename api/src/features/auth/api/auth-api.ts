import { HttpApi, HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import {
  InvalidCredentialsErrorSchema,
  JwtGenerationErrorSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  PasswordHashErrorSchema,
  SignupRequestSchema,
  SignupResponseSchema,
  UserAlreadyExistsErrorSchema,
  UserRepositoryErrorSchema,
} from './schemas';

/**
 * Auth API Contract definition
 */

export class AuthApiGroup extends HttpApiGroup.make('auth')
  .add(
    // POST /auth/signup - Create new user account
    HttpApiEndpoint.post('signup', '/auth/signup')
      .setPayload(SignupRequestSchema)
      .addSuccess(SignupResponseSchema)
      .addError(UserAlreadyExistsErrorSchema)
      .addError(UserRepositoryErrorSchema)
      .addError(PasswordHashErrorSchema),
  )
  .add(
    // POST /auth/login - Authenticate user and generate JWT token
    HttpApiEndpoint.post('login', '/auth/login')
      .setPayload(LoginRequestSchema)
      .addSuccess(LoginResponseSchema)
      .addError(InvalidCredentialsErrorSchema)
      .addError(UserRepositoryErrorSchema)
      .addError(PasswordHashErrorSchema)
      .addError(JwtGenerationErrorSchema),
  ) {}

export class AuthApi extends HttpApi.make('auth-api').add(AuthApiGroup) {}
