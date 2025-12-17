# Design Document

## Overview

本设计文档提供了一个全面的解决方案来修复健学社区应用中的登录可靠性问题。核心策略包括：

1. **状态机模式**：使用明确的状态机来管理认证流程，避免竞态条件
2. **超时保护**：为所有网络请求添加超时机制
3. **智能缓存管理**：自动检测和清理损坏的缓存
4. **原子状态更新**：确保状态更新是原子性的，避免中间状态
5. **增强的错误处理**：提供清晰的错误信息和恢复路径

## Architecture

### Current Issues Analysis

当前实现存在以下问题：

1. **竞态条件**：
   - `onAuthStateChange` 监听器和手动 `login()` 函数可能同时更新状态
   - `isManualLogin` 标志的设置和重置时机不当
   - State Hydration 和 Auth State Listener 可能冲突

2. **缓存管理问题**：
   - 损坏的 session 缓存不会自动清理
   - Profile 加载失败后缓存仍然保留
   - 没有缓存验证机制

3. **超时处理不足**：
   - 只有初始化时有超时保护
   - 登录过程没有超时限制
   - Profile 加载可能无限期等待

4. **状态管理混乱**：
   - 多处代码修改 `isLoading` 状态
   - 状态更新不是原子性的
   - 错误状态处理不一致

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AuthContext                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Authentication State Machine              │  │
│  │                                                   │  │
│  │  States: IDLE → LOADING → AUTHENTICATED          │  │
│  │          IDLE → LOADING → ERROR                   │  │
│  │          AUTHENTICATED → IDLE (logout)            │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Operation Queue Manager                   │  │
│  │  - Serializes auth operations                     │  │
│  │  - Prevents concurrent state updates              │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Timeout Manager                           │  │
│  │  - Wraps all async operations                     │  │
│  │  - Enforces configurable timeouts                 │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Cache Manager                             │  │
│  │  - Validates session cache                        │  │
│  │  - Auto-clears corrupted data                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   Supabase Client    │
              └──────────────────────┘
```

## Components and Interfaces

### 1. Authentication State Machine

```typescript
enum AuthStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}
```

状态转换规则：
- `IDLE` → `INITIALIZING`: 应用启动时
- `INITIALIZING` → `AUTHENTICATED`: State Hydration 成功
- `INITIALIZING` → `IDLE`: State Hydration 失败或无缓存
- `IDLE` → `AUTHENTICATING`: 用户发起登录
- `AUTHENTICATING` → `AUTHENTICATED`: 登录成功
- `AUTHENTICATING` → `ERROR`: 登录失败
- `ERROR` → `IDLE`: 用户重试
- `AUTHENTICATED` → `IDLE`: 用户登出

### 2. Operation Queue Manager

```typescript
class AuthOperationQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing: boolean = false;

  async enqueue(operation: () => Promise<void>): Promise<void>;
  private async processQueue(): Promise<void>;
}
```

职责：
- 序列化所有认证操作
- 防止并发状态更新
- 确保操作按顺序执行

### 3. Timeout Manager

```typescript
interface TimeoutConfig {
  login: number;          // 10000ms
  profileLoad: number;    // 10000ms
  initialization: number; // 10000ms
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T>;
```

职责：
- 为所有异步操作添加超时
- 超时后取消操作并抛出错误
- 记录超时事件

### 4. Cache Manager

```typescript
interface CacheManager {
  validate(): Promise<boolean>;
  clear(): void;
  isCorrupted(): boolean;
}
```

职责：
- 验证 session 缓存完整性
- 检测损坏的缓存数据
- 自动清理无效缓存
- 记录缓存操作

### 5. Enhanced Auth Context

```typescript
interface AuthContextType {
  state: AuthState;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}
```

改进：
- 使用状态机管理状态
- 所有操作通过队列执行
- 统一的错误处理
- 完善的日志记录

## Data Models

### AuthState

```typescript
interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}
```

### AuthOperation

```typescript
type AuthOperation = 
  | { type: 'LOGIN'; phone: string; password: string }
  | { type: 'LOGOUT' }
  | { type: 'HYDRATE' }
  | { type: 'UPDATE_PROFILE'; updates: Partial<User> };
