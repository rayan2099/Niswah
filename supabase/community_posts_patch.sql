-- Community posts production patch.
-- Run this once in Supabase SQL Editor if posting fails with missing columns.

alter table public.community_posts add column if not exists author_name text;
alter table public.community_posts add column if not exists category text not null default 'general';
alter table public.community_posts add column if not exists content text;
alter table public.community_posts add column if not exists is_anonymous boolean not null default false;
alter table public.community_posts add column if not exists like_user_ids jsonb not null default '[]'::jsonb;
alter table public.community_posts add column if not exists comments jsonb not null default '[]'::jsonb;
alter table public.community_posts add column if not exists created_at timestamptz not null default now();
alter table public.community_posts add column if not exists updated_at timestamptz not null default now();

comment on table public.community_posts is
  'Women community feed posts. Each row is one user-created post shown in the Niswah community tab.';
comment on column public.community_posts.content is
  'The visible text/body of the community post written by the user.';
comment on column public.community_posts.category is
  'Post topic category: general, health, fiqh, or mental.';
comment on column public.community_posts.author_name is
  'Display name shown on the post when the post is not anonymous.';
comment on column public.community_posts.is_anonymous is
  'When true, the UI hides the author display name and shows guest/sister wording.';
comment on column public.community_posts.comments is
  'JSON array of lightweight comments attached to this post.';
comment on column public.community_posts.like_user_ids is
  'JSON array of auth user ids that liked this post.';

update public.community_posts
set content = 'مشاركة قديمة'
where content is null or length(trim(content)) = 0;

update public.community_posts
set category = 'general'
where category is null or category not in ('health', 'fiqh', 'mental', 'general');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_posts_category_check'
  ) then
    alter table public.community_posts
      add constraint community_posts_category_check
      check (category in ('health', 'fiqh', 'mental', 'general'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_posts_content_not_empty'
  ) then
    alter table public.community_posts
      add constraint community_posts_content_not_empty
      check (content is not null and length(trim(content)) > 0 and char_length(content) < 5000);
  end if;
end $$;

alter table public.community_posts enable row level security;

drop policy if exists "community_posts_read_auth" on public.community_posts;
create policy "community_posts_read_auth"
on public.community_posts
for select
using (auth.role() = 'authenticated');

drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own"
on public.community_posts
for insert
with check (auth.uid() = author_id);

drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own"
on public.community_posts
for update
using (auth.uid() = author_id or public.is_admin())
with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "community_posts_delete_own" on public.community_posts;
create policy "community_posts_delete_own"
on public.community_posts
for delete
using (auth.uid() = author_id or public.is_admin());

notify pgrst, 'reload schema';
