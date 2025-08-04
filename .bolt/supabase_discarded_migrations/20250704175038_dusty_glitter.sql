/*
  # 创建文章表

  1. 新建表
    - `articles` (文章表)
      - `id` (uuid, 主键)
      - `title` (text, 标题)
      - `content` (text, 内容)
      - `summary` (text, 摘要)
      - `category` (text, 分类)
      - `type` (text, 类型: fitness/learning)
      - `tags` (text[], 标签数组)
      - `author_id` (uuid, 作者ID)
      - `author_name` (text, 作者名称)
      - `is_published` (boolean, 是否发布)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 安全设置
    - 启用RLS
    - 所有人可以查看已发布的文章
    - 只有作者可以编辑自己的文章
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
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建文章搜索索引
CREATE INDEX IF NOT EXISTS articles_search_idx ON articles USING gin(to_tsvector('chinese', title || ' ' || content));
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles(category);
CREATE INDEX IF NOT EXISTS articles_type_idx ON articles(type);
CREATE INDEX IF NOT EXISTS articles_tags_idx ON articles USING gin(tags);