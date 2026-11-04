-- 热修复：把“只给服务端用”的函数对浏览器端角色关掉
--
-- 原因：Supabase 会给 public 里新建的函数单独授予 anon、authenticated 执行权限（默认权限），
-- 以前的迁移只写了 `revoke ... from public`，收不回这两个单独的授权。结果登录用户可以在浏览器里直接
-- supabase.rpc('complete_ai_group_order' / 'ai_credit_grant' / ...)，不付钱就解锁入群、给自己加积分、把成功的作品退款。
--
-- 这个脚本只改函数的执行权限，不改任何数据；Edge Function 用 service_role 调用，不受影响。
-- 可以单独执行，也可以重复执行；某个函数不存在时跳过。

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.complete_ai_group_order(text, text, text, text, timestamptz, jsonb)',
    'public.ai_credit_ensure_account(uuid)',
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

-- 执行后检查：下面每一行的 authenticated、anon 两列都应该是 false
-- select p.oid::regprocedure as fn,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
--        has_function_privilege('anon', p.oid, 'execute') as anon
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('complete_ai_group_order', 'ai_credit_ensure_account', 'ai_credit_grant', 'ai_work_reserve',
--                     'ai_work_refund', 'ai_work_claim_poll', 'ai_credit_day_start', 'complete_shop_order');
