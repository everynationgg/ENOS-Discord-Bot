-- Migration 011: Enable Supabase Realtime publication on boss_seasons
-- This is required for the bot worker's Realtime channel subscription to receive
-- INSERT/UPDATE events and trigger the full canvas Arena card render.

ALTER PUBLICATION supabase_realtime ADD TABLE boss_seasons;
