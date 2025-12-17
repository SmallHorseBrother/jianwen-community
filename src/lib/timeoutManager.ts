/**
 * Timeout Manager
 * 
 * Provides timeout protection for async operations to prevent the application
 * from hanging indefinitely on slow or failed network requests.
 */

/**
 * Timeout configuration for different operation types
 */
export const TIMEOUT_CONFIG = {
  LOGIN: 10000,          // 10 seconds for login operations
  PROFILE_LOAD: 10000,   // 10 seconds for profile loading
  INITIALIZATION: 10000, // 10 seconds for app initialization
} as const;

/**
 * Custom error class for timeout errors
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly operationName: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve/reject
 * within the specified time, it will be rejected with a TimeoutError.
 * 
 * @param promise - The promise to wrap with timeout protection
 * @param timeoutMs - Timeout duration in milliseconds
 * @param operationName - Name of the operation for error messages and logging
 * @returns Promise that resolves/rejects with the original promise or times out
 * 
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetchUserData(userId),
 *   5000,
 *   'fetchUserData'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  // Create an AbortController for potential cancellation
  const controller = new AbortController();
  
  // Create timeout promise that rejects after specified time
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      const error = new TimeoutError(
        `Operation "${operationName}" timed out after ${timeoutMs}ms`,
        operationName,
        timeoutMs
      );
      
      // Log timeout for debugging
      console.warn(
        `[TimeoutManager] Timeout occurred:`,
        {
          operation: operationName,
          timeout: timeoutMs,
          timestamp: new Date().toISOString(),
        }
      );
      
      reject(error);
    }, timeoutMs);
    
    // Clean up timeout if promise resolves first
    promise.finally(() => clearTimeout(timeoutId));
  });
  
  // Race between the actual promise and the timeout
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Wraps a promise with timeout and provides a fallback value on timeout
 * 
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout duration in milliseconds
 * @param operationName - Name of the operation
 * @param fallbackValue - Value to return on timeout
 * @returns Promise that resolves with result or fallback value
 */
export async function withTimeoutAndFallback<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
  fallbackValue: T
): Promise<T> {
  try {
    return await withTimeout(promise, timeoutMs, operationName);
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.warn(
        `[TimeoutManager] Using fallback value for "${operationName}"`,
        { fallbackValue }
      );
      return fallbackValue;
    }
    throw error;
  }
}

/**
 * Creates a cancellable promise wrapper with timeout
 * Returns both the promise and a cancel function
 * 
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout duration in milliseconds
 * @param operationName - Name of the operation
 * @returns Object with promise and cancel function
 */
export function withCancellableTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): { promise: Promise<T>; cancel: () => void } {
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;
  
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new TimeoutError(
          `Operation "${operationName}" timed out after ${timeoutMs}ms`,
          operationName,
          timeoutMs
        )
      );
    }, timeoutMs);
    
    promise
      .then((result) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
  });
  
  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    controller.abort();
  };
  
  return { promise: wrappedPromise, cancel };
}

/**
 * Checks if an error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Gets a user-friendly error message for timeout errors
 */
export function getTimeoutErrorMessage(error: unknown): string {
  if (isTimeoutError(error)) {
    return '网络连接超时，请检查网络后重试';
  }
  return '操作失败，请稍后重试';
}
