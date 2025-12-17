/**
 * Operation Queue Manager
 * 
 * Serializes authentication operations to prevent race conditions and
 * ensure state consistency.
 */

/**
 * Operation in the queue
 */
interface QueuedOperation {
  id: string;
  name: string;
  operation: () => Promise<void>;
  timestamp: number;
}

/**
 * Authentication Operation Queue
 * 
 * Ensures that authentication operations are executed serially,
 * preventing concurrent state updates that could lead to race conditions.
 */
export class AuthOperationQueue {
  private queue: QueuedOperation[] = [];
  private isProcessing: boolean = false;
  private operationCounter: number = 0;

  /**
   * Enqueues an operation and processes the queue
   * 
   * @param operation - Async function to execute
   * @param operationName - Name of the operation for logging
   * @returns Promise that resolves when the operation completes
   */
  async enqueue(
    operation: () => Promise<void>,
    operationName: string = 'anonymous'
  ): Promise<void> {
    const operationId = `${operationName}-${++this.operationCounter}`;
    
    console.log('[OperationQueue] Enqueuing operation:', {
      id: operationId,
      name: operationName,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      timestamp: new Date().toISOString(),
    });

    return new Promise<void>((resolve, reject) => {
      const wrappedOperation = async () => {
        try {
          console.log('[OperationQueue] Executing operation:', {
            id: operationId,
            name: operationName,
          });
          
          await operation();
          
          console.log('[OperationQueue] Operation completed:', {
            id: operationId,
            name: operationName,
          });
          
          resolve();
        } catch (error) {
          console.error('[OperationQueue] Operation failed:', {
            id: operationId,
            name: operationName,
            error,
          });
          
          reject(error);
        }
      };

      this.queue.push({
        id: operationId,
        name: operationName,
        operation: wrappedOperation,
        timestamp: Date.now(),
      });

      // Start processing if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Processes the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const queuedOp = this.queue.shift();
      
      if (!queuedOp) {
        break;
      }

      try {
        await queuedOp.operation();
      } catch (error) {
        // Error is already logged in the wrapped operation
        // Continue processing the queue
      }
    }

    this.isProcessing = false;
    
    console.log('[OperationQueue] Queue processing complete');
  }

  /**
   * Gets the current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Checks if the queue is currently processing
   */
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clears all pending operations from the queue
   * Note: Does not cancel the currently executing operation
   */
  clear(): void {
    console.log('[OperationQueue] Clearing queue:', {
      pendingOperations: this.queue.length,
    });
    
    this.queue = [];
  }

  /**
   * Gets queue statistics for debugging
   */
  getStats(): {
    queueLength: number;
    isProcessing: boolean;
    totalOperations: number;
  } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      totalOperations: this.operationCounter,
    };
  }
}

/**
 * Singleton instance of the operation queue
 * This ensures all auth operations use the same queue
 */
let globalQueue: AuthOperationQueue | null = null;

/**
 * Gets the global operation queue instance
 */
export function getGlobalQueue(): AuthOperationQueue {
  if (!globalQueue) {
    globalQueue = new AuthOperationQueue();
  }
  return globalQueue;
}

/**
 * Resets the global queue (useful for testing)
 */
export function resetGlobalQueue(): void {
  globalQueue = null;
}
