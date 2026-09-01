/**
 * Format a timestamp string to a human-readable time (HH:MM).
 * Returns empty string on invalid input.
 */
export function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
