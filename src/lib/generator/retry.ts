/**
 * Retry wrapper for LLM generation with error feedback.
 *
 * On failure, appends the error message to the prompt so the LLM
 * can learn from its mistake on the next attempt.
 */

export async function retryWithFeedback<T>(
  fn: (attempt: number, previousError?: string) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt, lastError);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`Attempt ${attempt}/${maxAttempts} failed:`, lastError);

      if (attempt === maxAttempts) {
        throw new Error(
          `Failed after ${maxAttempts} attempts. Last error: ${lastError}`
        );
      }
    }
  }

  // TypeScript requires this, but it's unreachable
  throw new Error("Unreachable");
}
