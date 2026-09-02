/**
 * Format a timestamp string to a human-readable date + time.
 * Example: "Sep 1, 16:14"
 * Returns empty string on invalid input.
 */
export function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return time;

    const datePart = date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    return `${datePart} ${time}`;
  } catch {
    return "";
  }
}
