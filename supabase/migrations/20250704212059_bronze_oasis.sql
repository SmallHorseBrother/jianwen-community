/*
  # 创建任务倒计时表

  1. 新表
    - `tasks`
      - `id` (uuid, 主键)
      - `user_id` (uuid, 外键关联用户)
      - `name` (text, 任务名称)
      - `deadline` (timestamptz, 截止时间)
      - `description` (text, 任务描述，可选)
      - `is_completed` (boolean, 是否完成)
      - `created_at` (timestamptz, 创建时间)
      - `updated_at` (timestamptz, 更新时间)

  2. 安全策略
    - 启用RLS
    - 用户只能查看、创建、更新、删除自己的任务
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  deadline timestamptz NOT NULL,
  description text DEFAULT '',
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用行级安全
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的任务
CREATE POLICY "用户可以查看自己的任务"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以创建自己的任务
CREATE POLICY "用户可以创建自己的任务"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的任务
CREATE POLICY "用户可以更新自己的任务"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以删除自己的任务
CREATE POLICY "用户可以删除自己的任务"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 添加更新时间触发器
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建索引
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_deadline_idx ON tasks(deadline);
CREATE INDEX IF NOT EXISTS tasks_is_completed_idx ON tasks(is_completed);