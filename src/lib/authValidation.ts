// Account identifiers are mainland mobile numbers; the Auth email is derived from them.
// Same pattern as supabase/functions/password-reset so both flows agree on what a phone is.
export const MAINLAND_PHONE_PATTERN = /^1[3-9]\d{9}$/;

export const normalizePhone = (value: string): string => value.replace(/\s+/g, '');

export const isValidMainlandPhone = (value: string): boolean =>
  MAINLAND_PHONE_PATTERN.test(value);

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_NICKNAME_LENGTH = 20;
