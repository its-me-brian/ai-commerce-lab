// Security Utilities
// FASE 43: Input sanitization, rate limiting, and validation helpers.

/**
 * Sanitize a string to prevent XSS.
 * Strips HTML tags and encodes special characters.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")           // strip HTML tags
    .replace(/[<>"'&]/g, (ch) => {     // encode remaining dangerous chars
      const map: Record<string, string> = {
        "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;",
      };
      return map[ch] || ch;
    })
    .trim();
}

/**
 * Sanitize an object recursively (all string values).
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value.map((v) =>
        typeof v === "string" ? sanitizeInput(v) : v
      );
    }
  }
  return result;
}

/**
 * Validate that a string looks like a valid agent ID (alphanumeric + hyphens only).
 */
export function isValidAgentId(id: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) && id.length <= 100;
}

/**
 * Validate JSON input size (prevent DoS via huge payloads).
 */
export function isAcceptableSize(data: unknown, maxBytes: number = 100_000): boolean {
  try {
    const serialized = JSON.stringify(data);
    return Buffer.byteLength(serialized, "utf8") <= maxBytes;
  } catch {
    return false;
  }
}

/**
 * Sanitize a parsed request body — encodes all string values to prevent XSS.
 * Use after request.json() in API handlers.
 */
export function sanitizeBody<T extends Record<string, unknown>>(body: T): T {
  return sanitizeObject(body);
}

/**
 * Validate workspace ID format.
 * Workspace IDs must be: ws-{alphanumeric}-{timestamp} or ws-default.
 * Prevents injection of arbitrary IDs.
 */
export function isValidWorkspaceId(id: string): boolean {
  return /^ws-[a-z0-9]+-\d{13,}$/.test(id) || id === "ws-default";
}
