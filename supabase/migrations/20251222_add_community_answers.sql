-- ============================================
-- 群友帮答功能 - 数据库迁移
-- 执行位置: Supabase Dashboard > SQL Editor
-- ============================================

-- 1. 创建 community_answers 表
CREATE TABLE IF NOT EXISTS community_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_community_answers_question ON community_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_community_answers_user ON community_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_community_answers_created ON community_answers(created_at DESC);

-- 3. 启用 RLS
ALTER TABLE community_answers ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略

-- 所有人可读（包括未登录用户）
CREATE POLICY "community_answers_select_all" 
  ON community_answers FOR SELECT 
  USING (true);

-- 登录用户可创建自己的回答
CREATE POLICY "community_answers_insert_own" 
  ON community_answers FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 用户可更新自己的回答
CREATE POLICY "community_answers_update_own" 
  ON community_answers FOR UPDATE 
  USING (auth.uid() = user_id);

-- 用户可删除自己的回答
CREATE POLICY "community_answers_delete_own" 
  ON community_answers FOR DELETE 
  USING (auth.uid() = user_id);

-- 5. 在 questions 表添加回答计数字段（可选，用于快速显示回答数）
ALTER TABLE questions ADD COLUMN IF NOT EXISTS community_answer_count INTEGER DEFAULT 0;

-- 6. 创建触发器自动更新回答计数
CREATE OR REPLACE FUNCTION update_community_answer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE questions SET community_answer_count = community_answer_count + 1 WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE questions SET community_answer_count = community_answer_count - 1 WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_answer_count ON community_answers;
CREATE TRIGGER trigger_update_answer_count
  AFTER INSERT OR DELETE ON community_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_community_answer_count();

-- ============================================
-- 执行完成后，请刷新 Supabase 类型或手动更新 database.types.ts
-- ============================================
