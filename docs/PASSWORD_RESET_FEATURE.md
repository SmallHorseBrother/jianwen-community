# 忘记密码功能 - 开发文档

> 创建时间：2025年12月22日\
> 功能状态：✅ 已上线

## 功能概述

为健学社区网站添加"忘记密码"功能，允许用户在无法登录时通过手机号 +
数学验证码自助重置密码。

## 用户操作流程

```
登录页 → 点击"忘记密码？" → 输入手机号 → 完成数学验证码 → 设置新密码 → 重置成功 → 返回登录
```

## 技术实现

### 前端代码

| 文件                                         | 修改内容                     |
| -------------------------------------------- | ---------------------------- |
| `src/components/Auth/ForgotPasswordForm.tsx` | 新建两步式密码重置表单       |
| `src/components/Auth/LoginForm.tsx`          | 添加"忘记密码？"链接         |
| `src/App.tsx`                                | 添加 `/forgot-password` 路由 |
| `src/lib/supabase.ts`                        | 添加 `checkPhoneExists` 函数 |

### 数据库函数

文件：`supabase/migrations/20251222_add_password_reset.sql`

创建 `reset_user_password(user_phone, new_password)` RPC 函数，使用 SECURITY
DEFINER 权限直接更新 `auth.users` 表中的密码。

## 遇到的问题及解决

### 问题：`function gen_salt(unknown) does not exist`

**原因**：Supabase 中 `pgcrypto` 扩展的函数需要使用 `extensions.` 前缀调用。

**解决方案**：将函数中的：

```sql
crypt(new_password, gen_salt('bf'))
```

修改为：

```sql
extensions.crypt(new_password, extensions.gen_salt('bf'))
```

## 部署步骤

1. 部署前端代码（已自动部署）
2. 在 Supabase SQL Editor 执行以下 SQL：

```sql
-- 启用 pgcrypto 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 创建密码重置函数
CREATE OR REPLACE FUNCTION public.reset_user_password(
  user_phone TEXT,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
  user_email TEXT;
BEGIN
  user_email := user_phone || '@jianwen.community';
  
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '用户不存在');
  END IF;
  
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = user_id;
  
  RETURN jsonb_build_object('success', true, 'message', '密码重置成功');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT) TO authenticated;
```

## 安全说明

- 使用数学验证码防止自动化攻击
- 验证手机号必须已注册才能重置
- 密码使用 bcrypt 算法加密存储
