-- ============================================================
-- Migration 025: Add is_dismissed flag to birthday_queue
-- Allows admins to dismiss/delete upcoming birthday items from the queue
-- without the daily/load sync resurrecting them during the 3-day window.
-- ============================================================

ALTER TABLE birthday_queue
ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_birthday_queue_dismissed ON birthday_queue(is_dismissed);
