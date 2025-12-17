import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSupabaseCacheKeys,
  clearAuthCache,
  validateSessionCache,
  isCacheCorrupted,
  hasSessionInCache,
  getCacheStats,
  logCacheState,
  type CacheClearReason,
} from './cacheManager';

describe('CacheManager', () => {
  beforeEach(() => {
    // Clear all storage before each test
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('getSupabaseCacheKeys', () => {
    it('should return empty array when no cache exists', () => {
      const keys = getSupabaseCacheKeys();
      expect(keys).toEqual([]);
    });

    it('should find keys starting with sb-', () => {
      localStorage.setItem('sb-test-auth-token', 'value1');
      localStorage.setItem('other-key', 'value2');
      
      const keys = getSupabaseCacheKeys();
      expect(keys).toContain('sb-test-auth-token');
      expect(keys).not.toContain('other-key');
    });

    it('should find keys containing supabase', () => {
      localStorage.setItem('my-supabase-data', 'value1');
      localStorage.setItem('other-key', 'value2');
      
      const keys = getSupabaseCacheKeys();
      expect(keys).toContain('my-supabase-data');
      expect(keys).not.toContain('other-key');
    });

    it('should find multiple Supabase keys', () => {
      localStorage.setItem('sb-key1', 'value1');
      localStorage.setItem('sb-key2', 'value2');
      localStorage.setItem('supabase-key3', 'value3');
      localStorage.setItem('other-key', 'value4');
      
      const keys = getSupabaseCacheKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('sb-key1');
      expect(keys).toContain('sb-key2');
      expect(keys).toContain('supabase-key3');
    });
  });

  describe('clearAuthCache', () => {
    it('should clear all Supabase keys from localStorage', () => {
      localStorage.setItem('sb-auth-token', 'token');
      localStorage.setItem('supabase-data', 'data');
      localStorage.setItem('other-key', 'keep-this');
      
      clearAuthCache('manual_clear');
      
      expect(localStorage.getItem('sb-auth-token')).toBeNull();
      expect(localStorage.getItem('supabase-data')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('keep-this');
    });

    it('should clear Supabase keys from sessionStorage', () => {
      sessionStorage.setItem('sb-session', 'session');
      sessionStorage.setItem('other-key', 'keep-this');
      
      clearAuthCache('manual_clear');
      
      expect(sessionStorage.getItem('sb-session')).toBeNull();
      expect(sessionStorage.getItem('other-key')).toBe('keep-this');
    });

    it('should log the clear operation', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      localStorage.setItem('sb-auth-token', 'token');
      
      clearAuthCache('corrupted_session');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CacheManager] Clearing auth cache',
        expect.objectContaining({
          reason: 'corrupted_session',
        })
      );
      
      consoleLogSpy.mockRestore();
    });

    it('should handle different clear reasons', () => {
      const reasons: CacheClearReason[] = [
        'corrupted_session',
        'expired_session',
        'missing_profile',
        'network_error',
        'profile_load_failed',
        'manual_clear',
        'logout',
      ];
      
      reasons.forEach((reason) => {
        localStorage.setItem('sb-test', 'value');
        clearAuthCache(reason);
        expect(localStorage.getItem('sb-test')).toBeNull();
      });
    });
  });

  describe('validateSessionCache', () => {
    it('should return invalid when no cache exists', async () => {
      const result = await validateSessionCache();
      
      expect(result.isValid).toBe(false);
      expect(result.hasSession).toBe(false);
      expect(result.reason).toContain('No cache keys found');
    });

    it('should return invalid for corrupted JSON', async () => {
      localStorage.setItem('sb-auth-token', 'invalid-json{');
      
      const result = await validateSessionCache();
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Corrupted cache data');
    });

    it('should return valid for valid session data', async () => {
      const sessionData = {
        access_token: 'token123',
        user: { id: 'user123' },
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      
      localStorage.setItem('sb-auth-token', JSON.stringify(sessionData));
      
      const result = await validateSessionCache();
      
      expect(result.isValid).toBe(true);
      expect(result.hasSession).toBe(true);
    });

    it('should return invalid for expired session', async () => {
      const sessionData = {
        access_token: 'token123',
        user: { id: 'user123' },
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      
      localStorage.setItem('sb-auth-token', JSON.stringify(sessionData));
      
      const result = await validateSessionCache();
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Session expired');
    });

    it('should handle nested session structure', async () => {
      const sessionData = {
        session: {
          access_token: 'token123',
          user: { id: 'user123' },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      };
      
      localStorage.setItem('sb-auth-token', JSON.stringify(sessionData));
      
      const result = await validateSessionCache();
      
      expect(result.isValid).toBe(true);
      expect(result.hasSession).toBe(true);
    });
  });

  describe('isCacheCorrupted', () => {
    it('should return false when no cache exists', () => {
      expect(isCacheCorrupted()).toBe(false);
    });

    it('should return false for valid JSON cache', () => {
      localStorage.setItem('sb-auth-token', JSON.stringify({ valid: true }));
      expect(isCacheCorrupted()).toBe(false);
    });

    it('should return true for invalid JSON cache', () => {
      localStorage.setItem('sb-auth-token', 'invalid-json{');
      expect(isCacheCorrupted()).toBe(true);
    });

    it('should return true if any cache key is corrupted', () => {
      localStorage.setItem('sb-key1', JSON.stringify({ valid: true }));
      localStorage.setItem('sb-key2', 'invalid-json{');
      
      expect(isCacheCorrupted()).toBe(true);
    });
  });

  describe('hasSessionInCache', () => {
    it('should return false when no cache exists', () => {
      expect(hasSessionInCache()).toBe(false);
    });

    it('should return true when access_token exists', () => {
      localStorage.setItem('sb-auth-token', JSON.stringify({ access_token: 'token' }));
      expect(hasSessionInCache()).toBe(true);
    });

    it('should return true when user exists', () => {
      localStorage.setItem('sb-auth-token', JSON.stringify({ user: { id: '123' } }));
      expect(hasSessionInCache()).toBe(true);
    });

    it('should return true when session exists', () => {
      localStorage.setItem('sb-auth-token', JSON.stringify({ session: { access_token: 'token' } }));
      expect(hasSessionInCache()).toBe(true);
    });

    it('should return false for cache without session data', () => {
      localStorage.setItem('sb-other-data', JSON.stringify({ other: 'data' }));
      expect(hasSessionInCache()).toBe(false);
    });

    it('should ignore corrupted cache entries', () => {
      localStorage.setItem('sb-corrupted', 'invalid-json{');
      expect(hasSessionInCache()).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return zero stats when no cache exists', () => {
      // Ensure localStorage is completely empty
      localStorage.clear();
      
      const stats = getCacheStats();
      
      expect(stats.supabaseKeys).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.isCorrupted).toBe(false);
      // Don't check totalKeys as it may include test framework keys
    });

    it('should count Supabase keys correctly', () => {
      localStorage.clear();
      localStorage.setItem('sb-key1', 'value1');
      localStorage.setItem('sb-key2', 'value2');
      localStorage.setItem('other-key', 'value3');
      
      const stats = getCacheStats();
      
      expect(stats.supabaseKeys).toBe(2);
      expect(stats.totalKeys).toBeGreaterThanOrEqual(3);
    });

    it('should calculate cache size', () => {
      localStorage.setItem('sb-key1', 'abc'); // 3 bytes
      localStorage.setItem('sb-key2', 'defgh'); // 5 bytes
      
      const stats = getCacheStats();
      
      expect(stats.cacheSize).toBe(8);
    });

    it('should detect corrupted cache', () => {
      localStorage.setItem('sb-key1', 'invalid-json{');
      
      const stats = getCacheStats();
      
      expect(stats.isCorrupted).toBe(true);
    });
  });

  describe('logCacheState', () => {
    it('should log cache state without errors', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      localStorage.setItem('sb-auth-token', 'token');
      logCacheState();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CacheManager] Cache State:',
        expect.objectContaining({
          supabaseKeys: 1,
        })
      );
      
      consoleLogSpy.mockRestore();
    });
  });
});
