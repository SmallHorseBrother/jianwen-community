/*
  # 创建用户表

  1. 新建表
    - `profiles` (用户资料表)
      - `id` (uuid, 主键, 关联auth.users)
      - `phone` (text, 手机号)
      - `nickname` (text, 昵称)
      - `bio` (text, 个人简介)
      - `avatar_url` (text, 头像链接)
      - `bench_press` (integer, 卧推重量)
      - `squat` (integer, 深蹲重量)
      - `deadlift` (integer, 硬拉重量)
      - `is_public` (boolean, 是否公开资料)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 安全设置
    - 启用RLS
    - 添加用户只能查看和编辑自己资料的策略
    - 添加公开资料可被所有人查看的策略
*/

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

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为profiles表添加更新时间触发器
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();