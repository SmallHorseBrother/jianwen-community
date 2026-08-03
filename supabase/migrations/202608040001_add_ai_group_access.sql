-- AI 学习起点测评、付费入群与唯一群昵称
--
-- 流程：认证用户完成免费测评 -> 创建支付订单 -> 支付回调验签成功后
-- 由服务端生成唯一群昵称，并且只为已解锁用户签发对应群二维码的短期访问链接。

create table if not exists public.ai_group_routes (
  level text primary key check (level in ('starter', 'application', 'practice')),
  group_name text not null,
  id_prefix text not null unique,
  description text not null,
  qr_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ai_group_routes (level, group_name, id_prefix, description)
values
  ('starter', 'AI 启蒙群', 'AI-S', '从认识 AI、表达需求到完成第一个真实任务。'),
  ('application', 'AI 应用群', 'AI-A', '把 AI 用进办公、学习、内容和日常工作流。'),
  ('practice', 'AI 实战群', 'AI-P', '面向自动化、多工具协作和 AI 项目实践。')
on conflict (level) do update
set
  group_name = excluded.group_name,
  id_prefix = excluded.id_prefix,
  description = excluded.description,
  updated_at = now();

create table if not exists public.ai_assessments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null,
  score smallint not null check (score between 0 and 16),
  level text not null references public.ai_group_routes(level),
  learning_goal text not null check (learning_goal in ('office', 'content', 'learning', 'product', 'programming')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_group_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  route_level text not null references public.ai_group_routes(level),
  access_status text not null default 'pending_payment' check (access_status in ('pending_payment', 'active', 'revoked')),
  display_id text unique,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_ai_group_membership_requires_display_id
    check (access_status <> 'active' or display_id is not null)
);

create table if not exists public.ai_group_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid not null references public.ai_group_memberships(id) on delete cascade,
  order_no text not null unique,
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
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_group_orders_membership_created_idx
  on public.ai_group_orders (membership_id, created_at desc);
create index if not exists ai_group_orders_user_created_idx
  on public.ai_group_orders (user_id, created_at desc);

drop trigger if exists update_ai_group_routes_updated_at on public.ai_group_routes;
create trigger update_ai_group_routes_updated_at
  before update on public.ai_group_routes
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ai_assessments_updated_at on public.ai_assessments;
create trigger update_ai_assessments_updated_at
  before update on public.ai_assessments
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ai_group_memberships_updated_at on public.ai_group_memberships;
create trigger update_ai_group_memberships_updated_at
  before update on public.ai_group_memberships
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ai_group_orders_updated_at on public.ai_group_orders;
create trigger update_ai_group_orders_updated_at
  before update on public.ai_group_orders
  for each row execute function public.update_updated_at_column();

alter table public.ai_group_routes enable row level security;
alter table public.ai_assessments enable row level security;
alter table public.ai_group_memberships enable row level security;
alter table public.ai_group_orders enable row level security;

drop policy if exists ai_assessments_select_own_or_admin on public.ai_assessments;
create policy ai_assessments_select_own_or_admin
  on public.ai_assessments for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists ai_group_memberships_select_own_or_admin on public.ai_group_memberships;
create policy ai_group_memberships_select_own_or_admin
  on public.ai_group_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists ai_group_orders_select_own_or_admin on public.ai_group_orders;
create policy ai_group_orders_select_own_or_admin
  on public.ai_group_orders for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists ai_group_routes_admin_manage on public.ai_group_routes;
create policy ai_group_routes_admin_manage
  on public.ai_group_routes for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

revoke all on public.ai_group_routes, public.ai_assessments, public.ai_group_memberships, public.ai_group_orders from anon, authenticated;
grant select on public.ai_assessments, public.ai_group_memberships, public.ai_group_orders to authenticated;

-- The client submits answers only; the database owns score calculation and grouping.
create or replace function public.submit_ai_assessment(
  p_answers jsonb,
  p_learning_goal text
)
returns table (
  score smallint,
  level text,
  group_name text,
  description text,
  has_group_access boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_answer text;
  v_score integer := 0;
  v_level text;
  v_membership public.ai_group_memberships%rowtype;
  v_route public.ai_group_routes%rowtype;
begin
  if v_user_id is null then
    raise exception '请先登录后再提交测评';
  end if;

  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 8 then
    raise exception '测评答案必须包含 8 题';
  end if;

  for v_answer in select jsonb_array_elements_text(p_answers)
  loop
    if v_answer !~ '^[0-2]$' then
      raise exception '每题答案必须是 0 到 2';
    end if;
    v_score := v_score + v_answer::integer;
  end loop;

  if p_learning_goal not in ('office', 'content', 'learning', 'product', 'programming') then
    raise exception '学习目标无效';
  end if;

  v_level := case
    when v_score <= 5 then 'starter'
    when v_score <= 10 then 'application'
    else 'practice'
  end;

  insert into public.ai_assessments (user_id, answers, score, level, learning_goal)
  values (v_user_id, p_answers, v_score, v_level, p_learning_goal)
  on conflict (user_id) do update
  set
    answers = excluded.answers,
    score = excluded.score,
    level = excluded.level,
    learning_goal = excluded.learning_goal,
    updated_at = now();

  select * into v_membership
  from public.ai_group_memberships
  where user_id = v_user_id
  for update;

  if not found then
    insert into public.ai_group_memberships (user_id, route_level)
    values (v_user_id, v_level)
    returning * into v_membership;
  elsif v_membership.access_status <> 'active' then
    update public.ai_group_memberships
    set route_level = v_level, updated_at = now()
    where id = v_membership.id
    returning * into v_membership;
  end if;

  select * into v_route
  from public.ai_group_routes as route
  where route.level = v_membership.route_level;

  return query select
    v_score::smallint,
    v_membership.route_level,
    v_route.group_name,
    v_route.description,
    v_membership.access_status = 'active';
end;
$$;

revoke all on function public.submit_ai_assessment(jsonb, text) from public;
grant execute on function public.submit_ai_assessment(jsonb, text) to authenticated;

-- Called only by the payment Edge Function after it has verified a provider callback.
-- It locks the order, makes fulfillment idempotent, and creates the unique group nickname.
create or replace function public.complete_ai_group_order(
  p_order_no text,
  p_provider text,
  p_provider_trade_no text,
  p_provider_status text,
  p_paid_at timestamptz,
  p_provider_payload jsonb default '{}'::jsonb
)
returns table (display_id text, route_level text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.ai_group_orders%rowtype;
  v_membership public.ai_group_memberships%rowtype;
  v_display_id text;
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_position integer;
begin
  select * into v_order
  from public.ai_group_orders
  where order_no = p_order_no
  for update;

  if not found then
    raise exception '订单不存在';
  end if;

  if v_order.provider <> p_provider then
    raise exception '支付渠道与订单不匹配';
  end if;

  select * into v_membership
  from public.ai_group_memberships
  where id = v_order.membership_id
  for update;

  if not found then
    raise exception '入群权益不存在';
  end if;

  if v_order.status <> 'paid' then
    update public.ai_group_orders
    set
      status = 'paid',
      provider_status = p_provider_status,
      provider_trade_no = coalesce(nullif(p_provider_trade_no, ''), provider_trade_no),
      provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
      paid_at = coalesce(p_paid_at, now()),
      updated_at = now()
    where id = v_order.id;
  end if;

  if v_membership.access_status <> 'active' or v_membership.display_id is null then
    loop
      v_display_id := '';
      for v_position in 1..4 loop
        v_display_id := v_display_id || substr(
          v_alphabet,
          1 + floor(random() * length(v_alphabet))::integer,
          1
        );
      end loop;
      begin
        update public.ai_group_memberships
        set
          access_status = 'active',
          display_id = v_display_id,
          activated_at = coalesce(activated_at, now()),
          updated_at = now()
        where id = v_membership.id;
        exit;
      exception when unique_violation then
        -- Extremely unlikely; generate a new suffix and keep the transaction atomic.
      end;
    end loop;
  else
    v_display_id := v_membership.display_id;
  end if;

  return query select v_display_id, v_membership.route_level;
end;
$$;

revoke all on function public.complete_ai_group_order(text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.complete_ai_group_order(text, text, text, text, timestamptz, jsonb) to service_role;

-- Group QR images are private. The payment Edge Function creates 10-minute signed URLs
-- only after it verifies that the current user has an active membership.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-group-qr', 'ai-group-qr', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
