-- questions and semantic graph
alter table public.questions enable row level security;

drop policy if exists "所有人可以查看已发布的问答" on public.questions;
drop policy if exists "用户可以查看自己的问题" on public.questions;
drop policy if exists "认证用户可以提问" on public.questions;
drop policy if exists "用户可以删除自己未回答的问题" on public.questions;
drop policy if exists "管理员可以查看所有问题" on public.questions;
drop policy if exists "管理员可以更新问题" on public.questions;
drop policy if exists "管理员可以删除问题" on public.questions;
drop policy if exists "questions_public_read_not_ignored" on public.questions;
drop policy if exists "questions_public_insert_pending" on public.questions;
drop policy if exists questions_public_read_not_ignored on public.questions;
drop policy if exists questions_public_insert_pending on public.questions;
drop policy if exists questions_admin_update on public.questions;
drop policy if exists questions_delete_owner_pending_or_admin on public.questions;

create policy questions_public_read_not_ignored
  on public.questions
  for select
  to anon, authenticated
  using (status <> 'ignored' or asker_id = auth.uid() or public.is_app_admin());

create policy questions_public_insert_pending
  on public.questions
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and answer is null
    and answered_at is null
    and (asker_id is null or asker_id = auth.uid())
  );

create policy questions_admin_update
  on public.questions
  for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy questions_delete_owner_pending_or_admin
  on public.questions
  for delete
  to authenticated
  using ((asker_id = auth.uid() and status = 'pending') or public.is_app_admin());

alter table public.question_edges enable row level security;

drop policy if exists "question_edges_public_read" on public.question_edges;
drop policy if exists question_edges_public_read on public.question_edges;

create policy question_edges_public_read
  on public.question_edges
  for select
  to anon, authenticated
  using (true);

alter table public.question_reactions enable row level security;

drop policy if exists "question_reactions_select_all" on public.question_reactions;
drop policy if exists "question_reactions_insert_all" on public.question_reactions;
drop policy if exists question_reactions_select_all on public.question_reactions;
drop policy if exists question_reactions_insert_valid on public.question_reactions;

create policy question_reactions_select_all
  on public.question_reactions
  for select
  to anon, authenticated
  using (true);

create policy question_reactions_insert_valid
  on public.question_reactions
  for insert
  to anon, authenticated
  with check (
    reaction_type = 'same_question'
    and (
      (auth.uid() is null and anon_key is not null and user_id is null)
      or (auth.uid() is not null and user_id = auth.uid())
    )
  );

alter table public.community_answers enable row level security;

drop policy if exists "community_answers_select_all" on public.community_answers;
drop policy if exists "community_answers_insert_own" on public.community_answers;
drop policy if exists "community_answers_update_own" on public.community_answers;
drop policy if exists "community_answers_delete_own" on public.community_answers;
drop policy if exists community_answers_select_all on public.community_answers;
drop policy if exists community_answers_insert_own on public.community_answers;
drop policy if exists community_answers_update_own on public.community_answers;
drop policy if exists community_answers_delete_own_or_admin on public.community_answers;

create policy community_answers_select_all
  on public.community_answers
  for select
  to anon, authenticated
  using (true);

create policy community_answers_insert_own
  on public.community_answers
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy community_answers_update_own
  on public.community_answers
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin())
  with check (user_id = auth.uid() or public.is_app_admin());

create policy community_answers_delete_own_or_admin
  on public.community_answers
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
