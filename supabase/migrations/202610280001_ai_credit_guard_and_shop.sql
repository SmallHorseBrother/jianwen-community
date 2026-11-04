-- AI 积分风控 + 积分包
--
-- 依赖 202610220001_ai_classroom_and_credits.sql，必须在它之后执行。脚本可以重复执行。
-- 0001 已经执行过以后不要再执行 0001；如果误执行了，再执行一次本文件即可恢复（会删掉 0001 重建的旧版函数）。
--
-- 1. 风控（都在 ai_credit_settings 里改，null 表示不限制）
--    · 新用户赠送 30 积分；同一网络（IP 的哈希，不存原始 IP）24 小时内最多 3 个新账号能拿到赠送
--    · 登录用户自己提交（实验室、老师演示）每人每分钟最多 6 次；学生在课堂里的提交由老师的开关、次数和预算管
--    · 全站每日消耗熔断 global_daily_limit，默认不开；开了以后超过当天额度，所有生成暂停到第二天（北京时间）
-- 2. 积分包
--    · shop_products：可售商品，目前只有积分包；以后的课程、报告也放这里
--    · shop_orders：通用订单，订单号以 SP 开头；下单和支付回调由 Edge Function ai-group-payment 处理
--    · complete_shop_order：支付成功后标记订单并发放积分，同一订单只会入账一次

-- ---------- 风控设置 ----------
alter table public.ai_credit_settings
  add column if not exists welcome_per_ip_daily integer default 3 check (welcome_per_ip_daily is null or welcome_per_ip_daily >= 0),
  add column if not exists personal_rate_per_minute integer default 6 check (personal_rate_per_minute is null or personal_rate_per_minute >= 1),
  add column if not exists global_daily_limit integer check (global_daily_limit is null or global_daily_limit >= 0);
alter table public.ai_credit_settings alter column welcome_credits set default 30;
-- 只改还停在旧默认值的情况，管理员之后手动改过的值不会被覆盖
update public.ai_credit_settings set welcome_credits = 30 where id and welcome_credits = 100;

alter table public.ai_credit_accounts
  add column if not exists signup_ip_hash text,
  add column if not exists welcome_granted integer not null default 0;
create index if not exists ai_credit_accounts_ip_created_idx
  on public.ai_credit_accounts (signup_ip_hash, created_at desc) where signup_ip_hash is not null;
-- 熔断统计按原因和时间查流水
create index if not exists ai_credit_ledger_reason_created_idx on public.ai_credit_ledger (reason, created_at);

-- 北京时间今天 0 点
create or replace function public.ai_credit_day_start()
returns timestamptz
language sql
stable
set search_path = public
as $$ select date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai' $$;

