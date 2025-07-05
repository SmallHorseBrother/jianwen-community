-- Supabase数据库验证脚本
-- 在执行更新脚本后运行此脚本以验证更新结果

-- 1. 检查profiles表的完整结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. 检查新增的社区字段
SELECT 
    'Community fields status:' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
    AND column_name IN ('group_identity', 'profession', 'group_nickname', 'specialties', 'fitness_interests', 'learning_interests', 'social_links')
ORDER BY ordinal_position;

-- 3. 检查表的行级安全策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. 检查字段注释
SELECT 
    column_name,
    col_description(pgc.oid, column_name::regclass::oid) as comment
FROM information_schema.columns ic
JOIN pg_class pgc ON pgc.relname = ic.table_name
WHERE ic.table_name = 'profiles' 
    AND ic.column_name IN ('group_identity', 'profession', 'group_nickname', 'specialties', 'fitness_interests', 'learning_interests', 'social_links');

-- 5. 检查表是否启用了RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';

-- 6. 显示当前所有表的统计信息
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 7. 检查是否有数据（示例查询）
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN group_identity IS NOT NULL THEN 1 END) as profiles_with_group_identity,
    COUNT(CASE WHEN profession IS NOT NULL THEN 1 END) as profiles_with_profession,
    COUNT(CASE WHEN is_public = true THEN 1 END) as public_profiles
FROM profiles;

-- 显示验证完成消息
SELECT 'Database verification completed! 数据库验证完成!' as message; 