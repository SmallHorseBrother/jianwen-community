/**
 * Enhanced Authentication Logger
 * 
 * Provides structured logging for authentication operations with
 * conditional logging based on environment.
 */

import { AuthStatus } from '../types/authState';

/**
 * Log levels
 */
export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Should log based on environment
 */
const shouldLog = (): boolean => {
  // Always log in development
  if (import.meta.env.DEV) {
    return true;
  }
  
  // In production, only log warnings and errors
  return false;
};

/**
 * Logs the start of an authentication operation
 */
export function logOperationStart(operationName: string, details?: Record<string, any>): void {
  if (!shouldLog()) return;
  
  console.log('[Auth] Operation started:', {
    operation: operationName,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Logs an authentication state change
 */
export function logStateChange(
  previousState: AuthStatus,
  newState: AuthStatus,
  reason: string,
  details?: Record<string, any>
): void {
  if (!shouldLog()) return;
  
  console.log('[Auth] State change:', {
    from: previousState,
    to: newState,
    reason,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Logs an authentication error
 */
export function logError(
  error: Error | unknown,
  context: string,
  details?: Record<string, any>
): void {
  // Always log errors, even in production
  const errorInfo = error instanceof Error
    ? {
        type: error.name,
        message: error.message,
        stack: error.stack,
      }
    : {
        type: 'Unknown',
        message: String(error),
      };
  
  console.error('[Auth] Error:', {
    context,
    error: errorInfo,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Logs a network request
 */
export function logNetworkRequest(
  requestType: string,
  endpoint: string,
  status?: 'pending' | 'success' | 'error',
  details?: Record<string, any>
): void {
  if (!shouldLog()) return;
  
  console.log('[Auth] Network request:', {
    type: requestType,
    endpoint,
    status,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Logs a cache operation
 */
export function logCacheOperation(
  operation: 'read' | 'write' | 'clear' | 'validate',
  keys: string[],
  result?: 'success' | 'error',
  details?: Record<string, any>
): void {
  if (!shouldLog()) return;
  
  console.log('[Auth] Cache operation:', {
    operation,
    keys,
    result,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Logs a warning
 */
export function logWarning(message: string, details?: Record<string, any>): void {
  // Always log warnings
  console.warn('[Auth] Warning:', {
    message,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Logs general information
 */
export function logInfo(message: string, details?: Record<string, any>): void {
  if (!shouldLog()) return;
  
  console.log('[Auth] Info:', {
    message,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
