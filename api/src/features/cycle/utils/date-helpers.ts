/**
 * Ensures that a value is converted to a Date object or null
 * Handles Date objects, ISO strings, and other date representations
 */
export const ensureDate = (date: unknown): Date | null => {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  return null;
};
