/**
 * Generic error handling utilities
 */

/**
 * Extract a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown, defaultMessage: string = "Error desconocido"): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return defaultMessage;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("fetch") || 
           error.message.includes("network") ||
           error.message.includes("Failed to fetch");
  }
  return false;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: Record<string, string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
    .join("\n");
}
