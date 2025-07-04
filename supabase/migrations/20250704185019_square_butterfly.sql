/*
  # 创建文章表

  1. 新表
    - `articles`
      - `id` (uuid, 主键)
      - `title` (text, 文章标题)
      - `content` (text, 文章内容)
      - `summary` (text, 文章摘要)
      - `category` (text, 分类)
      - `type` (text, 类型: fitness/learning)
      - `tags` (text[], 标签数组)
      - `author_id` (uuid, 作者ID)
      - `author_name` (text, 作者名称)
      - `is_published` (boolean, 是否发布)
      - `created_at` (timestamptz, 创建时间)
      - `updated_at` (timestamptz, 更新时间)

  2. 安全策略
    - 所有人可以查看已发布的文章
    - 作者可以查看自己的所有文章
    - 认证用户可以创建文章
    - 作者可以更新/删除自己的文章

  3. 索引
    - 全文搜索索引
    - 分类和类型索引
    - 标签索引
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