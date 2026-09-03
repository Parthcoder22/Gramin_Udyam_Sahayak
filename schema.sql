-- ============================================================
-- Gramin Udyam Sahayak – Supabase Database Schema
-- Run this SQL in the Supabase SQL Editor to bootstrap the DB.
-- ============================================================

-- 1. Enable the uuid-ossp extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the loan_applications table
CREATE TABLE IF NOT EXISTS loan_applications (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_name    TEXT          NOT NULL,
  mobile_number     TEXT          NOT NULL,
  location          TEXT          NOT NULL,
  sector            TEXT          NOT NULL,
  margin_money      NUMERIC       NOT NULL,
  total_project_size NUMERIC      NOT NULL,
  loan_eligibility  NUMERIC       NOT NULL,
  scheme_type       TEXT          NOT NULL CHECK (scheme_type IN ('Micro Finance', 'Term Loan')),
  status            TEXT          NOT NULL DEFAULT 'PENDING',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3. Create an index on status for fast filtering
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications (status);

-- 4. Create an index on sector for analytics queries
CREATE INDEX IF NOT EXISTS idx_loan_applications_sector ON loan_applications (sector);

-- 5. Enable Row Level Security
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

-- 6. Allow inserts from the anon key (public portal submissions)
CREATE POLICY "Allow public insert" ON loan_applications
  FOR INSERT
  WITH CHECK (true);

-- 7. Allow selects from the anon key (for status lookups)
CREATE POLICY "Allow public select" ON loan_applications
  FOR SELECT
  USING (true);

-- ============================================================
-- RAG Architecture: Vector Embeddings for Document Chunks
-- ============================================================

-- 8. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 9. Create document_chunks table for PDF knowledge base
CREATE TABLE IF NOT EXISTS document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  embedding   VECTOR(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Create HNSW index for sub-second cosine distance nearest-neighbor search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 11. Create index on file_name for efficient deletion/deduplication
CREATE INDEX IF NOT EXISTS idx_document_chunks_file_name
  ON document_chunks (file_name);

-- 12. Enable RLS on document_chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- 13. Allow service-role full access
DROP POLICY IF EXISTS "Allow service role full access" ON document_chunks;
CREATE POLICY "Allow service role full access"
  ON document_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 14. Allow public read access
DROP POLICY IF EXISTS "Allow public read access" ON document_chunks;
CREATE POLICY "Allow public read access"
  ON document_chunks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 15. RPC Function: match_document_chunks for semantic similarity search
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

