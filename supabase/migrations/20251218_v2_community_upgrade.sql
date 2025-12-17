-- =====================================================
-- 社区 V2.0 重构 - 数据库升级脚本
-- 执行时间: 2025-12-18
-- 功能: 
--   1. 新建 questions 表 (Q&A 提问箱)
--   2. 更新 profiles 表 (社交名片升级)
-- =====================================================

-- =====================================================
-- 1. 创建 questions 表 (马健文的数字大脑 - Q&A 提问箱)
-- =====================================================

CREATE TABLE IF NOT EXISTS questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,                          -- 问题内容
  answer text,                                    -- 回答内容 (支持 Markdown)
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'ignored')),
  asker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- 提问者 (可为空=匿名)
  asker_nickname text,                            -- 提问者昵称 (冗余存储，方便显示)
  is_anonymous boolean DEFAULT false,             -- 是否匿名提问
  tags text[] DEFAULT '{}',                       -- 标签数组
  view_count integer DEFAULT 0,                   -- 浏览次数
  is_featured boolean DEFAULT false,              -- 是否精选
  answered_at timestamptz,                        -- 回答时间
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用行级安全
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- RLS 策略
-- 所有人可以查看已发布的问答
CREATE POLICY "所有人可以查看已发布的问答"
  ON questions
  FOR SELECT
  TO authenticated
  USING (status = 'published');

-- 用户可以查看自己提的问题（包括未回答的）
CREATE POLICY "用户可以查看自己的问题"
  ON questions
  FOR SELECT
  TO authenticated
  USING (asker_id = auth.uid());

-- 认证用户可以提问
CREATE POLICY "认证用户可以提问"
  ON questions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 用户可以删除自己未回答的问题
CREATE POLICY "用户可以删除自己未回答的问题"
  ON questions
  FOR DELETE
  TO authenticated
  USING (asker_id = auth.uid() AND status = 'pending');

-- 创建索引
CREATE INDEX IF NOT EXISTS questions_status_idx ON questions(status);
CREATE INDEX IF NOT EXISTS questions_asker_idx ON questions(asker_id);
CREATE INDEX IF NOT EXISTS questions_tags_idx ON questions USING gin(tags);
CREATE INDEX IF NOT EXISTS questions_created_at_idx ON questions(created_at DESC);
CREATE INDEX IF NOT EXISTS questions_featured_idx ON questions(is_featured) WHERE is_featured = true;

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. 更新 profiles 表 (社交名片升级)
-- =====================================================

-- 添加微信号字段
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'wechat_id') THEN
        ALTER TABLE profiles ADD COLUMN wechat_id text;
        COMMENT ON COLUMN profiles.wechat_id IS '微信号 (选填，仅登录用户可见)';
    END IF;
END $$;

-- 添加个人标签字段
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'tags') THEN
        ALTER TABLE profiles ADD COLUMN tags text[] DEFAULT '{}';
        COMMENT ON COLUMN profiles.tags IS '个人标签，如 ["健身", "科研", "INFP"]';
    END IF;
END $$;

-- 添加"我能提供"字段
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'skills_offering') THEN
        ALTER TABLE profiles ADD COLUMN skills_offering text;
        COMMENT ON COLUMN profiles.skills_offering IS '我擅长/能提供什么';
    END IF;
END $$;

-- 添加"我正在寻找"字段
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'skills_seeking') THEN
        ALTER TABLE profiles ADD COLUMN skills_seeking text;
        COMMENT ON COLUMN profiles.skills_seeking IS '我正在寻找什么';
    END IF;
END $$;

-- =====================================================
-- 3. 创建管理员权限表 (用于后台管理)
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role text DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 只有管理员可以查看管理员列表
CREATE POLICY "管理员可以查看管理员列表"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- =====================================================
-- 4. 为管理员添加 questions 表的完整权限
-- =====================================================

-- 管理员可以查看所有问题
CREATE POLICY "管理员可以查看所有问题"
  ON questions
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- 管理员可以更新问题（回答、修改状态等）
CREATE POLICY "管理员可以更新问题"
  ON questions
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- 管理员可以删除问题
CREATE POLICY "管理员可以删除问题"
  ON questions
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- =====================================================
-- 完成提示
-- =====================================================
SELECT 'V2.0 社区升级数据库迁移完成!' as message;
