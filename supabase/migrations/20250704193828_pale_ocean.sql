/*
  # 修复认证系统

  1. 问题分析
    - 当前使用临时邮箱格式进行认证，但这种方式不稳定
    - 需要建立正确的手机号与邮箱的映射关系
    - 确保 profiles 表与 auth.users 表正确关联

  2. 解决方案
    - 修复 profiles 表的外键关系
    - 确保认证流程正确
*/

-- 确保 profiles 表与 auth.users 正确关联
DO $$
BEGIN
  -- 检查外键是否存在，如果不存在则添加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 确保 articles 表与 auth.users 正确关联
DO $$
BEGIN
  -- 检查外键是否存在，如果不存在则添加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'articles_author_id_fkey' 
    AND table_name = 'articles'
  ) THEN
    ALTER TABLE articles 
    ADD CONSTRAINT articles_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;