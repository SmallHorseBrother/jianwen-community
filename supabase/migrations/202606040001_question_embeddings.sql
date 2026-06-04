-- Question Planet semantic search and cached graph edges.
-- Uses pgvector for question embeddings and a materialized edge table for fast reads.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_input_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS semantic_cluster_id TEXT;

CREATE INDEX IF NOT EXISTS questions_embedding_ivfflat_idx
  ON questions
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS questions_embedding_model_idx
  ON questions(embedding_model)
  WHERE embedding IS NOT NULL;

CREATE TABLE IF NOT EXISTS question_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  related_question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  similarity DOUBLE PRECISION NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
  embedding_similarity DOUBLE PRECISION CHECK (embedding_similarity >= 0 AND embedding_similarity <= 1),
  edge_type TEXT NOT NULL DEFAULT 'semantic',
  reason TEXT,
  model TEXT,
  origin_batch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT question_edges_no_self_edge CHECK (question_id <> related_question_id),
  CONSTRAINT question_edges_unique_pair UNIQUE(question_id, related_question_id, edge_type)
);

ALTER TABLE question_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_edges_public_read" ON question_edges;
CREATE POLICY "question_edges_public_read"
  ON question_edges FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS question_edges_question_idx
  ON question_edges(question_id, similarity DESC);

CREATE INDEX IF NOT EXISTS question_edges_related_question_idx
  ON question_edges(related_question_id);

CREATE INDEX IF NOT EXISTS question_edges_similarity_idx
  ON question_edges(similarity DESC);

DROP TRIGGER IF EXISTS update_question_edges_updated_at ON question_edges;
CREATE TRIGGER update_question_edges_updated_at
  BEFORE UPDATE ON question_edges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION match_question_embeddings(
  query_embedding extensions.vector(1536),
  match_count INT DEFAULT 20,
  exclude_question_id UUID DEFAULT NULL,
  match_topic TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  topic TEXT,
  tags TEXT[],
  need_type TEXT,
  audience_value TEXT,
  source_count INTEGER,
  same_question_count INTEGER,
  answer TEXT,
  is_featured BOOLEAN,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.content,
    q.topic,
    q.tags,
    q.need_type,
    q.audience_value,
    q.source_count,
    q.same_question_count,
    q.answer,
    q.is_featured,
    1 - (q.embedding <=> query_embedding) AS similarity
  FROM questions q
  WHERE q.embedding IS NOT NULL
    AND q.status <> 'ignored'
    AND (exclude_question_id IS NULL OR q.id <> exclude_question_id)
    AND (match_topic IS NULL OR q.topic = match_topic)
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
