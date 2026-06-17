-- 102_daily_quests_and_crates.sql
-- New gamification features: daily quests, login streaks, loot crates, and customization systems

-- 1. Quests Pool Table
CREATE TABLE IF NOT EXISTS quests (
  id              text PRIMARY KEY,
  title           text NOT NULL,
  description     text NOT NULL,
  action          text NOT NULL,
  threshold       int NOT NULL,
  reward_xp       int NOT NULL DEFAULT 0,
  reward_pixels   int NOT NULL DEFAULT 0,
  reward_crate_id text
);

ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY quests_read_all ON quests FOR SELECT USING (true);

-- 2. Quest Progress Table
CREATE TABLE IF NOT EXISTS quest_progress (
  developer_id  bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  quest_id      text NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  progress      int NOT NULL DEFAULT 0,
  completed     boolean NOT NULL DEFAULT false,
  claimed       boolean NOT NULL DEFAULT false,
  quest_date    date NOT NULL DEFAULT current_date,
  PRIMARY KEY (developer_id, quest_id, quest_date)
);

CREATE INDEX IF NOT EXISTS idx_qp_dev_date ON quest_progress(developer_id, quest_date DESC);
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY qp_read_own ON quest_progress FOR SELECT 
  USING (developer_id = (SELECT id FROM developers WHERE claimed_by = auth.uid()));

-- 3. Daily Streaks Table
CREATE TABLE IF NOT EXISTS daily_streaks (
  developer_id    bigint PRIMARY KEY REFERENCES developers(id) ON DELETE CASCADE,
  current_streak  int NOT NULL DEFAULT 0,
  longest_streak  int NOT NULL DEFAULT 0,
  last_login_date date,
  claimed_today   boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY streak_read_own ON daily_streaks FOR SELECT 
  USING (developer_id = (SELECT id FROM developers WHERE claimed_by = auth.uid()));

-- 4. Crates Catalog Table
CREATE TABLE IF NOT EXISTS crates (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  rarity       text NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  cost_pixels  int NOT NULL DEFAULT 0
);

ALTER TABLE crates ENABLE ROW LEVEL SECURITY;
CREATE POLICY crates_read_all ON crates FOR SELECT USING (true);

-- 5. Crate Rewards Catalog Table
CREATE TABLE IF NOT EXISTS crate_rewards (
  id           serial PRIMARY KEY,
  crate_id     text NOT NULL REFERENCES crates(id) ON DELETE CASCADE,
  reward_type  text NOT NULL CHECK (reward_type IN ('pixels', 'xp', 'skin', 'effect', 'frame', 'badge')),
  reward_value text NOT NULL,
  weight       int NOT NULL DEFAULT 1
);

ALTER TABLE crate_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY crate_rewards_read_all ON crate_rewards FOR SELECT USING (true);

-- 6. Developer Owned Crates
CREATE TABLE IF NOT EXISTS developer_crates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  crate_id     text NOT NULL REFERENCES crates(id) ON DELETE CASCADE,
  opened       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  opened_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dc_developer ON developer_crates(developer_id);
ALTER TABLE developer_crates ENABLE ROW LEVEL SECURITY;
CREATE POLICY dc_read_own ON developer_crates FOR SELECT 
  USING (developer_id = (SELECT id FROM developers WHERE claimed_by = auth.uid()));

-- 7. Developer Customizations Inventory (for purchased/unlocked styles)
CREATE TABLE IF NOT EXISTS developer_customizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('building_theme', 'glow_effect', 'profile_frame', 'special_title')),
  value        text NOT NULL,
  active       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_dev ON developer_customizations(developer_id);
ALTER TABLE developer_customizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_read_own ON developer_customizations FOR SELECT 
  USING (developer_id = (SELECT id FROM developers WHERE claimed_by = auth.uid()));

-- ─── Seed Data ────────────────────────────────────────────────────────
INSERT INTO quests (id, title, description, action, threshold, reward_xp, reward_pixels, reward_crate_id) VALUES
  ('search_devs',      'Search 3 Developers',      'Find active coders using the search box',      'search',            3,   15, 10, NULL),
  ('visit_buildings',  'Visit 5 Buildings',        'Explore the skyline and click on structures',  'visit_building',    5,   20, 15, NULL),
  ('compare_profiles',  'Compare 2 Profiles',       'Open profile comparisons side-by-side',        'compare',           2,   15, 10, NULL),
  ('fly_time',         'Fly for 2 Minutes',        'Activate Drone Fly Mode and navigate the skies', 'fly',             120,  25, 20, NULL),
  ('collect_pixels',   'Collect 10 Pixels',        'Earn pixels or complete plaza tasks',          'collect',          10,  20, 15, NULL),
  ('open_leaderboard', 'Open Leaderboard 3 Times', 'Check developer ranks and competitive feeds',  'leaderboard',       3,   15, 10, NULL),
  ('visit_ai_district', 'Visit AI District',       'Inspect projects in the machine learning core','visit_ai_district', 1,   20, 15, NULL),
  ('view_repos',       'View 5 Repositories',      'Examine open-source codebases in detail',       'view_repo',         5,   20, 15, NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  action = EXCLUDED.action,
  threshold = EXCLUDED.threshold,
  reward_xp = EXCLUDED.reward_xp,
  reward_pixels = EXCLUDED.reward_pixels;

INSERT INTO crates (id, name, rarity, cost_pixels) VALUES
  ('common',    'Common Cyber Crate',      'common',    100),
  ('rare',      'Rare Relic Crate',        'rare',      250),
  ('epic',      'Epic Matrix Crate',       'epic',      500),
  ('legendary', 'Legendary Singularity',   'legendary', 1000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  cost_pixels = EXCLUDED.cost_pixels;

-- Seed rewards
INSERT INTO crate_rewards (crate_id, reward_type, reward_value, weight) VALUES
  -- Common Crate
  ('common', 'pixels', '50', 50),
  ('common', 'pixels', '80', 30),
  ('common', 'xp', '100', 40),
  ('common', 'badge', 'Crate Novice', 10),
  -- Rare Crate
  ('rare', 'pixels', '150', 40),
  ('rare', 'xp', '300', 40),
  ('rare', 'skin', 'cyberpunk', 20),
  ('rare', 'frame', 'neon_border', 20),
  ('rare', 'badge', 'Plaza Regular', 10),
  -- Epic Crate
  ('epic', 'pixels', '300', 30),
  ('epic', 'xp', '600', 30),
  ('epic', 'skin', 'steampunk', 20),
  ('epic', 'effect', 'ghost_glow', 20),
  ('epic', 'frame', 'matrix_rain', 15),
  ('epic', 'badge', 'Epic Collector', 5),
  -- Legendary Crate
  ('legendary', 'pixels', '800', 20),
  ('legendary', 'xp', '1500', 20),
  ('legendary', 'skin', 'obsidian', 20),
  ('legendary', 'effect', 'fire_trail', 20),
  ('legendary', 'frame', 'legend_shield', 15),
  ('legendary', 'badge', 'Citadel Lord', 5);
