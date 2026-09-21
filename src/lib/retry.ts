export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  action: () => PromiseLike<T>,
  isRetryable: (result: T) => boolean,
  { attempts = 3, baseDelayMs = 400 }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    let result: T;
    try {
      result = await action();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await delay(baseDelayMs * 2 ** (attempt - 1));
      continue;
    }
    if (attempt >= attempts || !isRetryable(result)) return result;
    await delay(baseDelayMs * 2 ** (attempt - 1));
  }
}

export interface WriteResponse {
  error: { message: string } | null;
  status?: number;
}

export function retryWrite<T extends WriteResponse>(
  action: () => PromiseLike<T>,
  options?: RetryOptions,
): Promise<T> {
  return withRetry(
    action,
    (result) =>
      Boolean(result.error) &&
      (result.status == null || result.status === 0 || result.status >= 500),
    options,
  );
}
