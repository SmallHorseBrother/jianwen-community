-- 20251223_add_profile_optional_fields.sql
-- 添加年龄和性别等可选字段

alter table public.profiles 
add column if not exists age integer,
add column if not exists gender text;

-- 添加约束：年龄必须合理
alter table public.profiles 
add constraint age_check check (age is null or (age >= 10 and age <= 120));

-- 添加约束：性别只能是特定值
alter table public.profiles 
add constraint gender_check check (gender is null or gender in ('male', 'female', 'other', '男', '女', '其他'));
