/**
 * HTTP Status Codes
 */
export const HttpStatus = {
  Ok: 200,
  Created: 201,
  NoContent: 204,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  TooManyRequests: 429,
  InternalServerError: 500,
} as const;

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
