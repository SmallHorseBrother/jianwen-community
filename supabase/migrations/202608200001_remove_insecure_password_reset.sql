-- The legacy function could set any account's password when given a phone
-- number. It has no proof-of-possession step and must not remain callable by
-- either anonymous or authenticated clients.
drop function if exists public.reset_user_password(text, text);
