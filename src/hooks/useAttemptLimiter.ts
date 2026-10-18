import { useCallback, useEffect, useState } from 'react';

// Front-end friction against scripted form submission and password guessing.
// It cannot stop someone calling the Auth API directly; that needs the
// Supabase-side rate limits / CAPTCHA settings.

const readLockUntil = (storageKey: string): number => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeLockUntil = (storageKey: string, until: number) => {
  try {
    if (until > 0) window.localStorage.setItem(storageKey, String(until));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable (private mode); the in-memory lock still applies.
  }
};

export const useAttemptLimiter = (storageKey: string, maxFailures: number, lockMs: number) => {
  const [failures, setFailures] = useState(0);
  const [lockUntil, setLockUntil] = useState(() => readLockUntil(storageKey));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockUntil]);

  const lockedSeconds = lockUntil > now ? Math.ceil((lockUntil - now) / 1000) : 0;

  const recordFailure = useCallback(() => {
    const nextFailures = failures + 1;
    if (nextFailures >= maxFailures) {
      const until = Date.now() + lockMs;
      writeLockUntil(storageKey, until);
      setLockUntil(until);
      setNow(Date.now());
      setFailures(0);
      return;
    }
    setFailures(nextFailures);
  }, [failures, maxFailures, lockMs, storageKey]);

  const recordSuccess = useCallback(() => {
    setFailures(0);
    writeLockUntil(storageKey, 0);
    setLockUntil(0);
  }, [storageKey]);

  return { lockedSeconds, recordFailure, recordSuccess };
};
