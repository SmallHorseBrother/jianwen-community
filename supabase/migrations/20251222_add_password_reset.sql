-- 密码重置功能所需的数据库函数
-- 由于安全限制，需要创建一个 RPC 函数来处理密码重置

-- 创建密码重置函数
-- 注意：此函数需要 SECURITY DEFINER 权限来调用 auth.users
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
  -- 构造虚拟邮箱
  user_email := user_phone || '@jianwen.community';
  
  -- 查找用户ID
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '用户不存在'
    );
  END IF;
  
  -- 更新密码
  -- 注意：这需要使用 Supabase 的 auth.users 表
  -- 密码需要先加密
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', '密码重置成功'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 授予执行权限给匿名用户（用于密码重置）
GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT) TO authenticated;
