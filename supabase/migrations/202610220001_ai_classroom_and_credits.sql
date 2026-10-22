-- AI 课堂工作台 + AI 积分
--
-- 1. 积分：每个账号一个余额，所有变动写流水。生成前预扣，失败自动退回。
-- 2. 课堂：老师（社区账号）创建课堂，学生用 6 位口令 + 名字进入，不需要注册。
--    学生在课堂里的消耗记在老师账上；老师控制每个功能的开关、时长、每轮次数。
-- 3. 作品：问 AI / 画图 / 做视频的每一次提交。图片和视频存在私有 Storage bucket。
--
-- 所有表只允许服务端（Edge Function ai-classroom，service_role）读写；
-- 浏览器只能读自己的积分余额和流水。

-- ---------- 积分 ----------
create table if not exists public.ai_credit_settings (
  id boolean primary key default true check (id),
  welcome_credits integer not null default 100 check (welcome_credits >= 0),
  updated_at timestamptz not null default now()
);
insert into public.ai_credit_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.ai_credit_prices (
  kind text primary key check (kind in ('chat', 'vision', 't2i', 'i2i', 't2v', 'i2v')),
  credits integer not null check (credits >= 0),
  label text not null,
  updated_at timestamptz not null default now()
);
insert into public.ai_credit_prices (kind, credits, label) values
  ('chat', 1, '问 AI（文字）'),
  ('vision', 2, '问 AI（带图片）'),
  ('t2i', 10, '用文字画图'),
  ('i2i', 10, '改一张照片'),
  ('t2v', 60, '用文字做视频'),
  ('i2v', 60, '让图片动起来')
on conflict (kind) do nothing;

create table if not exists public.ai_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_granted integer not null default 0,
  lifetime_spent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text not null check (reason in ('welcome', 'grant', 'purchase', 'charge', 'refund', 'adjust')),
  ref_type text,
  ref_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ai_credit_ledger_user_created_idx on public.ai_credit_ledger (user_id, created_at desc);
-- 同一个作品最多扣一次、退一次
create unique index if not exists ai_credit_ledger_once_per_ref_idx
  on public.ai_credit_ledger (ref_type, ref_id, reason)
  where ref_type is not null and reason in ('charge', 'refund', 'purchase');

