-- articles
alter table public.articles enable row level security;

drop policy if exists "所有人可以查看已发布的文章" on public.articles;
drop policy if exists "作者可以查看自己的所有文章" on public.articles;
drop policy if exists "认证用户可以创建文章" on public.articles;
drop policy if exists "作者可以更新自己的文章" on public.articles;
drop policy if exists "作者可以删除自己的文章" on public.articles;
drop policy if exists articles_select_published_or_author_or_admin on public.articles;
drop policy if exists articles_insert_author_or_admin on public.articles;
drop policy if exists articles_update_author_or_admin on public.articles;
drop policy if exists articles_delete_author_or_admin on public.articles;

create policy articles_select_published_or_author_or_admin
  on public.articles
  for select
  to anon, authenticated
  using (is_published = true or auth.uid() = author_id or public.is_app_admin());

create policy articles_insert_author_or_admin
  on public.articles
  for insert
  to authenticated
  with check (auth.uid() = author_id or public.is_app_admin());

create policy articles_update_author_or_admin
  on public.articles
  for update
  to authenticated
  using (auth.uid() = author_id or public.is_app_admin())
  with check (auth.uid() = author_id or public.is_app_admin());

create policy articles_delete_author_or_admin
  on public.articles
  for delete
  to authenticated
  using (auth.uid() = author_id or public.is_app_admin());

-- tasks
alter table public.tasks enable row level security;

drop policy if exists "用户可以查看自己的任务" on public.tasks;
drop policy if exists "用户可以创建自己的任务" on public.tasks;
drop policy if exists "用户可以更新自己的任务" on public.tasks;
drop policy if exists "用户可以删除自己的任务" on public.tasks;
drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_insert_own on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
drop policy if exists tasks_delete_own on public.tasks;

create policy tasks_select_own
  on public.tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy tasks_insert_own
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy tasks_update_own
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tasks_delete_own
  on public.tasks
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- matching/community relationship tables
alter table public.user_connections enable row level security;
alter table public.match_preferences enable row level security;
alter table public.community_activities enable row level security;

drop policy if exists "用户可以查看自己的连接" on public.user_connections;
drop policy if exists "用户可以创建连接" on public.user_connections;
drop policy if exists "用户可以更新自己发起的连接" on public.user_connections;
drop policy if exists "用户可以删除自己的连接" on public.user_connections;
drop policy if exists user_connections_select_related on public.user_connections;
drop policy if exists user_connections_insert_own on public.user_connections;
drop policy if exists user_connections_update_related on public.user_connections;
drop policy if exists user_connections_delete_own on public.user_connections;

create policy user_connections_select_related
  on public.user_connections
  for select
  to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_app_admin());

create policy user_connections_insert_own
  on public.user_connections
  for insert
  to authenticated
  with check (from_user_id = auth.uid() or public.is_app_admin());

create policy user_connections_update_related
  on public.user_connections
  for update
  to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_app_admin())
  with check (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_app_admin());

create policy user_connections_delete_own
  on public.user_connections
  for delete
  to authenticated
  using (from_user_id = auth.uid() or public.is_app_admin());

drop policy if exists "用户可以查看自己的匹配偏好" on public.match_preferences;
drop policy if exists "用户可以管理自己的匹配偏好" on public.match_preferences;
drop policy if exists match_preferences_select_own on public.match_preferences;
drop policy if exists match_preferences_insert_own on public.match_preferences;
drop policy if exists match_preferences_update_own on public.match_preferences;
drop policy if exists match_preferences_delete_own on public.match_preferences;

create policy match_preferences_select_own
  on public.match_preferences
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

create policy match_preferences_insert_own
  on public.match_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_app_admin());

create policy match_preferences_update_own
  on public.match_preferences
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin())
  with check (user_id = auth.uid() or public.is_app_admin());

create policy match_preferences_delete_own
  on public.match_preferences
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists "用户可以查看相关的活动记录" on public.community_activities;
drop policy if exists "用户可以创建活动记录" on public.community_activities;
drop policy if exists community_activities_select_related on public.community_activities;
drop policy if exists community_activities_insert_own on public.community_activities;

create policy community_activities_select_related
  on public.community_activities
  for select
  to authenticated
  using (user_id = auth.uid() or target_user_id = auth.uid() or public.is_app_admin());

create policy community_activities_insert_own
  on public.community_activities
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_app_admin());
