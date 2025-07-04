/*
  # Create articles table

  1. New Tables
    - `articles`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `content` (text, required)
      - `summary` (text, optional)
      - `category` (text, required)
      - `type` (text, required, fitness or learning)
      - `tags` (text array)
      - `author_id` (uuid, foreign key to users)
      - `author_name` (text, required)
      - `is_published` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `articles` table
    - Add policies for authenticated users to read published articles
    - Add policies for authors to manage their own articles

  3. Indexes
    - Full-text search index on title and content
    - Category and type indexes for filtering
    - Tags GIN index for array operations
*/

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