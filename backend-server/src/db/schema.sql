CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'ready', 'failed')),
  page_count INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

-- Existing databases created at 384 dimensions cannot keep those vectors.
DO $$
DECLARE
  current_dim integer;
BEGIN
  SELECT atttypmod
    INTO current_dim
  FROM pg_attribute
  WHERE attrelid = 'public.chunks'::regclass
    AND attname = 'embedding'
    AND NOT attisdropped;

  IF current_dim IS DISTINCT FROM 768 THEN
    DROP INDEX IF EXISTS chunks_embedding_hnsw;
    TRUNCATE chunks;
    UPDATE documents
      SET status = 'failed',
          error = 'Embeddings changed to 768 dimensions. Upload this PDF again.',
          updated_at = now()
      WHERE status IN ('ready', 'processing');
    ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(768);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
  ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;
UPDATE documents SET category = 'other' WHERE category IS NULL OR category = '' OR category IN ('guidelines', 'treatment', 'prevention', 'policy', 'research');
ALTER TABLE documents ALTER COLUMN category SET DEFAULT 'other';
ALTER TABLE documents ALTER COLUMN category SET NOT NULL;
