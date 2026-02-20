-- Enable pg_trgm extension for trigram-based fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN trigram index on memorial name for fast search
CREATE INDEX memorials_name_trgm_idx ON memorials USING GIN (name gin_trgm_ops);
