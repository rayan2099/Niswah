-- Community reactions production patch.
-- Run this once in Supabase SQL Editor to enable durable likes and comments.

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.community_post_likes is
  'One row per community post like. If a user likes a post, a row exists here.';
comment on column public.community_post_likes.post_id is
  'The community post that received the like.';
comment on column public.community_post_likes.user_id is
  'The authenticated user who liked the post.';

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  author_name text,
  is_anonymous boolean not null default false,
  content text not null check (length(trim(content)) > 0 and char_length(content) < 2000),
  created_at timestamptz not null default now()
);

comment on table public.community_post_comments is
  'User comments on community posts. Each row is one visible comment.';
comment on column public.community_post_comments.post_id is
  'The community post this comment belongs to.';
comment on column public.community_post_comments.author_id is
  'The authenticated user who wrote this comment.';
comment on column public.community_post_comments.author_name is
  'Display name shown on the comment when it is not anonymous.';
comment on column public.community_post_comments.is_anonymous is
  'When true, the UI hides the author display name for this comment.';
comment on column public.community_post_comments.content is
  'The visible text/body of the comment written by the user.';

create index if not exists community_post_comments_post_id_created_at_idx
  on public.community_post_comments(post_id, created_at);

alter table public.community_post_likes enable row level security;
alter table public.community_post_comments enable row level security;

drop policy if exists "community_post_likes_read_auth" on public.community_post_likes;
create policy "community_post_likes_read_auth"
on public.community_post_likes
for select
using (auth.role() = 'authenticated');

drop policy if exists "community_post_likes_insert_own" on public.community_post_likes;
create policy "community_post_likes_insert_own"
on public.community_post_likes
for insert
with check (auth.uid() = user_id);

drop policy if exists "community_post_likes_delete_own" on public.community_post_likes;
create policy "community_post_likes_delete_own"
on public.community_post_likes
for delete
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "community_post_comments_read_auth" on public.community_post_comments;
create policy "community_post_comments_read_auth"
on public.community_post_comments
for select
using (auth.role() = 'authenticated');

drop policy if exists "community_post_comments_insert_own" on public.community_post_comments;
create policy "community_post_comments_insert_own"
on public.community_post_comments
for insert
with check (auth.uid() = author_id);

drop policy if exists "community_post_comments_update_own" on public.community_post_comments;
create policy "community_post_comments_update_own"
on public.community_post_comments
for update
using (auth.uid() = author_id or public.is_admin())
with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "community_post_comments_delete_own" on public.community_post_comments;
create policy "community_post_comments_delete_own"
on public.community_post_comments
for delete
using (auth.uid() = author_id or public.is_admin());

notify pgrst, 'reload schema';
