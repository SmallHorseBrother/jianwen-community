import { vi } from 'vitest';
import type { User } from '../types';

/**
 * Mock user data generator for testing
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'test-user-id',
    phone: '13800138000',
    nickname: 'Test User',
    bio: 'Test bio',
    avatar: undefined,
    powerData: {
      bench: 100,
      squat: 150,
      deadlift: 200,
    },
    isPublic: true,
    groupIdentity: undefined,
    profession: undefined,
    groupNickname: undefined,
    specialties: [],
    fitnessInterests: [],
    learningInterests: [],
    socialLinks: {},
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock Supabase session data
 */
export function createMockSession(userId: string = 'test-user-id') {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    token_type: 'bearer',
    user: {
      id: userId,
      email: '13800138000@jianwen.community',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
    },
  };
}

/**
 * Mock profile data from database
 */
export function createMockProfile(userId: string = 'test-user-id') {
  return {
    id: userId,
    phone: '13800138000',
    nickname: 'Test User',
    bio: 'Test bio',
    avatar_url: null,
    bench_press: 100,
    squat: 150,
    deadlift: 200,
    is_public: true,
    group_identity: null,
    profession: null,
    group_nickname: null,
    specialties: [],
    fitness_interests: [],
    learning_interests: [],
    social_links: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      limit: vi.fn(),
    })),
  };
}

/**
 * Simulate network delay for testing
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a timeout
 */
export function createTimeoutPromise<T>(ms: number, message: string = 'Operation timed out'): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Mock localStorage with Supabase session data
 */
export function mockSupabaseSessionInStorage(session: any) {
  const storageKey = `sb-${process.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`;
  localStorage.setItem(storageKey, JSON.stringify(session));
}

/**
 * Clear all Supabase-related localStorage data
 */
export function clearSupabaseStorage() {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith('sb-') || key.includes('supabase')) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Create a mock navigation function for testing
 */
export function createMockNavigate() {
  return vi.fn();
}

/**
 * Create a mock location object for testing
 */
export function createMockLocation(pathname: string = '/', state?: any) {
  return {
    pathname,
    search: '',
    hash: '',
    state,
    key: 'default',
  };
}
