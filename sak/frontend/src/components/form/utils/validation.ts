/**
 * Generic validation utilities
 */

/**
 * Check if a value is empty (null, undefined, empty string, or empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Validate that a required field is not empty
 */
export function validateRequired(value: unknown, fieldName: string): string | null {
  if (isEmpty(value)) {
    return `${fieldName} es requerido`;
  }
  return null;
}

/**
 * Validate that a number is within a range
 */
export function validateRange(
  value: number,
  min: number | null,
  max: number | null,
  fieldName: string
): string | null {
  if (min !== null && value < min) {
    return `${fieldName} debe ser mayor o igual a ${min}`;
  }
  if (max !== null && value > max) {
    return `${fieldName} debe ser menor o igual a ${max}`;
  }
  return null;
}

/**
 * Validate that a string matches a pattern
 */
export function validatePattern(
  value: string,
  pattern: RegExp,
  fieldName: string,
  message?: string
): string | null {
  if (!pattern.test(value)) {
    return message || `${fieldName} tiene un formato inválido`;
  }
  return null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string | null {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return validatePattern(email, emailPattern, "Email", "Email inválido");
}
