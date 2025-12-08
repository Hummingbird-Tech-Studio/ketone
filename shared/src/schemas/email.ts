import { Schema as S } from 'effect';

/**
 * Email validation regex pattern
 */
export const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

/**
 * Email validation error messages
 */
export const EMAIL_MESSAGES = {
  MAX_LENGTH: 'Email must be at most 255 characters long',
  INVALID_FORMAT: 'Invalid email format',
  CONSECUTIVE_DOTS: 'Email cannot contain consecutive dots',
  DOT_BEFORE_AT: 'Email cannot have a dot immediately before @',
  STARTS_WITH_DOT: 'Email cannot start with a dot',
} as const;

/**
 * Validates an email against all rules and returns the first error message if invalid.
 */
export function validateEmail(email: string): string | null {
  if (email.length > 255) return EMAIL_MESSAGES.MAX_LENGTH;
  if (!EMAIL_REGEX.test(email)) return EMAIL_MESSAGES.INVALID_FORMAT;
  if (email.includes('..')) return EMAIL_MESSAGES.CONSECUTIVE_DOTS;
  if (email.includes('.@')) return EMAIL_MESSAGES.DOT_BEFORE_AT;
  if (email.startsWith('.')) return EMAIL_MESSAGES.STARTS_WITH_DOT;
  return null;
}

/**
 * Reusable email validation schema.
 * Note: For frontend forms with vee-validate + Schema.Struct, use validateEmail()
 * inline with Schema.filter to maintain proper type inference.
 */
export const EmailSchema = S.String.pipe(
  S.maxLength(255, { message: () => EMAIL_MESSAGES.MAX_LENGTH }),
  S.filter((email) => EMAIL_REGEX.test(email), { message: () => EMAIL_MESSAGES.INVALID_FORMAT }),
  S.filter((email) => !email.includes('..'), { message: () => EMAIL_MESSAGES.CONSECUTIVE_DOTS }),
  S.filter((email) => !email.includes('.@'), { message: () => EMAIL_MESSAGES.DOT_BEFORE_AT }),
  S.filter((email) => !email.startsWith('.'), { message: () => EMAIL_MESSAGES.STARTS_WITH_DOT }),
);
