-- ============================================================
-- Migration 027: Track admin notification alerts for upcoming birthdays
-- Allows resilient 1-day ahead reminders without duplicate spam
-- ============================================================

ALTER TABLE birthday_queue
ADD COLUMN IF NOT EXISTS admin_alert_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_birthday_queue_admin_alert ON birthday_queue(admin_alert_sent);
