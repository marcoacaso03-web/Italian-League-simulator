-- ═══════════════════════════════════════════════════════════
-- SQL DA ESEGUIRE SU SUPABASE (SQL Editor → New Query → Copia → Run)
-- URL: https://baocxhhsqavvayaanwmf.supabase.com/dashboard/project/baocxhhsqavvayaanwmf/sql/new
-- ═══════════════════════════════════════════════════════════

-- Tabella lobby
CREATE TABLE IF NOT EXISTS lobbies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  host_id       TEXT NOT NULL,
  host_name     TEXT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'league',
  status        TEXT NOT NULL DEFAULT 'waiting',
  max_players   INT DEFAULT 8,
  config        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);

-- Tabella giocatori in lobby
CREATE TABLE IF NOT EXISTS lobby_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id      UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL,
  player_name   TEXT NOT NULL,
  is_host       BOOLEAN DEFAULT FALSE,
  is_ready      BOOLEAN DEFAULT FALSE,
  final_position INT,
  final_points  INT,
  final_score   BIGINT,
  slots_json    JSONB,
  overall_json  JSONB,
  submitted_at  TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_lobby_players_lobby ON lobby_players(lobby_id);

-- Tabella sfide 1v1
CREATE TABLE IF NOT EXISTS challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id        UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  challenger_id   TEXT NOT NULL,
  challenger_name TEXT NOT NULL,
  opponent_id     TEXT NOT NULL,
  opponent_name   TEXT NOT NULL,
  shared_spin     JSONB NOT NULL,
  challenger_score BIGINT,
  opponent_score  BIGINT,
  winner_id       TEXT,
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobbies_read" ON lobbies FOR SELECT USING (true);
CREATE POLICY "lobbies_insert" ON lobbies FOR INSERT WITH CHECK (true);
CREATE POLICY "lobbies_update" ON lobbies FOR UPDATE USING (true);

CREATE POLICY "lp_read" ON lobby_players FOR SELECT USING (true);
CREATE POLICY "lp_insert" ON lobby_players FOR INSERT WITH CHECK (true);
CREATE POLICY "lp_update" ON lobby_players FOR UPDATE USING (true);

CREATE POLICY "ch_read" ON challenges FOR SELECT USING (true);
CREATE POLICY "ch_insert" ON challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "ch_update" ON challenges FOR UPDATE USING (true);

-- ═══════════════════════════════════════════════════════════
-- REALTIME (necessario per presence e live updates)
-- ═══════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby_players;
ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
