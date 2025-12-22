-- 20251223_add_check_in_system.sql

-- 1. 创建打卡表 (check_ins)
create table if not exists public.check_ins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text,
  image_urls text[], -- 存储图片URL数组
  category text default 'daily', -- 默认为日常打卡，保留 fitness/learning 扩展性
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 创建点赞表 (check_in_likes)
create table if not exists public.check_in_likes (
  id uuid default gen_random_uuid() primary key,
  check_in_id uuid references public.check_ins(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(check_in_id, user_id) -- 确保每个用户每条只能点赞一次
);

-- 3. 创建评论表 (check_in_comments)
create table if not exists public.check_in_comments (
  id uuid default gen_random_uuid() primary key,
  check_in_id uuid references public.check_ins(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. 开启 RLS (Row Level Security) 并设置策略
alter table public.check_ins enable row level security;
alter table public.check_in_likes enable row level security;
alter table public.check_in_comments enable row level security;

-- check_ins 策略
create policy "Allow public read access for check_ins" on public.check_ins
  for select using (true);

create policy "Allow authenticated insert for check_ins" on public.check_ins
  for insert with check (auth.uid() = user_id);

create policy "Allow users to update their own check_ins" on public.check_ins
  for update using (auth.uid() = user_id);

create policy "Allow users to delete their own check_ins" on public.check_ins
  for delete using (auth.uid() = user_id);

-- check_in_likes 策略
create policy "Allow public read access for check_in_likes" on public.check_in_likes
  for select using (true);

create policy "Allow authenticated insert for check_in_likes" on public.check_in_likes
  for insert with check (auth.uid() = user_id);

create policy "Allow users to delete their own likes" on public.check_in_likes
  for delete using (auth.uid() = user_id);

-- check_in_comments 策略
create policy "Allow public read access for check_in_comments" on public.check_in_comments
  for select using (true);

create policy "Allow authenticated insert for check_in_comments" on public.check_in_comments
  for insert with check (auth.uid() = user_id);

create policy "Allow users to delete their own comments" on public.check_in_comments
  for delete using (auth.uid() = user_id);


-- 5. 配置 Storage (存储桶)
-- 注意：Storage 的 SQL 配置可能因 Supabase 版本差异有时不稳定。
-- 如果以下脚本不生效，需要在 Dashboard 手动创建 'check-in-images' bucket。

insert into storage.buckets (id, name, public)
values ('check-in-images', 'check-in-images', true)
on conflict (id) do nothing;

-- Storage 策略: 允许任何人查看
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'check-in-images' );

-- Storage 策略: 仅登录用户可上传
create policy "Authenticated Upload"
on storage.objects for insert
with check (
  bucket_id = 'check-in-images' 
  and auth.role() = 'authenticated'
);

-- Storage 策略: 用户可以更新/删除自己的文件 (可选，这次简单点先不加复杂校验)
