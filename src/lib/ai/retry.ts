// Retry Utility
// Exponential backoff with jitter for transient failures.
// Used by AgentEngine and Router for LLM calls.

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Check if an error is transient (retryable) vs permanent.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network errors
    if (msg.includes("econnreset") || msg.includes("econnrefused")) return true;
    if (msg.includes("etimedout") || msg.includes("socket hang up")) return true;
    // Rate limits
    if (msg.includes("429") || msg.includes("rate limit")) return true;
    // Server errors
    if (msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;
    if (msg.includes("overloaded") || msg.includes("capacity")) return true;
    // Temporary API errors
    if (msg.includes("temporary") || msg.includes("retry")) return true;
  }
  return false;
}

/**
 * Execute a function with retry logic and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: { agentId?: string; operation?: string }
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt or non-transient errors
      if (attempt >= cfg.maxRetries || !isTransientError(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        cfg.baseDelayMs * Math.pow(cfg.backoffMultiplier, attempt),
        cfg.maxDelayMs
      );

      // Add jitter (±25%)
      if (cfg.jitter) {
        const jitterRange = delay * 0.25;
        delay += (Math.random() * 2 - 1) * jitterRange;
      }

      console.warn(
        `[Retry] ${context?.operation || "operation"} failed (attempt ${attempt + 1}/${cfg.maxRetries + 1})` +
        `${context?.agentId ? ` for agent ${context.agentId}` : ""}:` +
        ` ${error instanceof Error ? error.message : String(error)}` +
        ` — retrying in ${Math.round(delay)}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Execute a function with a timeout.
 * Rejects if the function doesn't complete within timeoutMs.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${operation || "operation"} exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
