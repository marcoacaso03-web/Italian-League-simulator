-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/baocxhhsqavvayaanwmf/sql/new

CREATE TABLE IF NOT EXISTS leaderboard (
  id BIGSERIAL PRIMARY KEY,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  overall INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  formation TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'normal',
  show_ratings TEXT NOT NULL DEFAULT 'on',
  era_from INTEGER NOT NULL DEFAULT 1996,
  era_to INTEGER NOT NULL DEFAULT 2025,
  uid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast score ordering
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (score DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read
CREATE POLICY "Allow read" ON leaderboard FOR SELECT USING (true);

-- Allow anyone to insert
CREATE POLICY "Allow insert" ON leaderboard FOR INSERT WITH CHECK (true);

-- Allow users to update only their own rows (by uid)
CREATE POLICY "Allow update own" ON leaderboard FOR UPDATE USING (uid IS NOT NULL AND uid = current_setting('request.jwt.claims', true)::json->>'sub');