-- 建账号时带上注册网络的哈希：同一网络 24 小时内领过赠送的账号达到上限后，新账号余额从 0 开始
drop function if exists public.ai_credit_ensure_account(uuid);
create or replace function public.ai_credit_ensure_account(p_user uuid, p_ip_hash text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_welcome integer;
  v_per_ip integer;
  v_recent integer;
begin
  select balance into v_balance from public.ai_credit_accounts where user_id = p_user;
  if found then return v_balance; end if;
  -- 同一网络同时建号时排队，保证“24 小时内最多 N 个”的计数不会被并发请求绕过
  if p_ip_hash is not null then perform pg_advisory_xact_lock(hashtextextended('ai_credit_ip:' || p_ip_hash, 0)); end if;
  select welcome_credits, welcome_per_ip_daily into v_welcome, v_per_ip from public.ai_credit_settings where id;
  v_welcome := coalesce(v_welcome, 0);
  if v_welcome > 0 and v_per_ip is not null and p_ip_hash is not null then
    select count(*) into v_recent from public.ai_credit_accounts
     where signup_ip_hash = p_ip_hash and welcome_granted > 0 and created_at > now() - interval '24 hours';
    if v_recent >= v_per_ip then v_welcome := 0; end if;
  end if;
  insert into public.ai_credit_accounts (user_id, balance, lifetime_granted, signup_ip_hash, welcome_granted)
  values (p_user, v_welcome, v_welcome, p_ip_hash, v_welcome)
  on conflict (user_id) do nothing;
  if found and v_welcome > 0 then
    insert into public.ai_credit_ledger (user_id, delta, balance_after, reason, note)
    values (p_user, v_welcome, v_welcome, 'welcome', '新用户赠送');
  end if;
  select balance into v_balance from public.ai_credit_accounts where user_id = p_user;
  return v_balance;
end;
$$;

-- 预约一次生成：在原有检查（课堂开关/次数/预算、余额）之外，加上个人限流和全站熔断。
-- 新错误码：RATE_LIMITED / PLATFORM_PAUSED
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
  v_rate integer;
  v_global integer;
  v_recent integer;
  v_today integer;
  v_work public.ai_works;
begin
  v_tool := case when p_kind in ('chat', 'vision') then 'chat'
                 when p_kind in ('t2i', 'i2i') then 'image'
                 when p_kind in ('t2v', 'i2v') then 'video' end;
  if v_tool is null then raise exception 'INVALID_KIND'; end if;
  if p_student is null and p_user is null then raise exception 'NO_OWNER'; end if;

  select credits into v_cost from public.ai_credit_prices where kind = p_kind;
  v_cost := coalesce(v_cost, 0);
  select personal_rate_per_minute, global_daily_limit into v_rate, v_global from public.ai_credit_settings where id;

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

  -- 付款账号不存在时只建一个 0 余额的（赠送积分只在带网络信息的 ai_credit_ensure_account 里发），
  -- 然后锁住这一行：同一账号的并发提交在这里排队，下面的限流计数和扣费都不会被并发绕过
  insert into public.ai_credit_accounts (user_id) values (v_payer) on conflict (user_id) do nothing;
  perform 1 from public.ai_credit_accounts where user_id = v_payer for update;

  -- 个人限流：登录用户自己提交（实验室、老师演示）时，最近 1 分钟内的提交数（含失败的）；学生在课堂里提交不算
  if p_student is null and v_rate is not null then
    select count(*) into v_recent from public.ai_works
     where user_id = p_user and created_at > now() - interval '1 minute';
    if v_recent >= v_rate then raise exception 'RATE_LIMITED'; end if;
  end if;

  -- 全站熔断：北京时间今天的净消耗（扣费减退回）
  if v_global is not null and v_cost > 0 then
    select coalesce(-sum(delta), 0) into v_today from public.ai_credit_ledger
     where reason in ('charge', 'refund') and created_at >= public.ai_credit_day_start();
    if v_today + v_cost > v_global then raise exception 'PLATFORM_PAUSED'; end if;
  end if;

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

-- 每天的积分进出（北京时间）。只给 SQL Editor 和服务端看：select * from ai_credit_daily_usage limit 14;
create or replace view public.ai_credit_daily_usage
with (security_invoker = on) as
select
  (created_at at time zone 'Asia/Shanghai')::date as day,
  coalesce(-sum(delta) filter (where reason = 'charge'), 0) as charged,
  coalesce(sum(delta) filter (where reason = 'refund'), 0) as refunded,
  coalesce(-sum(delta) filter (where reason in ('charge', 'refund')), 0) as net_spent,
  coalesce(sum(delta) filter (where reason = 'purchase'), 0) as purchased,
  coalesce(sum(delta) filter (where reason = 'welcome'), 0) as welcome,
  count(distinct user_id) filter (where reason = 'charge') as paying_users
from public.ai_credit_ledger
group by 1
order by 1 desc;

-- ---------- 积分包：商品 ----------
create table if not exists public.shop_products (
  code text primary key check (code ~ '^[a-z0-9-]{2,40}$'),
  kind text not null check (kind in ('credit_pack')),
  title text not null check (char_length(title) between 1 and 40),
  description text not null default '',
  price_cents integer not null check (price_cents > 0),
  credits integer check (credits is null or credits > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_products_pack_has_credits check (kind <> 'credit_pack' or credits is not null)
);

insert into public.shop_products (code, kind, title, description, price_cents, credits, sort_order) values
  ('credits-100', 'credit_pack', '尝鲜包', '', 990, 100, 10),
  ('credits-330', 'credit_pack', '常用包', '多送约 10%', 2990, 330, 20),
  ('credits-1200', 'credit_pack', '课堂包', '多送 20%', 9900, 1200, 30)
on conflict (code) do nothing;

-- ---------- 积分包：订单 ----------
create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null references public.shop_products(code),
  product_kind text not null check (product_kind in ('credit_pack')),
  credits integer check (credits is null or credits > 0),  -- 下单时的积分数，之后改价不影响已下的单
  order_no text not null unique check (order_no ~ '^SP[0-9A-Z]{10,40}$'),
  provider text not null check (provider in ('wechat', 'alipay')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'CNY' check (currency = 'CNY'),
  subject text not null,
  status text not null default 'pending' check (status in ('pending', 'created', 'paid', 'expired', 'failed')),
  provider_status text,
  provider_trade_no text,
  provider_code_url text,
  provider_payment_url text,
  provider_payload jsonb,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_orders_pack_has_credits check (product_kind <> 'credit_pack' or credits is not null)
);
create index if not exists shop_orders_user_created_idx on public.shop_orders (user_id, created_at desc);

drop trigger if exists update_shop_products_updated_at on public.shop_products;
create trigger update_shop_products_updated_at before update on public.shop_products
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_shop_orders_updated_at on public.shop_orders;
create trigger update_shop_orders_updated_at before update on public.shop_orders
  for each row execute function public.update_updated_at_column();

-- ---------- 权限 ----------
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
revoke all on public.shop_products, public.shop_orders, public.ai_credit_daily_usage from anon, authenticated;
grant select on public.shop_products to anon, authenticated;
grant select on public.shop_orders to authenticated;

drop policy if exists shop_products_read_active on public.shop_products;
create policy shop_products_read_active on public.shop_products for select to anon, authenticated using (active);
drop policy if exists shop_orders_read_own on public.shop_orders;
create policy shop_orders_read_own on public.shop_orders for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

-- ---------- 支付成功：标记订单并发放 ----------
-- 回调重试、主动查单和回调同时到达，都只会入账一次（订单行锁 + 流水唯一索引）。
-- 错误码：ORDER_NOT_FOUND / PROVIDER_MISMATCH / AMOUNT_MISMATCH
create or replace function public.complete_shop_order(
  p_order_no text,
  p_provider text,
  p_amount_cents integer,
  p_provider_trade_no text,
  p_provider_status text,
  p_paid_at timestamptz default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns table (order_status text, granted_credits integer, balance_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shop_orders%rowtype;
  v_balance integer;
begin
  select * into v_order from public.shop_orders where order_no = p_order_no for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  -- 用 is distinct from：回调里缺字段（null）时也要拒绝，不能因为比较结果是 null 就放行
  if v_order.provider is distinct from p_provider then raise exception 'PROVIDER_MISMATCH'; end if;
  if v_order.amount_cents is distinct from p_amount_cents then raise exception 'AMOUNT_MISMATCH'; end if;

  if v_order.status = 'paid' then
    select a.balance into v_balance from public.ai_credit_accounts a where a.user_id = v_order.user_id;
    return query select 'paid'::text, v_order.credits, v_balance;
    return;
  end if;

  update public.shop_orders
     set status = 'paid',
         provider_status = p_provider_status,
         provider_trade_no = nullif(p_provider_trade_no, ''),
         provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
         paid_at = coalesce(p_paid_at, now()),
         fulfilled_at = now()
   where id = v_order.id;

  if v_order.product_kind = 'credit_pack' then
    v_balance := public.ai_credit_grant(v_order.user_id, v_order.credits, 'purchase', v_order.subject, 'shop_order', v_order.order_no);
  end if;

  return query select 'paid'::text, v_order.credits, v_balance;
end;
$$;

-- ---------- 函数权限：只给服务端 ----------
-- Supabase 会给 public 里新建的函数单独授予 anon、authenticated 执行权限，只 `revoke from public` 收不回来，
-- 所以这里对三个角色都显式收回。0001 和入群支付里的服务端函数一起收紧（和 202610280000 热修复相同，重复执行无害）。
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.complete_ai_group_order(text, text, text, text, timestamptz, jsonb)',
    'public.ai_credit_ensure_account(uuid, text)',
    'public.ai_credit_grant(uuid, integer, text, text, text, text)',
    'public.ai_work_reserve(text, text, text, uuid, uuid, uuid, text)',
    'public.ai_work_refund(uuid, text)',
    'public.ai_work_claim_poll(uuid, integer)',
    'public.ai_credit_day_start()',
    'public.complete_shop_order(text, text, integer, text, text, timestamptz, jsonb)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end
$$;
