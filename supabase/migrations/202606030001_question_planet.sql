-- ============================================
-- Question Planet: public question map + anonymous "same question" reactions
-- ============================================

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS need_type TEXT,
  ADD COLUMN IF NOT EXISTS audience_value TEXT,
  ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_platforms TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_channels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS same_question_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_key TEXT,
  ADD COLUMN IF NOT EXISTS origin_batch TEXT,
  ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS questions_imported_key_uidx
  ON questions(imported_key)
  WHERE imported_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS questions_topic_idx ON questions(topic);
CREATE INDEX IF NOT EXISTS questions_audience_value_idx ON questions(audience_value);
CREATE INDEX IF NOT EXISTS questions_source_count_idx ON questions(source_count DESC);
CREATE INDEX IF NOT EXISTS questions_same_question_count_idx ON questions(same_question_count DESC);
CREATE INDEX IF NOT EXISTS questions_source_platforms_idx ON questions USING gin(source_platforms);

CREATE TABLE IF NOT EXISTS question_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'same_question',
  anon_key TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (reaction_type IN ('same_question')),
  CHECK (anon_key IS NOT NULL OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS question_reactions_anon_uidx
  ON question_reactions(question_id, reaction_type, anon_key)
  WHERE anon_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS question_reactions_user_uidx
  ON question_reactions(question_id, reaction_type, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS question_reactions_question_idx ON question_reactions(question_id);
CREATE INDEX IF NOT EXISTS question_reactions_created_idx ON question_reactions(created_at DESC);

ALTER TABLE question_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_reactions_select_all" ON question_reactions;
CREATE POLICY "question_reactions_select_all"
  ON question_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "question_reactions_insert_all" ON question_reactions;
CREATE POLICY "question_reactions_insert_all"
  ON question_reactions FOR INSERT
  WITH CHECK (reaction_type = 'same_question');

CREATE OR REPLACE FUNCTION update_question_same_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE questions
      SET same_question_count = COALESCE(same_question_count, 0) + 1
      WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE questions
      SET same_question_count = GREATEST(COALESCE(same_question_count, 0) - 1, 0)
      WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_question_same_count ON question_reactions;
CREATE TRIGGER trigger_update_question_same_count
  AFTER INSERT OR DELETE ON question_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_question_same_count();

-- Make /qa public. Existing authenticated/admin policies remain useful; these
-- broaden only the public read/insert surfaces needed by the video landing page.
DROP POLICY IF EXISTS "questions_public_read_not_ignored" ON questions;
CREATE POLICY "questions_public_read_not_ignored"
  ON questions FOR SELECT
  USING (status <> 'ignored');

DROP POLICY IF EXISTS "questions_public_insert_pending" ON questions;
CREATE POLICY "questions_public_insert_pending"
  ON questions FOR INSERT
  WITH CHECK (status = 'pending');