```

### CacheValidationResult

```typescript
interface CacheValidationResult {
  isValid: boolean;
  hasSession: boolean;
  hasProfile: boolean;
  reason?: string;
}
```

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Performance Properties

Property 1: Login completion time
*For any* valid credentials under normal network conditions (simulated), the login process should complete within 3 seconds
**Validates: Requirements 1.1**

Property 2: State hydration time
*For any* valid cached session, state restoration should complete within 2 seconds
**Validates: Requirements 1.5**

### State Management Properties

Property 3: Successful login navigation
*For any* successful login operation, the navigation function should be called with the user's intended destination
**Validates: Requirements 1.2**

Property 4: Session persistence after login
*For any* successful login, the session should exist in cache and remain valid without requiring manual cache clearing
**Validates: Requirements 1.4**

Property 5: Race condition prevention
*For any* concurrent authentication operations (manual login + auth state listener), the final state should be consistent with the manual login result
**Validates: Requirements 2.1, 2.2**

Property 6: Operation serialization
*For any* set of concurrent authentication operations, they should execute serially and produce a consistent final state
**Validates: Requirements 2.3**

Property 7: Hydration priority
*For any* application startup, state hydration should complete before any auth state listener events are processed
**Validates: Requirements 2.4**

Property 8: Atomic state updates
*For any* authentication state change, the state should transition in a single atomic operation without observable intermediate states
**Validates: Requirements 2.5**

### Cache Management Properties

Property 9: Invalid cache detection and cleanup
*For any* invalid or expired session cache, the system should automatically detect and clear it
**Validates: Requirements 3.1**

Property 10: Profile load failure recovery
*For any* successful authentication followed by profile load failure, the system should clear the cache and reset to unauthenticated state
**Validates: Requirements 3.2**

Property 11: Network error cache cleanup
*For any* network error during state hydration, the system should clear potentially corrupted cache data
**Validates: Requirements 3.3**

Property 12: Inconsistent state detection
*For any* session without corresponding profile data, the system should clear the cache and reset to unauthenticated state
**Validates: Requirements 3.4**

Property 13: Cache operation logging
*For any* cache clearing operation, a log entry should be created with the reason for the operation
**Validates: Requirements 3.5**

### Error Handling Properties

Property 14: Timeout error messaging
*For any* network timeout during login, the system should display a user-friendly timeout error message
**Validates: Requirements 4.1**

Property 15: Credential error messaging
*For any* authentication failure due to invalid credentials, the system should display a specific error message indicating credential issues
**Validates: Requirements 4.2**

Property 16: Profile load error messaging
*For any* profile loading failure, the system should display an error message explaining the failure
**Validates: Requirements 4.3**

Property 17: Connection error messaging
*For any* Supabase connection failure, the system should display a connection error with troubleshooting suggestions
**Validates: Requirements 4.4**

Property 18: Error logging
*For any* authentication error, detailed error information should be logged to the console
**Validates: Requirements 4.5**

### Timeout Properties

Property 19: Login timeout enforcement
*For any* login operation that exceeds 10 seconds, the operation should be cancelled and a timeout error should be thrown
**Validates: Requirements 5.1**

Property 20: Profile load timeout enforcement
*For any* profile loading operation that exceeds 10 seconds, the operation should be cancelled and a timeout error should be thrown
**Validates: Requirements 5.2**

Property 21: Hydration timeout enforcement
*For any* state hydration profile load that exceeds 10 seconds, the operation should be cancelled and a timeout error should be thrown
**Validates: Requirements 5.3**

Property 22: Timeout state cleanup
*For any* timeout occurrence, the pending operation should be cancelled and the UI state should be updated to reflect the error
**Validates: Requirements 5.4**

Property 23: Retry after timeout
*For any* timeout error, the system should be in a state that allows the user to retry the operation
**Validates: Requirements 5.5**

### Session Restoration Properties

Property 24: Valid session restoration
*For any* valid cached session on page refresh, the authenticated state should be restored without requiring re-login
**Validates: Requirements 6.1**

Property 25: Hydration retry logic
*For any* state hydration failure due to network issues, the system should retry once before clearing the session
**Validates: Requirements 6.2**

Property 26: Missing profile fetch
*For any* valid session with missing profile data during hydration, the system should attempt to fetch the profile
**Validates: Requirements 6.3**

Property 27: Hydration profile failure cleanup
*For any* profile fetch failure during state hydration, the system should clear the session and require re-login
**Validates: Requirements 6.4**

Property 28: Hydration completion state
*For any* successful state hydration, the loading state should be marked as complete
**Validates: Requirements 6.5**

### Logging Properties

Property 29: Operation start logging
*For any* authentication operation, a log entry should be created with the operation type and timestamp
**Validates: Requirements 7.1**

Property 30: State change logging
*For any* authentication state change, a log entry should be created with previous state, new state, and trigger reason
**Validates: Requirements 7.2**

Property 31: Error detail logging
*For any* error occurrence, a log entry should be created with error type, message, and stack trace
**Validates: Requirements 7.3**

Property 32: Cache operation logging
*For any* cache operation, a log entry should be created indicating which cache keys are being modified
**Validates: Requirements 7.4**

Property 33: Network request logging
*For any* network request, a log entry should be created with request type, endpoint, and response status
**Validates: Requirements 7.5**

## Error Handling

### Error Categories

1. **Network Errors**
   - Connection timeout
   - Network unavailable
   - DNS resolution failure
   - Response: Clear error message, allow retry, log details

2. **Authentication Errors**
   - Invalid credentials
   - Account not found
   - Account disabled
   - Response: Specific error message, allow retry, do not clear cache

3. **Profile Errors**
   - Profile not found
   - Profile load timeout
   - Profile data corrupted
   - Response: Clear cache, require re-login, log details

4. **Cache Errors**
   - Corrupted session data
   - Expired session
   - Missing profile data
   - Response: Auto-clear cache, reset to unauthenticated, log reason

5. **State Errors**
   - Race condition detected
   - Invalid state transition
   - Concurrent operation conflict
   - Response: Serialize operations, log warning, recover gracefully

### Error Recovery Strategies

```typescript
interface ErrorRecoveryStrategy {
  shouldClearCache: boolean;
  shouldRetry: boolean;
  maxRetries: number;
  userMessage: string;
  logLevel: 'error' | 'warn' | 'info';
}

