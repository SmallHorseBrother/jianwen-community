-- suggestions
alter table public.suggestions enable row level security;

drop policy if exists "Public suggestions are viewable by everyone" on public.suggestions;
drop policy if exists "Users can insert their own suggestions" on public.suggestions;
drop policy if exists "Users can update their own suggestions" on public.suggestions;
drop policy if exists "Admins can update suggestions" on public.suggestions;
drop policy if exists "Admins can delete suggestions" on public.suggestions;
drop policy if exists suggestions_public_select on public.suggestions;
drop policy if exists suggestions_insert_own_pending on public.suggestions;
drop policy if exists suggestions_admin_update on public.suggestions;
drop policy if exists suggestions_admin_delete on public.suggestions;

create policy suggestions_public_select
  on public.suggestions
  for select
  to anon, authenticated
  using (true);

create policy suggestions_insert_own_pending
  on public.suggestions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and coalesce(admin_notes, '') = ''
  );

create policy suggestions_admin_update
  on public.suggestions
  for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy suggestions_admin_delete
  on public.suggestions
  for delete
  to authenticated
  using (public.is_app_admin());

-- check-in feed
alter table public.check_ins enable row level security;
alter table public.check_in_likes enable row level security;
alter table public.check_in_comments enable row level security;

drop policy if exists "Allow public read access for check_ins" on public.check_ins;
drop policy if exists "Allow authenticated insert for check_ins" on public.check_ins;
drop policy if exists "Allow users to update their own check_ins" on public.check_ins;
drop policy if exists "Allow users to delete their own check_ins" on public.check_ins;
drop policy if exists check_ins_public_select on public.check_ins;
drop policy if exists check_ins_insert_own on public.check_ins;
drop policy if exists check_ins_update_own on public.check_ins;
drop policy if exists check_ins_delete_own on public.check_ins;

create policy check_ins_public_select
  on public.check_ins
  for select
  to anon, authenticated
  using (true);

create policy check_ins_insert_own
  on public.check_ins
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy check_ins_update_own
  on public.check_ins
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin())
  with check (user_id = auth.uid() or public.is_app_admin());

create policy check_ins_delete_own
  on public.check_ins
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists "Allow public read access for check_in_likes" on public.check_in_likes;
drop policy if exists "Allow authenticated insert for check_in_likes" on public.check_in_likes;
drop policy if exists "Allow users to delete their own likes" on public.check_in_likes;
drop policy if exists check_in_likes_public_select on public.check_in_likes;
drop policy if exists check_in_likes_insert_own on public.check_in_likes;
drop policy if exists check_in_likes_delete_own on public.check_in_likes;

create policy check_in_likes_public_select
  on public.check_in_likes
  for select
  to anon, authenticated
  using (true);

create policy check_in_likes_insert_own
  on public.check_in_likes
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy check_in_likes_delete_own
  on public.check_in_likes
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists "Allow public read access for check_in_comments" on public.check_in_comments;
drop policy if exists "Allow authenticated insert for check_in_comments" on public.check_in_comments;
drop policy if exists "Allow users to delete their own comments" on public.check_in_comments;
drop policy if exists check_in_comments_public_select on public.check_in_comments;
drop policy if exists check_in_comments_insert_own on public.check_in_comments;
drop policy if exists check_in_comments_update_own on public.check_in_comments;
drop policy if exists check_in_comments_delete_own on public.check_in_comments;

create policy check_in_comments_public_select
  on public.check_in_comments
  for select
  to anon, authenticated
  using (true);

create policy check_in_comments_insert_own
  on public.check_in_comments
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy check_in_comments_update_own
  on public.check_in_comments
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin())
  with check (user_id = auth.uid() or public.is_app_admin());

create policy check_in_comments_delete_own
  on public.check_in_comments
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
