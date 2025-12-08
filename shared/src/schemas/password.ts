import { Schema as S } from 'effect';

/**
 * Password validation rules
 */
export const PASSWORD_RULES = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 100,
  LOWERCASE: /[a-z]/,
  UPPERCASE: /[A-Z]/,
  DIGIT: /\d/,
  SPECIAL: /[^A-Za-z0-9\s]/,
  NO_WHITESPACE: /^\S*$/,
} as const;

/**
 * Password validation error messages
 */
export const PASSWORD_MESSAGES = {
  MIN_LENGTH: 'Password must be at least 8 characters',
  MAX_LENGTH: 'Password must be at most 100 characters long',
  LOWERCASE: 'Password must contain at least 1 lowercase letter',
  UPPERCASE: 'Password must contain at least 1 uppercase letter',
  DIGIT: 'Password must contain at least 1 number',
  SPECIAL: 'Password must contain at least 1 special character (e.g., %, &, $, !, @)',
  NO_WHITESPACE: 'Password cannot contain leading or trailing whitespace',
} as const;

/**
 * Validates a password against all rules and returns the first error message if invalid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.MIN_LENGTH) return PASSWORD_MESSAGES.MIN_LENGTH;
  if (password.length > PASSWORD_RULES.MAX_LENGTH) return PASSWORD_MESSAGES.MAX_LENGTH;
  if (!PASSWORD_RULES.LOWERCASE.test(password)) return PASSWORD_MESSAGES.LOWERCASE;
  if (!PASSWORD_RULES.UPPERCASE.test(password)) return PASSWORD_MESSAGES.UPPERCASE;
  if (!PASSWORD_RULES.DIGIT.test(password)) return PASSWORD_MESSAGES.DIGIT;
  if (!PASSWORD_RULES.SPECIAL.test(password)) return PASSWORD_MESSAGES.SPECIAL;
  if (!PASSWORD_RULES.NO_WHITESPACE.test(password)) return PASSWORD_MESSAGES.NO_WHITESPACE;
  return null;
}

/**
 * Reusable password schema for new/updated passwords.
 * Note: For frontend forms with vee-validate + Schema.Struct, use validatePassword()
 * inline with Schema.filter to maintain proper type inference.
 */
export const PasswordSchema = S.String.pipe(
  S.minLength(PASSWORD_RULES.MIN_LENGTH, { message: () => PASSWORD_MESSAGES.MIN_LENGTH }),
  S.maxLength(PASSWORD_RULES.MAX_LENGTH, { message: () => PASSWORD_MESSAGES.MAX_LENGTH }),
  S.filter((password) => PASSWORD_RULES.LOWERCASE.test(password), {
    message: () => PASSWORD_MESSAGES.LOWERCASE,
  }),
  S.filter((password) => PASSWORD_RULES.UPPERCASE.test(password), {
    message: () => PASSWORD_MESSAGES.UPPERCASE,
  }),
  S.filter((password) => PASSWORD_RULES.DIGIT.test(password), {
    message: () => PASSWORD_MESSAGES.DIGIT,
  }),
  S.filter((password) => PASSWORD_RULES.SPECIAL.test(password), {
    message: () => PASSWORD_MESSAGES.SPECIAL,
  }),
  S.filter((password) => PASSWORD_RULES.NO_WHITESPACE.test(password), {
    message: () => PASSWORD_MESSAGES.NO_WHITESPACE,
  }),
);
