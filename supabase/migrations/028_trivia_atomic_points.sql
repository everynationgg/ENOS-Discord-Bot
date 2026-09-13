-- ENOS Migration 028: Atomic Trivia Points RPC
-- Eliminates race conditions during concurrent trivia answering by atomically incrementing player points.

CREATE OR REPLACE FUNCTION increment_trivia_points(
  p_guild_id TEXT,
  p_discord_id TEXT,
  p_delta INT
)
RETURNS TABLE (new_points INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points INT;
BEGIN
  INSERT INTO trivia_points (guild_id, discord_id, points, updated_at)
  VALUES (p_guild_id, p_discord_id, p_delta, NOW())
  ON CONFLICT (guild_id, discord_id)
  DO UPDATE SET
    points = trivia_points.points + p_delta,
    updated_at = NOW()
  RETURNING points INTO v_points;

  RETURN QUERY SELECT v_points;
END;
$$;
