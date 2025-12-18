import { Schema as S } from 'effect';

/**
 * Schema for IANA timezone identifiers (e.g., "America/New_York", "Europe/London")
 * Used for timezone-aware date calculations in statistics.
 */
export const TimezoneSchema = S.String.pipe(
  S.pattern(/^[A-Za-z_]+\/[A-Za-z_]+/, {
    message: () => 'Invalid timezone format. Expected IANA timezone (e.g., America/New_York)',
  }),
);
