/**
 * Cache Manager
 * 
 * Manages browser cache for authentication data, including validation,
 * corruption detection, and automatic cleanup.
 */

/**
 * Cache validation result
 */
export interface CacheValidationResult {
  isValid: boolean;
  hasSession: boolean;
  hasProfile: boolean;
  reason?: string;
}

/**
 * Cache clear reason for logging
 */
export type CacheClearReason =
  | 'corrupted_session'
  | 'expired_session'
  | 'missing_profile'
  | 'network_error'
  | 'profile_load_failed'
  | 'manual_clear'
  | 'logout';

/**
 * Gets all Supabase-related cache keys from localStorage
 */
export function getSupabaseCacheKeys(): string[] {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keys.push(key);
      }
    }
    return keys;
  } catch (error) {
    console.error('[CacheManager] Failed to get cache keys:', error);
    return [];
  }
}

/**
 * Clears all Supabase-related cache from localStorage and sessionStorage
 * 
 * @param reason - Reason for clearing cache (for logging)
 */
export function clearAuthCache(reason: CacheClearReason): void {
  try {
    console.log('[CacheManager] Clearing auth cache', {
      reason,
      timestamp: new Date().toISOString(),
    });

    // Clear localStorage
    const localStorageKeys = getSupabaseCacheKeys();
    localStorageKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
        console.log('[CacheManager] Removed localStorage key:', key);
      } catch (error) {
        console.error('[CacheManager] Failed to remove key:', key, error);
      }
    });

    // Clear sessionStorage
    try {
      const sessionKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          sessionKeys.push(key);
        }
      }
      
      sessionKeys.forEach((key) => {
        try {
          sessionStorage.removeItem(key);
          console.log('[CacheManager] Removed sessionStorage key:', key);
        } catch (error) {
          console.error('[CacheManager] Failed to remove session key:', key, error);
        }
      });
    } catch (error) {
      console.error('[CacheManager] Failed to clear sessionStorage:', error);
    }

    console.log('[CacheManager] Auth cache cleared successfully', {
      reason,
      keysCleared: localStorageKeys.length,
    });
  } catch (error) {
    console.error('[CacheManager] Failed to clear auth cache:', error);
  }
}

/**
 * Validates the current session cache
 * 
 * @returns Validation result with details
 */
export async function validateSessionCache(): Promise<CacheValidationResult> {
  try {
    const keys = getSupabaseCacheKeys();
    
    if (keys.length === 0) {
      return {
        isValid: false,
        hasSession: false,
        hasProfile: false,
        reason: 'No cache keys found',
      };
    }

    // Try to parse session data
    let hasValidSession = false;
    let sessionData: any = null;

    for (const key of keys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          
          // Check if this looks like a session object
          if (parsed && typeof parsed === 'object') {
            if (parsed.access_token || parsed.user || parsed.session) {
              hasValidSession = true;
              sessionData = parsed;
              break;
            }
          }
        }
      } catch (error) {
        // Invalid JSON, cache is corrupted
        console.warn('[CacheManager] Corrupted cache data in key:', key);
        return {
          isValid: false,
          hasSession: false,
          hasProfile: false,
          reason: 'Corrupted cache data (invalid JSON)',
        };
      }
    }

    if (!hasValidSession) {
      return {
        isValid: false,
        hasSession: false,
        hasProfile: false,
        reason: 'No valid session found in cache',
      };
    }

    // Check if session is expired
    if (sessionData) {
      const expiresAt = sessionData.expires_at || sessionData.session?.expires_at;
      if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt < now) {
          return {
            isValid: false,
            hasSession: true,
            hasProfile: false,
            reason: 'Session expired',
          };
        }
      }
    }

    return {
      isValid: true,
      hasSession: true,
      hasProfile: false, // We can't validate profile without making a request
      reason: 'Cache appears valid',
    };
  } catch (error) {
    console.error('[CacheManager] Error validating cache:', error);
    return {
      isValid: false,
      hasSession: false,
      hasProfile: false,
      reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Checks if the cache is corrupted
 * 
 * @returns true if cache appears corrupted
 */
export function isCacheCorrupted(): boolean {
  try {
    const keys = getSupabaseCacheKeys();
    
    for (const key of keys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          // Try to parse as JSON
          JSON.parse(value);
        }
      } catch (error) {
        // Failed to parse, cache is corrupted
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[CacheManager] Error checking cache corruption:', error);
    return true; // Assume corrupted if we can't check
  }
}

/**
 * Checks if a session exists in cache (without validating it)
 * 
 * @returns true if session data exists
 */
export function hasSessionInCache(): boolean {
  try {
    const keys = getSupabaseCacheKeys();
    
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && (parsed.access_token || parsed.user || parsed.session)) {
            return true;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('[CacheManager] Error checking session cache:', error);
    return false;
  }
}

/**
 * Gets cache statistics for debugging
 */
export function getCacheStats(): {
  totalKeys: number;
  supabaseKeys: number;
  cacheSize: number;
  isCorrupted: boolean;
} {
  try {
    const allKeys = Object.keys(localStorage);
    const supabaseKeys = getSupabaseCacheKeys();
    
    let cacheSize = 0;
    supabaseKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) {
        cacheSize += value.length;
      }
    });
    
    return {
      totalKeys: allKeys.length,
      supabaseKeys: supabaseKeys.length,
      cacheSize,
      isCorrupted: isCacheCorrupted(),
    };
  } catch (error) {
    console.error('[CacheManager] Error getting cache stats:', error);
    return {
      totalKeys: 0,
      supabaseKeys: 0,
      cacheSize: 0,
      isCorrupted: true,
    };
  }
}

/**
 * Logs current cache state for debugging
 */
export function logCacheState(): void {
  const stats = getCacheStats();
  const keys = getSupabaseCacheKeys();
  
  console.log('[CacheManager] Cache State:', {
    ...stats,
    keys,
    timestamp: new Date().toISOString(),
  });
}
