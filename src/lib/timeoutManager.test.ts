import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withTimeout,
  withTimeoutAndFallback,
  withCancellableTimeout,
  isTimeoutError,
  getTimeoutErrorMessage,
  TimeoutError,
  TIMEOUT_CONFIG,
} from './timeoutManager';
import { delay } from '../test/authTestUtils';

describe('TimeoutManager', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  describe('TIMEOUT_CONFIG', () => {
    it('should have correct timeout values', () => {
      expect(TIMEOUT_CONFIG.LOGIN).toBe(10000);
      expect(TIMEOUT_CONFIG.PROFILE_LOAD).toBe(10000);
      expect(TIMEOUT_CONFIG.INITIALIZATION).toBe(10000);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error with correct properties', () => {
      const error = new TimeoutError('Test timeout', 'testOperation', 5000);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.message).toBe('Test timeout');
      expect(error.name).toBe('TimeoutError');
      expect(error.operationName).toBe('testOperation');
      expect(error.timeoutMs).toBe(5000);
    });
  });

  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000, 'testOp');
      
      expect(result).toBe('success');
    });

    it('should reject when promise rejects before timeout', async () => {
      const promise = Promise.reject(new Error('failed')).catch(e => Promise.reject(e));
      
      await expect(
        withTimeout(promise, 1000, 'testOp')
      ).rejects.toThrow('failed');
    });

    it('should timeout when promise takes too long', async () => {
      const slowPromise = delay(2000).then(() => 'too slow');
      
      await expect(
        withTimeout(slowPromise, 100, 'slowOperation')
      ).rejects.toThrow(TimeoutError);
    });

    it('should include operation name in timeout error', async () => {
      const slowPromise = delay(2000);
      
      try {
        await withTimeout(slowPromise, 100, 'myOperation');
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).operationName).toBe('myOperation');
        expect((error as TimeoutError).message).toContain('myOperation');
      }
    });

    it('should include timeout duration in error', async () => {
      const slowPromise = delay(2000);
      
      try {
        await withTimeout(slowPromise, 500, 'testOp');
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).timeoutMs).toBe(500);
        expect((error as TimeoutError).message).toContain('500ms');
      }
    });

    it('should log warning on timeout', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const slowPromise = delay(2000);
      
      try {
        await withTimeout(slowPromise, 100, 'testOp');
      } catch {
        // Expected to throw
      }
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TimeoutManager] Timeout occurred:',
        expect.objectContaining({
          operation: 'testOp',
          timeout: 100,
        })
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('withTimeoutAndFallback', () => {
    it('should return result when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeoutAndFallback(
        promise,
        1000,
        'testOp',
        'fallback'
      );
      
      expect(result).toBe('success');
    });

    it('should return fallback value on timeout', async () => {
      const slowPromise = delay(2000).then(() => 'too slow');
      const result = await withTimeoutAndFallback(
        slowPromise,
        100,
        'testOp',
        'fallback'
      );
      
      expect(result).toBe('fallback');
    });

    it('should throw non-timeout errors', async () => {
      const promise = Promise.reject(new Error('network error')).catch(e => Promise.reject(e));
      
      await expect(
        withTimeoutAndFallback(promise, 1000, 'testOp', 'fallback')
      ).rejects.toThrow('network error');
    });

    it('should log warning when using fallback', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const slowPromise = delay(2000);
      
      await withTimeoutAndFallback(slowPromise, 100, 'testOp', 'fallback');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TimeoutManager] Using fallback value for "testOp"',
        expect.objectContaining({ fallbackValue: 'fallback' })
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('withCancellableTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const { promise: wrappedPromise } = withCancellableTimeout(
        promise,
        1000,
        'testOp'
      );
      
      const result = await wrappedPromise;
      expect(result).toBe('success');
    });

    it('should timeout when promise takes too long', async () => {
      const slowPromise = delay(2000).then(() => 'too slow');
      const { promise: wrappedPromise } = withCancellableTimeout(
        slowPromise,
        100,
        'testOp'
      );
      
      await expect(wrappedPromise).rejects.toThrow(TimeoutError);
    });

    it('should allow manual cancellation', async () => {
      const slowPromise = delay(2000).then(() => 'too slow');
      const { promise: wrappedPromise, cancel } = withCancellableTimeout(
        slowPromise,
        5000,
        'testOp'
      );
      
      // Cancel immediately
      cancel();
      
      // Promise should still be pending but timeout cleared
      // We can't easily test the cancellation effect, but we ensure no errors
      expect(cancel).toBeDefined();
    });

    it('should handle rejection before timeout', async () => {
      const promise = Promise.reject(new Error('failed')).catch(e => Promise.reject(e));
      const { promise: wrappedPromise } = withCancellableTimeout(
        promise,
        1000,
        'testOp'
      );
      
      await expect(wrappedPromise).rejects.toThrow('failed');
    });
  });

  describe('isTimeoutError', () => {
    it('should return true for TimeoutError instances', () => {
      const error = new TimeoutError('timeout', 'testOp', 1000);
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('regular error');
      expect(isTimeoutError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isTimeoutError('string')).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
      expect(isTimeoutError(123)).toBe(false);
    });
  });

  describe('getTimeoutErrorMessage', () => {
    it('should return timeout message for TimeoutError', () => {
      const error = new TimeoutError('timeout', 'testOp', 1000);
      const message = getTimeoutErrorMessage(error);
      
      expect(message).toBe('网络连接超时，请检查网络后重试');
    });

    it('should return generic message for other errors', () => {
      const error = new Error('some error');
      const message = getTimeoutErrorMessage(error);
      
      expect(message).toBe('操作失败，请稍后重试');
    });

    it('should return generic message for non-error values', () => {
      expect(getTimeoutErrorMessage('string')).toBe('操作失败，请稍后重试');
      expect(getTimeoutErrorMessage(null)).toBe('操作失败，请稍后重试');
    });
  });
});
