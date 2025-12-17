-- 修复 profiles 表的 RLS 策略
-- 问题：登录后获取用户资料超时

-- 删除现有策略
DROP POLICY IF EXISTS "用户可以查看自己的资料" ON profiles;
DROP POLICY IF EXISTS "所有人可以查看公开的用户资料" ON profiles;

-- 创建更宽松的查看策略（合并两个策略）
-- 用户可以查看自己的资料，或者查看公开的资料
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR is_public = true
  );

-- 确保 profiles 表有正确的索引
CREATE INDEX IF NOT EXISTS profiles_id_idx ON profiles(id);
CREATE INDEX IF NOT EXISTS profiles_is_public_idx ON profiles(is_public);
