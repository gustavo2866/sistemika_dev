/**
 * Generic string manipulation utilities
 */

/**
 * Truncate a string to a maximum length, adding ellipsis if needed
 */
export function truncateString(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Capitalize the first letter of a string
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Format a string for display (trim and normalize whitespace)
 */
export function normalizeString(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
