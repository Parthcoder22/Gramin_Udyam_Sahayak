-- ============================================================
-- Gramin Udyam Sahayak – pgvector Schema & RAG Migration
-- Execute this script in the Supabase SQL Editor
-- ============================================================

-- 1. Enable the pgvector extension for high-performance vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create the document_chunks table for storing PDF text embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  embedding   VECTOR(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create an HNSW index for sub-second approximate nearest neighbor search
-- Cosine distance (vector_cosine_ops) is recommended for normalized text embeddings
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. Create an index on file_name for fast lookup and deduplication
CREATE INDEX IF NOT EXISTS idx_document_chunks_file_name
  ON document_chunks (file_name);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policy: Allow service-role (backend scripts/ingest.js) full access
DROP POLICY IF EXISTS "Allow service role full access" ON document_chunks;
CREATE POLICY "Allow service role full access"
  ON document_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. RLS Policy: Allow public / anon read access for retrieval queries
DROP POLICY IF EXISTS "Allow public read access" ON document_chunks;
CREATE POLICY "Allow public read access"
  ON document_chunks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 9. Semantic search RPC function: match_document_chunks
-- Accepts a 768-dimensional query vector and returns top matching chunks
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  chunk_index INTEGER,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.file_name,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