const errorStrategies: Record<string, ErrorRecoveryStrategy> = {
  NETWORK_TIMEOUT: {
    shouldClearCache: false,
    shouldRetry: true,
    maxRetries: 1,
    userMessage: '网络连接超时，请检查网络后重试',
    logLevel: 'warn'
  },
  INVALID_CREDENTIALS: {
    shouldClearCache: false,
    shouldRetry: true,
    maxRetries: 3,
    userMessage: '手机号或密码错误，请检查后重试',
    logLevel: 'info'
  },
  PROFILE_LOAD_FAILED: {
    shouldClearCache: true,
    shouldRetry: false,
    maxRetries: 0,
    userMessage: '加载用户资料失败，请重新登录',
    logLevel: 'error'
  },
  CORRUPTED_CACHE: {
    shouldClearCache: true,
    shouldRetry: false,
    maxRetries: 0,
    userMessage: '检测到缓存异常，已自动清理，请重新登录',
    logLevel: 'warn'
  }
};
```

## Testing Strategy

### Unit Testing

我们将使用 **Vitest** 作为单元测试框架，因为它与 Vite 项目集成良好且性能优秀。

**Unit Test Coverage:**

1. **Timeout Manager Tests**
   - Test timeout enforcement for various durations
   - Test timeout cancellation
   - Test timeout error messages

2. **Cache Manager Tests**
   - Test cache validation logic
   - Test cache clearing
   - Test corruption detection

3. **State Machine Tests**
   - Test valid state transitions
   - Test invalid state transition rejection
   - Test state transition logging

4. **Error Handler Tests**
   - Test error categorization
   - Test error message generation
   - Test recovery strategy selection

### Property-Based Testing

我们将使用 **fast-check** 作为属性测试库，这是 JavaScript/TypeScript 生态中最成熟的 PBT 库。

**Configuration:**
- Minimum 100 iterations per property test
- Use seed-based randomization for reproducibility
- Generate realistic test data (valid/invalid credentials, various network conditions)

**Property Test Coverage:**

1. **Performance Properties (1-2)**
   - Generate random valid credentials
   - Mock network delays
   - Measure operation completion time

2. **State Management Properties (3-8)**
   - Generate random authentication operations
   - Simulate concurrent operations
   - Verify state consistency

3. **Cache Management Properties (9-13)**
   - Generate various cache states (valid, invalid, corrupted)
   - Verify automatic cleanup
   - Verify logging

4. **Error Handling Properties (14-18)**
   - Generate various error conditions
   - Verify error messages
   - Verify logging

5. **Timeout Properties (19-23)**
   - Generate operations with various durations
   - Verify timeout enforcement
   - Verify state cleanup

6. **Session Restoration Properties (24-28)**
   - Generate various cached session states
   - Simulate page refresh
   - Verify restoration behavior

7. **Logging Properties (29-33)**
   - Generate various operations
   - Verify log entries
   - Verify log content

**Property Test Tagging:**
Each property-based test MUST include a comment with this format:
```typescript
// Feature: login-reliability-fix, Property X: [property description]
// Validates: Requirements X.Y
```

### Integration Testing

1. **End-to-End Login Flow**
   - Test complete login flow from form submission to navigation
   - Test with various network conditions
   - Test cache persistence across page refreshes

2. **Error Recovery Flows**
   - Test recovery from network errors
   - Test recovery from profile load failures
   - Test cache cleanup and retry

3. **Concurrent Operation Handling**
   - Test simultaneous login attempts
   - Test login during hydration
   - Test auth state listener during manual operations

## Implementation Notes

### Migration Strategy

1. **Phase 1: Add New Components (Non-Breaking)**
   - Implement Timeout Manager
   - Implement Cache Manager
   - Implement Operation Queue
   - Add comprehensive logging

2. **Phase 2: Refactor Auth Context**
   - Introduce state machine
   - Integrate operation queue
   - Add timeout protection
   - Enhance error handling

3. **Phase 3: Update Login Form**
   - Remove manual cache clearing button (no longer needed)
   - Improve error message display
   - Add retry logic

4. **Phase 4: Testing and Validation**
   - Run property-based tests
   - Run integration tests
   - Test in production-like environment
   - Monitor logs for issues

### Performance Considerations

- Operation queue adds minimal overhead (< 1ms per operation)
- Timeout manager uses AbortController for efficient cancellation
- Cache validation is performed only on startup and after errors
- Logging is conditional based on environment (verbose in dev, minimal in prod)

### Browser Compatibility

- Uses standard Web APIs (localStorage, AbortController)
- Compatible with all modern browsers
- Graceful degradation for older browsers (fallback to basic error handling)
