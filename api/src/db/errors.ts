import { Array, Option } from 'effect';

export const PgErrorCode = {
  UNIQUE_VIOLATION: '23505',
  EXCLUSION_VIOLATION: '23P01',
  CHECK_VIOLATION: '23514',
} as const;

export type PgErrorCode = (typeof PgErrorCode)[keyof typeof PgErrorCode];

export interface PgError {
  readonly code: string;
  readonly message?: string;
}

/**
 * Generates a chain of causes from an error object.
 * Traverses the error.cause chain until no more causes are found.
 * Returns an array: [error, error.cause, error.cause.cause, ...]
 */
export const getErrorCauseChain = (error: unknown): unknown[] =>
  Array.unfold(error, (currentError) =>
    currentError
      ? Option.some([
          currentError,
          typeof currentError === 'object' && currentError !== null && 'cause' in currentError
            ? (currentError as { cause: unknown }).cause
            : undefined,
        ])
      : Option.none(),
  );

/**
 * Type guard for PostgreSQL errors with a code property.
 */
export const isPgError = (err: unknown): err is PgError =>
  typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string';

/**
 * Finds a PostgreSQL error with the specified code in the error cause chain.
 */
export const findPgError = (error: unknown, code: PgErrorCode): Option.Option<PgError> =>
  Array.findFirst(getErrorCauseChain(error), (err): err is PgError => isPgError(err) && err.code === code);

/**
 * Checks if an error or any of its causes is a PostgreSQL unique constraint violation (23505).
 */
export const isUniqueViolation = (error: unknown): boolean =>
  Option.isSome(findPgError(error, PgErrorCode.UNIQUE_VIOLATION));

/**
 * Checks if an error or any of its causes is a PostgreSQL exclusion constraint violation (23P01).
 */
export const isExclusionViolation = (error: unknown): boolean =>
  Option.isSome(findPgError(error, PgErrorCode.EXCLUSION_VIOLATION));

/**
 * Checks if an error or any of its causes is a PostgreSQL check constraint violation (23514).
 */
export const isCheckViolation = (error: unknown): boolean =>
  Option.isSome(findPgError(error, PgErrorCode.CHECK_VIOLATION));
