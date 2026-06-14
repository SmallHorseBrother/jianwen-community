-- Optional legacy moderation tables seen in older production reports.
do $$
begin
  if to_regclass('public.article_likes') is not null then
    alter table public.article_likes enable row level security;
    drop policy if exists article_likes_select_all on public.article_likes;
    drop policy if exists article_likes_insert_own on public.article_likes;
    drop policy if exists article_likes_delete_own on public.article_likes;
    create policy article_likes_select_all on public.article_likes for select to anon, authenticated using (true);
    create policy article_likes_insert_own on public.article_likes for insert to authenticated with check (user_id = auth.uid());
    create policy article_likes_delete_own on public.article_likes for delete to authenticated using (user_id = auth.uid() or public.is_app_admin());
  end if;

  if to_regclass('public.article_bookmarks') is not null then
    alter table public.article_bookmarks enable row level security;
    drop policy if exists article_bookmarks_select_own on public.article_bookmarks;
    drop policy if exists article_bookmarks_insert_own on public.article_bookmarks;
    drop policy if exists article_bookmarks_delete_own on public.article_bookmarks;
    create policy article_bookmarks_select_own on public.article_bookmarks for select to authenticated using (user_id = auth.uid() or public.is_app_admin());
    create policy article_bookmarks_insert_own on public.article_bookmarks for insert to authenticated with check (user_id = auth.uid());
    create policy article_bookmarks_delete_own on public.article_bookmarks for delete to authenticated using (user_id = auth.uid() or public.is_app_admin());
  end if;

  if to_regclass('public.article_reports') is not null then
    alter table public.article_reports enable row level security;
    drop policy if exists article_reports_insert_own on public.article_reports;
    drop policy if exists article_reports_admin_select on public.article_reports;
    drop policy if exists article_reports_admin_update on public.article_reports;
    create policy article_reports_insert_own on public.article_reports for insert to authenticated with check (reporter_id = auth.uid());
    create policy article_reports_admin_select on public.article_reports for select to authenticated using (public.is_app_admin() or reporter_id = auth.uid());
    create policy article_reports_admin_update on public.article_reports for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
  end if;

  if to_regclass('public.admin_applications') is not null then
    alter table public.admin_applications enable row level security;
    drop policy if exists admin_applications_select_own_or_admin on public.admin_applications;
    drop policy if exists admin_applications_insert_own on public.admin_applications;
    drop policy if exists admin_applications_admin_update on public.admin_applications;
    create policy admin_applications_select_own_or_admin on public.admin_applications for select to authenticated using (user_id = auth.uid() or public.is_app_admin());
    create policy admin_applications_insert_own on public.admin_applications for insert to authenticated with check (user_id = auth.uid());
    create policy admin_applications_admin_update on public.admin_applications for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
  end if;

  if to_regclass('public.admin_logs') is not null then
    alter table public.admin_logs enable row level security;
    drop policy if exists admin_logs_select_admin on public.admin_logs;
    drop policy if exists admin_logs_insert_admin on public.admin_logs;
    create policy admin_logs_select_admin on public.admin_logs for select to authenticated using (public.is_app_admin());
    create policy admin_logs_insert_admin on public.admin_logs for insert to authenticated with check (public.is_app_admin());
  end if;
end $$;
