-- Run this in: Supabase Dashboard → SQL Editor
-- Enables RLS and creates strict per-user policies with WITH CHECK
-- on both the 'days' and 'settings' tables.

-- ── days ─────────────────────────────────────────────────────────────────────

ALTER TABLE days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "days_select"  ON days;
DROP POLICY IF EXISTS "days_insert"  ON days;
DROP POLICY IF EXISTS "days_update"  ON days;
DROP POLICY IF EXISTS "days_delete"  ON days;

CREATE POLICY "days_select" ON days
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "days_insert" ON days
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "days_update" ON days
  FOR UPDATE USING    (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);

CREATE POLICY "days_delete" ON days
  FOR DELETE USING (auth.uid() = user_id);

-- ── settings ─────────────────────────────────────────────────────────────────

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON settings;
DROP POLICY IF EXISTS "settings_insert" ON settings;
DROP POLICY IF EXISTS "settings_update" ON settings;
DROP POLICY IF EXISTS "settings_delete" ON settings;

CREATE POLICY "settings_select" ON settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "settings_insert" ON settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_update" ON settings
  FOR UPDATE USING    (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_delete" ON settings
  FOR DELETE USING (auth.uid() = user_id);
