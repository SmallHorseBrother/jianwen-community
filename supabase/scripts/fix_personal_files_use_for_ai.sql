-- 修复附件上传失败:
-- 当前前端在写 personal_files 时会写入 use_for_ai 字段
-- 如果你的线上表是旧版本，就会报:
-- Could not find the 'use_for_ai' column of 'personal_files' in the schema cache

alter table public.personal_files
add column if not exists use_for_ai boolean default true not null;

comment on column public.personal_files.use_for_ai is 'Whether this file can be used by the digital human context';
