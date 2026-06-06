-- ─── Event Metrics (read-only analytics functions) ─────────
-- Purely additive: views + SECURITY DEFINER read functions the admin
-- dashboard calls. No data is mutated. Computes the canonical metric set:
-- summary, funnel, tier distribution, DAU lift, participant retention split.

BEGIN;

-- ─── Per-event summary view ─────────────────────────────────
CREATE OR REPLACE VIEW v_event_summary AS
SELECT
  ei.id,
  ei.slug,
  ei.status,
  ei.outcome,
  ei.starts_at,
  ei.ends_at,
  ei.boss_max_hp,
  ei.total_damage,
  ei.total_participants,
  COALESCE(p.distinct_participants, 0)   AS distinct_participants,
  COALESCE(p.outliers, 0)                AS flagged_outliers,
  COALESCE(c.rewards_granted, 0)         AS rewards_granted
FROM event_instances ei
LEFT JOIN (
  SELECT event_id,
         COUNT(*) FILTER (WHERE damage_dealt > 0) AS distinct_participants,
         COUNT(*) FILTER (WHERE flagged_outlier)  AS outliers
  FROM event_participations GROUP BY event_id
) p ON p.event_id = ei.id
LEFT JOIN (
  SELECT event_id, COUNT(*) AS rewards_granted
  FROM event_reward_claims GROUP BY event_id
) c ON c.event_id = ei.id;

GRANT SELECT ON v_event_summary TO anon, authenticated;

-- ─── Funnel: viewed → joined → defeated-event → reward claimed ──
CREATE OR REPLACE FUNCTION event_funnel(p_event_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT json_build_object(
    'viewed',   (SELECT COUNT(DISTINCT COALESCE(developer_id::text, anonymous_id::text))
                 FROM game_events WHERE event_name='raid_viewed' AND props->>'event_id' = p_event_id::text),
    'joined',   (SELECT COUNT(DISTINCT developer_id)
                 FROM game_events WHERE event_name='raid_joined' AND props->>'event_id' = p_event_id::text),
    'participated', (SELECT COUNT(*) FROM event_participations WHERE event_id=p_event_id AND damage_dealt>0),
    'rewarded', (SELECT COUNT(DISTINCT developer_id) FROM event_reward_claims WHERE event_id=p_event_id),
    'claimed',  (SELECT COUNT(DISTINCT developer_id) FROM event_reward_claims WHERE event_id=p_event_id AND status='claimed')
  );
$$;
REVOKE EXECUTE ON FUNCTION event_funnel(uuid) FROM PUBLIC;

-- ─── Reward tier distribution ───────────────────────────────
CREATE OR REPLACE FUNCTION event_tier_distribution(p_event_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT COALESCE(json_object_agg(rail_tier, n), '{}'::json) FROM (
    SELECT rail || ':' || tier AS rail_tier, COUNT(*) AS n
    FROM event_reward_claims WHERE event_id = p_event_id
    GROUP BY rail, tier
  ) t;
$$;
REVOKE EXECUTE ON FUNCTION event_tier_distribution(uuid) FROM PUBLIC;

-- ─── DAU lift: event window vs prior 7-day baseline ─────────
CREATE OR REPLACE FUNCTION event_dau_lift(p_event_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_start date; v_end date;
  v_event_dau numeric; v_baseline_dau numeric;
BEGIN
  SELECT starts_at::date, ends_at::date INTO v_start, v_end FROM event_instances WHERE id = p_event_id;
  IF v_start IS NULL THEN RETURN json_build_object('ok', false); END IF;

  SELECT AVG(dau) INTO v_event_dau FROM daily_metric_snapshot
   WHERE day >= v_start AND day <= v_end;
  SELECT AVG(dau) INTO v_baseline_dau FROM daily_metric_snapshot
   WHERE day >= (v_start - 7) AND day < v_start;

  RETURN json_build_object(
    'event_dau', ROUND(COALESCE(v_event_dau, 0)),
    'baseline_dau', ROUND(COALESCE(v_baseline_dau, 0)),
    'lift_pct', CASE WHEN COALESCE(v_baseline_dau,0) > 0
      THEN ROUND(((v_event_dau - v_baseline_dau) / v_baseline_dau) * 100, 1) ELSE NULL END
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION event_dau_lift(uuid) FROM PUBLIC;

-- ─── Retention split: D7 active, participants vs non-participants ──
-- "Active D7" = appeared in activity_feed in the 7 days after event end.
-- Participants = developers with a raid_joined for this event.
-- NOTE: quasi-experiment (selection bias) — report as "observed lift", not
-- proven causality.
CREATE OR REPLACE FUNCTION event_retention_split(p_event_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_end date;
  v_part_total int; v_part_ret int;
  v_non_total int;  v_non_ret int;
BEGIN
  SELECT ends_at::date INTO v_end FROM event_instances WHERE id = p_event_id;
  IF v_end IS NULL THEN RETURN json_build_object('ok', false); END IF;

  -- Participants: distinct devs who joined this event
  WITH participants AS (
    SELECT DISTINCT developer_id FROM event_participations
    WHERE event_id = p_event_id AND damage_dealt > 0 AND developer_id IS NOT NULL
  ),
  ret AS (
    SELECT DISTINCT actor_id AS developer_id FROM activity_feed
    WHERE created_at::date BETWEEN (v_end + 1) AND (v_end + 7)
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE r.developer_id IS NOT NULL)
    INTO v_part_total, v_part_ret
  FROM participants p LEFT JOIN ret r USING (developer_id);

  -- Non-participants: active devs in the event window who did NOT join
  WITH active_window AS (
    SELECT DISTINCT actor_id AS developer_id FROM activity_feed
    WHERE created_at::date BETWEEN (SELECT starts_at::date FROM event_instances WHERE id=p_event_id) AND v_end
  ),
  participants AS (
    SELECT DISTINCT developer_id FROM event_participations
    WHERE event_id = p_event_id AND damage_dealt > 0 AND developer_id IS NOT NULL
  ),
  non_part AS (
    SELECT a.developer_id FROM active_window a
    LEFT JOIN participants p USING (developer_id)
    WHERE p.developer_id IS NULL
  ),
  ret AS (
    SELECT DISTINCT actor_id AS developer_id FROM activity_feed
    WHERE created_at::date BETWEEN (v_end + 1) AND (v_end + 7)
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE r.developer_id IS NOT NULL)
    INTO v_non_total, v_non_ret
  FROM non_part np LEFT JOIN ret r USING (developer_id);

  RETURN json_build_object(
    'participant_total', v_part_total,
    'participant_d7_retained', v_part_ret,
    'participant_d7_pct', CASE WHEN v_part_total > 0 THEN ROUND(v_part_ret::numeric / v_part_total * 100, 1) ELSE NULL END,
    'non_participant_total', v_non_total,
    'non_participant_d7_retained', v_non_ret,
    'non_participant_d7_pct', CASE WHEN v_non_total > 0 THEN ROUND(v_non_ret::numeric / v_non_total * 100, 1) ELSE NULL END
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION event_retention_split(uuid) FROM PUBLIC;

COMMIT;
