-- Qualify the route level column because the function also has an output
-- parameter named "level". Without the alias PostgreSQL raises SQLSTATE 42702.
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
