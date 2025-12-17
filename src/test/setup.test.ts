import { describe, it, expect } from 'vitest';
import { createMockUser, createMockSession, createMockProfile } from './authTestUtils';

describe('Test Infrastructure Setup', () => {
  it('should create mock user data', () => {
    const user = createMockUser();
    expect(user).toBeDefined();
    expect(user.id).toBe('test-user-id');
    expect(user.phone).toBe('13800138000');
    expect(user.nickname).toBe('Test User');
  });

  it('should create mock session data', () => {
    const session = createMockSession();
    expect(session).toBeDefined();
    expect(session.access_token).toBe('mock-access-token');
    expect(session.user.id).toBe('test-user-id');
  });

  it('should create mock profile data', () => {
    const profile = createMockProfile();
    expect(profile).toBeDefined();
    expect(profile.id).toBe('test-user-id');
    expect(profile.phone).toBe('13800138000');
  });

  it('should have localStorage available', () => {
    localStorage.setItem('test-key', 'test-value');
    expect(localStorage.getItem('test-key')).toBe('test-value');
    localStorage.removeItem('test-key');
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('should have sessionStorage available', () => {
    sessionStorage.setItem('test-key', 'test-value');
    expect(sessionStorage.getItem('test-key')).toBe('test-value');
    sessionStorage.removeItem('test-key');
    expect(sessionStorage.getItem('test-key')).toBeNull();
  });
});
