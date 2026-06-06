-- ─── Game Analytics Event Pipeline ─────────────────────────
-- Append-only event stream + daily baseline snapshots.
-- The universal "event_name + props jsonb" model (Amplitude/Mixpanel/
-- Segment/PostHog all converge on this). Locked down; writes only via
-- the service-role admin client (logEvent helper).
--
-- Design notes:
--  • Plain table now (not partitioned). At current scale Postgres handles
--    OLTP+analytics fine. event_prune() handles retention. Partitioning is
--    a clean future migration when volume demands it.
--  • High-frequency signals (per-shot) must be SAMPLED/aggregated at the
--    source — never one row per shot.
--  • Baseline snapshot is captured DAILY so "DAU lift during event" is
--    computable after the fact (you can't reconstruct the "before" later).

BEGIN;

CREATE TABLE IF NOT EXISTS game_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name    text        NOT NULL,           -- snake_case object_action, past tense
  anonymous_id  uuid,                            -- pre-login session id (nullable)
  developer_id  bigint REFERENCES developers(id) ON DELETE SET NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  props         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT game_events_name_nonempty CHECK (event_name <> '' AND length(event_name) <= 64)
);

CREATE INDEX IF NOT EXISTS idx_game_events_name_time ON game_events (event_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_game_events_dev_time  ON game_events (developer_id, occurred_at) WHERE developer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_events_occurred  ON game_events (occurred_at);
-- Functional index for event-instance association (text is safe vs uuid cast)
CREATE INDEX IF NOT EXISTS idx_game_events_event_ref ON game_events ((props->>'event_id'));

-- ─── Daily baseline snapshot ─────────────────────────────────
-- Captured by a cron each morning. dau/wau use activity_feed as the broad
-- activity signal (distinct actors); raid_participants comes from events.
CREATE TABLE IF NOT EXISTS daily_metric_snapshot (
  day               date PRIMARY KEY,
  dau               int NOT NULL DEFAULT 0,
  wau               int NOT NULL DEFAULT 0,
  mau               int NOT NULL DEFAULT 0,
  events_total      bigint NOT NULL DEFAULT 0,
  raid_participants int NOT NULL DEFAULT 0,
  captured_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Access control: fully locked (forensic/analytics, admin only) ──
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metric_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON game_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON daily_metric_snapshot FROM PUBLIC, anon, authenticated;

-- ─── Server-side event logging RPC ──────────────────────────
-- Called by the logEvent() helper via the admin client. Keeps a single
-- write path. Anonymous/identified both supported.
CREATE OR REPLACE FUNCTION log_game_event(
  p_event_name   text,
  p_developer_id bigint,
  p_anonymous_id uuid,
  p_props        jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF p_event_name IS NULL OR p_event_name = '' OR length(p_event_name) > 64 THEN
    RETURN; -- drop malformed silently; analytics must never break gameplay
  END IF;
  INSERT INTO game_events (event_name, developer_id, anonymous_id, props)
  VALUES (p_event_name, p_developer_id, p_anonymous_id, COALESCE(p_props, '{}'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION log_game_event(text, bigint, uuid, jsonb) FROM PUBLIC;

-- ─── Batch logging RPC (preferred for buffered flushes) ─────
-- Accepts a jsonb array of {event_name, developer_id, anonymous_id, props}
-- and inserts in one statement. This is the row-by-row antidote.
CREATE OR REPLACE FUNCTION log_game_events_batch(p_events jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN RETURN 0; END IF;
  INSERT INTO game_events (event_name, developer_id, anonymous_id, props)
  SELECT
    e->>'event_name',
    NULLIF(e->>'developer_id', '')::bigint,
    NULLIF(e->>'anonymous_id', '')::uuid,
    COALESCE(e->'props', '{}'::jsonb)
  FROM jsonb_array_elements(p_events) AS e
  WHERE e->>'event_name' IS NOT NULL
    AND length(e->>'event_name') <= 64;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION log_game_events_batch(jsonb) FROM PUBLIC;

-- ─── Baseline snapshot RPC (called by daily cron) ───────────
CREATE OR REPLACE FUNCTION capture_daily_snapshot(p_day date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_dau int;
  v_wau int;
  v_mau int;
  v_events bigint;
  v_participants int;
BEGIN
  -- Broad activity signal from activity_feed (distinct actors)
  SELECT COUNT(DISTINCT actor_id) INTO v_dau
  FROM activity_feed WHERE created_at::date = p_day;

  SELECT COUNT(DISTINCT actor_id) INTO v_wau
  FROM activity_feed WHERE created_at >= (p_day - 6) AND created_at < (p_day + 1);

  SELECT COUNT(DISTINCT actor_id) INTO v_mau
  FROM activity_feed WHERE created_at >= (p_day - 29) AND created_at < (p_day + 1);

  SELECT COUNT(*) INTO v_events
  FROM game_events WHERE occurred_at::date = p_day;

  SELECT COUNT(DISTINCT developer_id) INTO v_participants
  FROM game_events WHERE occurred_at::date = p_day AND event_name = 'raid_joined';

  INSERT INTO daily_metric_snapshot (day, dau, wau, mau, events_total, raid_participants)
  VALUES (p_day, COALESCE(v_dau,0), COALESCE(v_wau,0), COALESCE(v_mau,0), COALESCE(v_events,0), COALESCE(v_participants,0))
  ON CONFLICT (day) DO UPDATE
    SET dau = EXCLUDED.dau, wau = EXCLUDED.wau, mau = EXCLUDED.mau,
        events_total = EXCLUDED.events_total, raid_participants = EXCLUDED.raid_participants,
        captured_at = now();

  RETURN json_build_object('day', p_day, 'dau', v_dau, 'wau', v_wau, 'mau', v_mau);
END;
$$;

REVOKE EXECUTE ON FUNCTION capture_daily_snapshot(date) FROM PUBLIC;

-- ─── Retention prune (housekeeping; call from cron) ─────────
CREATE OR REPLACE FUNCTION game_events_prune(p_keep_days integer DEFAULT 180)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM game_events WHERE occurred_at < (now() - make_interval(days => p_keep_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION game_events_prune(integer) FROM PUBLIC;

COMMIT;
