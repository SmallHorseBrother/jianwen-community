/**
 * Authentication State Machine
 * 
 * Defines the possible states and transitions for the authentication system.
 */

/**
 * Authentication status enum
 */
export enum AuthStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error',
}

/**
 * Authentication state interface
 */
export interface AuthMachineState {
  status: AuthStatus;
  error: string | null;
}

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<AuthStatus, AuthStatus[]> = {
  [AuthStatus.IDLE]: [AuthStatus.INITIALIZING, AuthStatus.AUTHENTICATING],
  [AuthStatus.INITIALIZING]: [AuthStatus.AUTHENTICATED, AuthStatus.IDLE, AuthStatus.ERROR],
  [AuthStatus.AUTHENTICATING]: [AuthStatus.AUTHENTICATED, AuthStatus.ERROR, AuthStatus.IDLE],
  [AuthStatus.AUTHENTICATED]: [AuthStatus.IDLE],
  [AuthStatus.ERROR]: [AuthStatus.IDLE, AuthStatus.AUTHENTICATING],
};

/**
 * Validates if a state transition is allowed
 * 
 * @param from - Current state
 * @param to - Target state
 * @returns true if transition is valid
 */
export function isValidTransition(from: AuthStatus, to: AuthStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS[from];
  return allowedTransitions.includes(to);
}

/**
 * Gets a human-readable description of a state
 */
export function getStateDescription(status: AuthStatus): string {
  switch (status) {
    case AuthStatus.IDLE:
      return '未登录';
    case AuthStatus.INITIALIZING:
      return '初始化中';
    case AuthStatus.AUTHENTICATING:
      return '登录中';
    case AuthStatus.AUTHENTICATED:
      return '已登录';
    case AuthStatus.ERROR:
      return '错误';
    default:
      return '未知状态';
  }
}

/**
 * Checks if the current state allows user interaction
 */
export function canUserInteract(status: AuthStatus): boolean {
  return status === AuthStatus.IDLE || status === AuthStatus.ERROR;
}

/**
 * Checks if the system is in a loading state
 */
export function isLoadingState(status: AuthStatus): boolean {
  return status === AuthStatus.INITIALIZING || status === AuthStatus.AUTHENTICATING;
}

/**
 * Checks if the user is authenticated
 */
export function isAuthenticated(status: AuthStatus): boolean {
  return status === AuthStatus.AUTHENTICATED;
}
