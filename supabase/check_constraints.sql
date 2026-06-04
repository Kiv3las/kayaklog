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

-- ── rivers payload sanity (security audit finding #3) ─────────────────────────
-- RLS already limits writes to the user's own rows, but a modified client could
-- still store nonsensical values (negative km, stars=9999, invalid class) in its
-- OWN rows, corrupting that user's stats. A CHECK constraint can't contain a
-- subquery, so the per-lap range validation lives in an IMMUTABLE helper that
-- only inspects its argument (no table access) and is safe to call from CHECK.

CREATE OR REPLACE FUNCTION days_rivers_valid(rivers jsonb)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT CASE
    WHEN rivers IS NULL THEN true
    WHEN jsonb_typeof(rivers) <> 'array' THEN false
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(rivers) AS r
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(r->'laps') = 'array' THEN r->'laps' ELSE '[]'::jsonb END
      ) AS l
      WHERE (l->>'km')::numeric      < 0
         OR (l->>'km')::numeric      > 1000
         OR (l->>'stars')::int       NOT BETWEEN 0 AND 5
         OR (l->>'hours')::int       NOT BETWEEN 0 AND 48
         OR (l->>'minutes')::int     NOT BETWEEN 0 AND 59
         OR (l ? 'difficulty' AND l->>'difficulty' NOT IN ('I','II','III','IV','V','VI'))
         OR (l ? 'waterLevel' AND l->>'waterLevel' NOT IN ('bajo','medio','alto','crecida'))
         OR (l ? 'flow' AND (l->>'flow')::numeric < 0)
    )
  END;
$$;

ALTER TABLE days DROP CONSTRAINT IF EXISTS days_rivers_sane;
-- NOTE: ADD CONSTRAINT validates existing rows. If it errors, an existing row
-- has out-of-range values that must be cleaned up first.
ALTER TABLE days
  ADD CONSTRAINT days_rivers_sane CHECK (days_rivers_valid(rivers));
