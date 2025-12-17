import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthOperationQueue,
  getGlobalQueue,
  resetGlobalQueue,
} from './operationQueue';
import { delay } from '../test/authTestUtils';

describe('OperationQueue', () => {
  let queue: AuthOperationQueue;

  beforeEach(() => {
    queue = new AuthOperationQueue();
    resetGlobalQueue();
    vi.clearAllMocks();
  });

  describe('AuthOperationQueue', () => {
    it('should execute a single operation', async () => {
      const mockOp = vi.fn().mockResolvedValue(undefined);
      
      await queue.enqueue(mockOp, 'testOp');
      
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should execute operations serially', async () => {
      const executionOrder: number[] = [];
      
      const op1 = async () => {
        await delay(50);
        executionOrder.push(1);
      };
      
      const op2 = async () => {
        await delay(30);
        executionOrder.push(2);
      };
      
      const op3 = async () => {
        await delay(10);
        executionOrder.push(3);
      };
      
      // Enqueue all operations
      const promises = [
        queue.enqueue(op1, 'op1'),
        queue.enqueue(op2, 'op2'),
        queue.enqueue(op3, 'op3'),
      ];
      
      await Promise.all(promises);
      
      // Should execute in order despite different delays
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should handle operation errors without stopping the queue', async () => {
      const executionOrder: number[] = [];
      
      const op1 = async () => {
        executionOrder.push(1);
      };
      
      const op2 = async () => {
        executionOrder.push(2);
        throw new Error('Operation 2 failed');
      };
      
      const op3 = async () => {
        executionOrder.push(3);
      };
      
      const promise1 = queue.enqueue(op1, 'op1');
      const promise2 = queue.enqueue(op2, 'op2');
      const promise3 = queue.enqueue(op3, 'op3');
      
      await promise1;
      await expect(promise2).rejects.toThrow('Operation 2 failed');
      await promise3;
      
      // All operations should have executed
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should track queue length correctly', async () => {
      expect(queue.getQueueLength()).toBe(0);
      
      const slowOp = () => delay(100);
      
      // Enqueue operations without awaiting
      const promise1 = queue.enqueue(slowOp, 'op1');
      const promise2 = queue.enqueue(slowOp, 'op2');
      const promise3 = queue.enqueue(slowOp, 'op3');
      
      // Give time for first operation to start
      await delay(10);
      
      // Queue should have 2 pending operations (first one is executing)
      expect(queue.getQueueLength()).toBeLessThanOrEqual(2);
      
      await Promise.all([promise1, promise2, promise3]);
      
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should track processing state', async () => {
      expect(queue.isQueueProcessing()).toBe(false);
      
      const slowOp = () => delay(50);
      const promise = queue.enqueue(slowOp, 'slowOp');
      
      // Give time for operation to start
      await delay(10);
      
      expect(queue.isQueueProcessing()).toBe(true);
      
      await promise;
      
      expect(queue.isQueueProcessing()).toBe(false);
    });

    it('should clear pending operations', async () => {
      const executionOrder: number[] = [];
      
      const slowOp1 = async () => {
        await delay(50);
        executionOrder.push(1);
      };
      
      const op2 = async () => {
        executionOrder.push(2);
      };
      
      const op3 = async () => {
        executionOrder.push(3);
      };
      
      // Enqueue operations
      const promise1 = queue.enqueue(slowOp1, 'op1');
      queue.enqueue(op2, 'op2');
      queue.enqueue(op3, 'op3');
      
      // Give time for first operation to start
      await delay(10);
      
      // Clear pending operations
      queue.clear();
      
      // Wait for first operation to complete
      await promise1;
      
      // Only first operation should have executed
      expect(executionOrder).toEqual([1]);
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should provide queue statistics', async () => {
      const stats1 = queue.getStats();
      expect(stats1.queueLength).toBe(0);
      expect(stats1.isProcessing).toBe(false);
      expect(stats1.totalOperations).toBe(0);
      
      const slowOp = () => delay(50);
      
      queue.enqueue(slowOp, 'op1');
      queue.enqueue(slowOp, 'op2');
      
      await delay(10);
      
      const stats2 = queue.getStats();
      expect(stats2.totalOperations).toBe(2);
      expect(stats2.isProcessing).toBe(true);
    });

    it('should log operation lifecycle', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const mockOp = vi.fn().mockResolvedValue(undefined);
      await queue.enqueue(mockOp, 'testOp');
      
      // Should log enqueue, execute, and complete
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[OperationQueue] Enqueuing operation:',
        expect.objectContaining({
          name: 'testOp',
        })
      );
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[OperationQueue] Executing operation:',
        expect.objectContaining({
          name: 'testOp',
        })
      );
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[OperationQueue] Operation completed:',
        expect.objectContaining({
          name: 'testOp',
        })
      );
      
      consoleLogSpy.mockRestore();
    });

    it('should log operation failures', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const failingOp = async () => {
        throw new Error('Test error');
      };
      
      await expect(queue.enqueue(failingOp, 'failOp')).rejects.toThrow('Test error');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OperationQueue] Operation failed:',
        expect.objectContaining({
          name: 'failOp',
        })
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle concurrent enqueue calls', async () => {
      const executionOrder: number[] = [];
      
      const createOp = (id: number) => async () => {
        await delay(10);
        executionOrder.push(id);
      };
      
      // Enqueue multiple operations concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        queue.enqueue(createOp(i + 1), `op${i + 1}`)
      );
      
      await Promise.all(promises);
      
      // All operations should execute in order
      expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Global Queue', () => {
    it('should return the same instance', () => {
      const queue1 = getGlobalQueue();
      const queue2 = getGlobalQueue();
      
      expect(queue1).toBe(queue2);
    });

    it('should reset global queue', () => {
      const queue1 = getGlobalQueue();
      resetGlobalQueue();
      const queue2 = getGlobalQueue();
      
      expect(queue1).not.toBe(queue2);
    });

    it('should share state across calls', async () => {
      const queue1 = getGlobalQueue();
      const queue2 = getGlobalQueue();
      
      const mockOp = vi.fn().mockResolvedValue(undefined);
      await queue1.enqueue(mockOp, 'testOp');
      
      const stats = queue2.getStats();
      expect(stats.totalOperations).toBe(1);
    });
  });
});
