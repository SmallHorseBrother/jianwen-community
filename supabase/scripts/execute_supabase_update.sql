-- 健学社区 - Supabase数据库更新和验证脚本
-- 在Supabase项目的SQL编辑器中执行此脚本
-- 用于添加社区个人信息卡片相关字段并验证结果

-- ===========================================
-- 第一部分：数据库更新
-- ===========================================

-- 1. 添加社区个人信息卡片相关字段到profiles表
DO $$ 
BEGIN
    -- 添加群身份字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'group_identity') THEN
        ALTER TABLE profiles ADD COLUMN group_identity text;
        RAISE NOTICE '✅ 已添加字段: group_identity';
    ELSE
        RAISE NOTICE '⚠️ 字段已存在: group_identity';
    END IF;
    
    -- 添加专业领域字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'profession') THEN
        ALTER TABLE profiles ADD COLUMN profession text;
        RAISE NOTICE '✅ 已添加字段: profession';
    ELSE
        RAISE NOTICE '⚠️ 字段已存在: profession';
    END IF;
    
    -- 添加群昵称字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'group_nickname') THEN
        ALTER TABLE profiles ADD COLUMN group_nickname text;
        RAISE NOTICE '✅ 已添加字段: group_nickname';
    ELSE
        RAISE NOTICE '⚠️ 字段已存在: group_nickname';
    END IF;
    
    -- 添加擅长领域字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'specialties') THEN
        ALTER TABLE profiles ADD COLUMN specialties text[] DEFAULT '{}';
        RAISE NOTICE '✅ 已添加字段: specialties';
    ELSE
        RAISE NOTICE '⚠️ 字段已存在: specialties';
    END IF;
    
    -- 添加健身爱好字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'fitness_interests') THEN
        ALTER TABLE profiles ADD COLUMN fitness_interests text[] DEFAULT '{}';
        RAISE NOTICE '✅ 已添加字段: fitness_interests';
    ELSE
        RAISE NOTICE '⚠️ 字段已存在: fitness_interests';
    END IF;
    
    -- 添加学习兴趣字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'learning_interests') THEN
        ALTER TABLE profiles ADD COLUMN learning_interests text[] DEFAULT '{}';
        RAISE NOTICE '✅ 已添加字段: learning_interests';
    ELSE
        RAISE NOTICE '⚠️ 字段已存在: learning_interests';
    END IF;
    
    -- 添加社交链接字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'social_links') THEN
        ALTER TABLE profiles ADD COLUMN social_links jsonb DEFAULT '{}';
        RAISE NOTICE '✅ 已添加字段: social_links';
    ELSE
        RAISE NOTICE '⚠️ 字段已存在: social_links';
    END IF;
END $$;

-- 2. 添加字段注释
DO $$
BEGIN
    PERFORM pg_catalog.col_description(0, 0); -- 测试函数存在
    
    -- 添加字段注释
    COMMENT ON COLUMN profiles.group_identity IS '群身份：学习一群、学习二群、健身一群、健身二群等';
    COMMENT ON COLUMN profiles.profession IS '专业领域：如程序员、设计师、学生等';
    COMMENT ON COLUMN profiles.group_nickname IS '群昵称：用户在群里的昵称';
    COMMENT ON COLUMN profiles.specialties IS '擅长领域：用户的专业技能或擅长方向';
    COMMENT ON COLUMN profiles.fitness_interests IS '健身爱好：用户感兴趣的健身项目';
    COMMENT ON COLUMN profiles.learning_interests IS '学习兴趣：用户感兴趣的学习领域';
    COMMENT ON COLUMN profiles.social_links IS '社交链接：用户的社交媒体链接等，JSON格式存储';
    
    RAISE NOTICE '✅ 字段注释已添加';
END $$;

-- 3. 确保RLS策略正确
DO $$
BEGIN
    -- 删除可能存在的旧策略
    DROP POLICY IF EXISTS "所有人可以查看公开的用户资料" ON profiles;
    
    -- 创建新的公开资料访问策略
    CREATE POLICY "所有人可以查看公开的用户资料"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (is_public = true);
      
    RAISE NOTICE '✅ RLS策略已更新';
END $$;

-- ===========================================
-- 第二部分：验证更新结果
-- ===========================================

-- 验证消息
SELECT '🎉 数据库更新完成！开始验证...' as message;

-- 1. 检查新增的社区字段
SELECT 
    '📋 社区字段状态检查' as check_type,
    column_name as 字段名,
    data_type as 数据类型,
    is_nullable as 允许空值,
    column_default as 默认值
FROM information_schema.columns 
WHERE table_name = 'profiles' 
    AND column_name IN ('group_identity', 'profession', 'group_nickname', 'specialties', 'fitness_interests', 'learning_interests', 'social_links')
ORDER BY ordinal_position;

-- 2. 检查表的行级安全策略
SELECT 
    '🔒 安全策略检查' as check_type,
    policyname as 策略名称,
    cmd as 命令类型,
    permissive as 许可类型
FROM pg_policies 
WHERE tablename = 'profiles';

-- 3. 检查表是否启用了RLS
SELECT 
    '🛡️ RLS状态检查' as check_type,
    tablename as 表名,
    rowsecurity as 行级安全,
    CASE 
        WHEN rowsecurity THEN '✅ 已启用'
        ELSE '❌ 未启用'
    END as 状态
FROM pg_tables 
WHERE tablename = 'profiles';

-- 4. 统计当前数据
SELECT 
    '📊 数据统计' as check_type,
    COUNT(*) as 总用户数,
    COUNT(CASE WHEN group_identity IS NOT NULL THEN 1 END) as 有群身份用户数,
    COUNT(CASE WHEN profession IS NOT NULL THEN 1 END) as 有专业信息用户数,
    COUNT(CASE WHEN is_public = true THEN 1 END) as 公开资料用户数
FROM profiles;

-- 5. 显示完整的profiles表结构
SELECT 
    '📝 完整表结构' as check_type,
    column_name as 字段名,
    data_type as 数据类型,
    is_nullable as 允许空值,
    column_default as 默认值,
    ordinal_position as 字段顺序
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 最终成功消息
SELECT 
    '🎉 数据库更新和验证完成！' as message,
    '现在可以使用社区个人信息卡片系统了！' as next_step; 