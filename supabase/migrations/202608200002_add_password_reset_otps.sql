-- Password reset codes are written and read only by the password-reset Edge
-- Function (service-role client). Browser roles receive no access to this data.
create table if not exists public.password_reset_otps (
  phone text primary key check (phone ~ '^1[3-9][0-9]{9}$'),
  code_hash text not null,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.password_reset_otps enable row level security;
revoke all on table public.password_reset_otps from anon, authenticated;

drop trigger if exists set_password_reset_otps_updated_at on public.password_reset_otps;
create trigger set_password_reset_otps_updated_at
before update on public.password_reset_otps
for each row execute function public.set_updated_at();
