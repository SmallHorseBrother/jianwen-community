-- 健学社区数据库设置脚本
-- 在Supabase项目的SQL编辑器中执行此脚本

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建用户资料表
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  phone text UNIQUE,
  nickname text NOT NULL,
  bio text DEFAULT '',
  avatar_url text,
  bench_press integer DEFAULT 0,
  squat integer DEFAULT 0,
  deadlift integer DEFAULT 0,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用行级安全
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户可以查看自己的资料" ON profiles;
DROP POLICY IF EXISTS "用户可以更新自己的资料" ON profiles;
DROP POLICY IF EXISTS "用户可以插入自己的资料" ON profiles;
DROP POLICY IF EXISTS "所有人可以查看公开的用户资料" ON profiles;

-- 用户可以查看自己的资料
CREATE POLICY "用户可以查看自己的资料"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 用户可以更新自己的资料
CREATE POLICY "用户可以更新自己的资料"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 用户可以插入自己的资料
CREATE POLICY "用户可以插入自己的资料"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 所有人可以查看公开的用户资料
CREATE POLICY "所有人可以查看公开的用户资料"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- 为profiles表添加更新时间触发器
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建文章表
CREATE TABLE IF NOT EXISTS articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  summary text DEFAULT '',
  category text NOT NULL,
  type text NOT NULL CHECK (type IN ('fitness', 'learning')),
  tags text[] DEFAULT '{}',
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用行级安全
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "所有人可以查看已发布的文章" ON articles;
DROP POLICY IF EXISTS "作者可以查看自己的所有文章" ON articles;
DROP POLICY IF EXISTS "认证用户可以创建文章" ON articles;
DROP POLICY IF EXISTS "作者可以更新自己的文章" ON articles;
DROP POLICY IF EXISTS "作者可以删除自己的文章" ON articles;

-- 所有人可以查看已发布的文章
CREATE POLICY "所有人可以查看已发布的文章"
  ON articles
  FOR SELECT
  TO authenticated
  USING (is_published = true);

-- 作者可以查看自己的所有文章
CREATE POLICY "作者可以查看自己的所有文章"
  ON articles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = author_id);

-- 认证用户可以创建文章
CREATE POLICY "认证用户可以创建文章"
  ON articles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- 作者可以更新自己的文章
CREATE POLICY "作者可以更新自己的文章"
  ON articles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

-- 作者可以删除自己的文章
CREATE POLICY "作者可以删除自己的文章"
  ON articles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- 为articles表添加更新时间触发器
DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建文章搜索索引
DROP INDEX IF EXISTS articles_search_idx;
DROP INDEX IF EXISTS articles_category_idx;
DROP INDEX IF EXISTS articles_type_idx;
DROP INDEX IF EXISTS articles_tags_idx;

CREATE INDEX articles_search_idx ON articles USING gin(to_tsvector('english', title || ' ' || content));
CREATE INDEX articles_category_idx ON articles(category);
CREATE INDEX articles_type_idx ON articles(type);
CREATE INDEX articles_tags_idx ON articles USING gin(tags);

-- 完成提示
SELECT 'Database setup completed successfully!' as message; 