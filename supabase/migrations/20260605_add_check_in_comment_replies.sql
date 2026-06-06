-- Add lightweight reply support for check-in comments.

alter table public.check_in_comments
  add column if not exists parent_comment_id uuid,
  add column if not exists reply_to_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'check_in_comments_parent_comment_id_fkey'
  ) then
    alter table public.check_in_comments
      add constraint check_in_comments_parent_comment_id_fkey
      foreign key (parent_comment_id)
      references public.check_in_comments(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'check_in_comments_reply_to_user_id_fkey'
  ) then
    alter table public.check_in_comments
      add constraint check_in_comments_reply_to_user_id_fkey
      foreign key (reply_to_user_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_check_in_comments_parent
  on public.check_in_comments(parent_comment_id);

create index if not exists idx_check_in_comments_reply_to_user
  on public.check_in_comments(reply_to_user_id);
