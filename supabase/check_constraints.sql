-- Run this in: Supabase Dashboard → SQL Editor
--
-- Server-side input validation (security audit finding #2 / QA bug B11).
-- RLS already prevents cross-user access, but a compromised client could
-- bloat its OWN rows with arbitrary-sized payloads. These constraints cap
-- per-field sizes at the database level so the storage/egress costs cannot
-- be inflated past sane limits, and reject malformed dates that would
-- silently break stats aggregations downstream.

ALTER TABLE days
  DROP CONSTRAINT IF EXISTS days_notes_len,
  DROP CONSTRAINT IF EXISTS days_rivers_size,
  DROP CONSTRAINT IF EXISTS days_date_format;

ALTER TABLE days
  ADD CONSTRAINT days_notes_len
    CHECK (notes IS NULL OR length(notes) <= 4000),
  ADD CONSTRAINT days_rivers_size
    CHECK (rivers IS NULL OR octet_length(rivers::text) <= 65536),
  ADD CONSTRAINT days_date_format
    CHECK (date ~ '^\d{4}-\d{2}-\d{2}$');

-- Validate existing data passes the new constraints. If this errors out,
-- there's a row that needs cleanup before the ALTER above will succeed.
DO $$
DECLARE bad_count int;
BEGIN
  SELECT count(*) INTO bad_count FROM days
   WHERE length(notes) > 4000
      OR octet_length(rivers::text) > 65536
      OR date !~ '^\d{4}-\d{2}-\d{2}$';
  IF bad_count > 0 THEN
    RAISE WARNING 'days table has % rows violating the new constraints', bad_count;
  END IF;
END $$;