-- ---------- 课堂 ----------
create table if not exists public.ai_classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  join_code text not null unique check (join_code ~ '^[0-9]{6}$'),
  tools jsonb not null default '{
    "chat":  {"open": false, "until": null, "quota": 5, "round": 0, "task": ""},
    "image": {"open": false, "until": null, "quota": 2, "round": 0, "task": ""},
    "video": {"open": false, "until": null, "quota": 1, "round": 0, "task": ""}
  }'::jsonb,
  spend_limit integer check (spend_limit is null or spend_limit >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_classrooms_teacher_idx on public.ai_classrooms (teacher_id, created_at desc);

create table if not exists public.ai_classroom_students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.ai_classrooms(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 12),
  token_hash text not null unique,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ai_classroom_students_class_idx on public.ai_classroom_students (classroom_id, created_at);

create table if not exists public.ai_classroom_shared (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.ai_classrooms(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_classroom_shared_class_idx on public.ai_classroom_shared (classroom_id, created_at);

-- ---------- 作品 ----------
create table if not exists public.ai_works (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references public.ai_classrooms(id) on delete cascade,
  student_id uuid references public.ai_classroom_students(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,      -- 老师或自学用户本人；学生作品为空
  payer_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  tool text not null check (tool in ('chat', 'image', 'video')),
  kind text not null check (kind in ('chat', 'vision', 't2i', 'i2i', 't2v', 'i2v')),
  round integer not null default 0,
  prompt text not null check (char_length(prompt) between 1 and 800),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'unknown', 'waiting')),
  message text,
  provider_task_id text,
  model text,
  input_path text,
  output_path text,
  output_url text,
  output_text text,
  output_type text check (output_type in ('text', 'image', 'video')),
  cost integer not null default 0 check (cost >= 0),
  refunded boolean not null default false,
  hidden boolean not null default false,
  last_polled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_works_owner check (student_id is not null or user_id is not null or classroom_id is not null)
);
create index if not exists ai_works_class_created_idx on public.ai_works (classroom_id, created_at desc);
create index if not exists ai_works_user_created_idx on public.ai_works (user_id, created_at desc);
create index if not exists ai_works_student_created_idx on public.ai_works (student_id, created_at desc);
create index if not exists ai_works_pending_idx on public.ai_works (status) where status in ('queued', 'running', 'waiting');

-- ---------- updated_at ----------
drop trigger if exists update_ai_credit_accounts_updated_at on public.ai_credit_accounts;
create trigger update_ai_credit_accounts_updated_at before update on public.ai_credit_accounts
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_ai_classrooms_updated_at on public.ai_classrooms;
create trigger update_ai_classrooms_updated_at before update on public.ai_classrooms
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_ai_works_updated_at on public.ai_works;
create trigger update_ai_works_updated_at before update on public.ai_works
  for each row execute function public.update_updated_at_column();

-- ---------- 权限 ----------
alter table public.ai_credit_settings enable row level security;
alter table public.ai_credit_prices enable row level security;
alter table public.ai_credit_accounts enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_classrooms enable row level security;
alter table public.ai_classroom_students enable row level security;
alter table public.ai_classroom_shared enable row level security;
alter table public.ai_works enable row level security;

revoke all on public.ai_credit_settings, public.ai_credit_prices, public.ai_credit_accounts, public.ai_credit_ledger,
  public.ai_classrooms, public.ai_classroom_students, public.ai_classroom_shared, public.ai_works
  from anon, authenticated;
grant select on public.ai_credit_prices, public.ai_credit_accounts, public.ai_credit_ledger to authenticated;

drop policy if exists ai_credit_prices_read on public.ai_credit_prices;
create policy ai_credit_prices_read on public.ai_credit_prices for select to authenticated using (true);
drop policy if exists ai_credit_accounts_read_own on public.ai_credit_accounts;
create policy ai_credit_accounts_read_own on public.ai_credit_accounts for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
drop policy if exists ai_credit_ledger_read_own on public.ai_credit_ledger;
create policy ai_credit_ledger_read_own on public.ai_credit_ledger for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

-- ---------- 积分函数（只给服务端用） ----------
create or replace function public.ai_credit_ensure_account(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_welcome integer;
begin
  select balance into v_balance from public.ai_credit_accounts where user_id = p_user;
  if found then return v_balance; end if;
  select welcome_credits into v_welcome from public.ai_credit_settings where id;
  v_welcome := coalesce(v_welcome, 0);
  insert into public.ai_credit_accounts (user_id, balance, lifetime_granted)
  values (p_user, v_welcome, v_welcome)
  on conflict (user_id) do nothing;
  if found and v_welcome > 0 then
    insert into public.ai_credit_ledger (user_id, delta, balance_after, reason, note)
    values (p_user, v_welcome, v_welcome, 'welcome', '新用户赠送');
  end if;
  select balance into v_balance from public.ai_credit_accounts where user_id = p_user;
  return v_balance;
end;
$$;

create or replace function public.ai_credit_grant(p_user uuid, p_amount integer, p_reason text default 'grant', p_note text default null, p_ref_type text default null, p_ref_id text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_reason not in ('grant', 'purchase', 'adjust') then raise exception 'INVALID_REASON'; end if;
  perform public.ai_credit_ensure_account(p_user);
  update public.ai_credit_accounts
     set balance = balance + p_amount, lifetime_granted = lifetime_granted + p_amount
   where user_id = p_user
   returning balance into v_balance;
  insert into public.ai_credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, note)
  values (p_user, p_amount, v_balance, p_reason, p_ref_type, p_ref_id, p_note);
  return v_balance;
end;
$$;

-- 预约一次生成：检查课堂开关/次数/预算，按价格扣积分，并写入作品记录（状态 queued）。
-- 错误码：CLASS_NOT_FOUND / TOOL_CLOSED / QUOTA_EXCEEDED / CLASS_SPEND_LIMIT / INSUFFICIENT_CREDITS
create or replace function public.ai_work_reserve(
  p_kind text,
  p_prompt text,
  p_author_name text,
  p_classroom uuid default null,
  p_student uuid default null,
  p_user uuid default null,
  p_input_path text default null
)
returns public.ai_works
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool text;
  v_class public.ai_classrooms;
  v_state jsonb;
  v_round integer := 0;
  v_quota integer;
  v_used integer;
  v_payer uuid;
  v_cost integer;
  v_spent integer;
  v_balance integer;
  v_work public.ai_works;
begin
  v_tool := case when p_kind in ('chat', 'vision') then 'chat'
                 when p_kind in ('t2i', 'i2i') then 'image'
                 when p_kind in ('t2v', 'i2v') then 'video' end;
  if v_tool is null then raise exception 'INVALID_KIND'; end if;
  if p_student is null and p_user is null then raise exception 'NO_OWNER'; end if;

  select credits into v_cost from public.ai_credit_prices where kind = p_kind;
  v_cost := coalesce(v_cost, 0);

  if p_classroom is not null then
    -- 锁住课堂，保证同一课堂的次数和预算检查不会并发越界
    select * into v_class from public.ai_classrooms where id = p_classroom and archived_at is null for update;
    if not found then raise exception 'CLASS_NOT_FOUND'; end if;
    v_payer := v_class.teacher_id;
    v_state := v_class.tools -> v_tool;
    v_round := coalesce((v_state ->> 'round')::integer, 0);
    if p_student is not null then
      if not coalesce((v_state ->> 'open')::boolean, false)
         or (v_state ->> 'until' is not null and (v_state ->> 'until')::timestamptz <= now()) then
        raise exception 'TOOL_CLOSED';
      end if;
      v_quota := coalesce((v_state ->> 'quota')::integer, 0);
      select count(*) into v_used from public.ai_works
       where student_id = p_student and tool = v_tool and round = v_round and status <> 'failed';
      if v_used >= v_quota then raise exception 'QUOTA_EXCEEDED'; end if;
    end if;
    if v_class.spend_limit is not null then
      select coalesce(sum(cost), 0) into v_spent from public.ai_works
       where classroom_id = p_classroom and not refunded;
      if v_spent + v_cost > v_class.spend_limit then raise exception 'CLASS_SPEND_LIMIT'; end if;
    end if;
  else
    if p_user is null then raise exception 'NO_OWNER'; end if;
    v_payer := p_user;
  end if;

  perform public.ai_credit_ensure_account(v_payer);

  insert into public.ai_works (classroom_id, student_id, user_id, payer_id, author_name, tool, kind, round, prompt, input_path, cost, status, message)
  values (p_classroom, p_student, p_user, v_payer, left(p_author_name, 20), v_tool, p_kind, v_round, left(p_prompt, 800), p_input_path, v_cost, 'queued', '已提交，马上开始…')
  returning * into v_work;

  if v_cost > 0 then
    update public.ai_credit_accounts
       set balance = balance - v_cost, lifetime_spent = lifetime_spent + v_cost
     where user_id = v_payer and balance >= v_cost
     returning balance into v_balance;
    if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
    insert into public.ai_credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, note)
    values (v_payer, -v_cost, v_balance, 'charge', 'ai_work', v_work.id::text, v_tool || ':' || p_kind);
  end if;

  return v_work;
end;
$$;

-- 生成失败时退回积分（只会退一次）
create or replace function public.ai_work_refund(p_work uuid, p_message text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work public.ai_works;
  v_balance integer;
begin
  select * into v_work from public.ai_works where id = p_work for update;
  if not found then return false; end if;
  if v_work.refunded or v_work.cost = 0 then
    update public.ai_works set status = 'failed', message = coalesce(p_message, message), completed_at = coalesce(completed_at, now()) where id = p_work;
    return false;
  end if;
  update public.ai_credit_accounts
     set balance = balance + v_work.cost, lifetime_spent = greatest(0, lifetime_spent - v_work.cost)
   where user_id = v_work.payer_id
   returning balance into v_balance;
  insert into public.ai_credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, note)
  values (v_work.payer_id, v_work.cost, v_balance, 'refund', 'ai_work', p_work::text, '生成失败，自动退回');
  update public.ai_works
     set refunded = true, status = 'failed', message = coalesce(p_message, message), completed_at = coalesce(completed_at, now())
   where id = p_work;
  return true;
end;
$$;

-- 抢占一次查询机会，避免多个页面同时查询同一个任务（每 3 秒最多一次）
create or replace function public.ai_work_claim_poll(p_work uuid, p_min_seconds integer default 3)
returns boolean
language sql
security definer
set search_path = public
as $$
  with claimed as (
    update public.ai_works
       set last_polled_at = now()
     where id = p_work
       and status in ('running', 'waiting')
       and provider_task_id is not null
       and (last_polled_at is null or last_polled_at < now() - make_interval(secs => p_min_seconds))
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.ai_credit_ensure_account(uuid) from public;
revoke all on function public.ai_credit_grant(uuid, integer, text, text, text, text) from public;
revoke all on function public.ai_work_reserve(text, text, text, uuid, uuid, uuid, text) from public;
revoke all on function public.ai_work_refund(uuid, text) from public;
revoke all on function public.ai_work_claim_poll(uuid, integer) from public;
grant execute on function public.ai_credit_ensure_account(uuid) to service_role;
grant execute on function public.ai_credit_grant(uuid, integer, text, text, text, text) to service_role;
grant execute on function public.ai_work_reserve(text, text, text, uuid, uuid, uuid, text) to service_role;
grant execute on function public.ai_work_refund(uuid, text) to service_role;
grant execute on function public.ai_work_claim_poll(uuid, integer) to service_role;

-- ---------- Storage：私有 bucket，只由服务端读写，页面用短期签名链接 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-classroom', 'ai-classroom', false, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'video/mp4'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
