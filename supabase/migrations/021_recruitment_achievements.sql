-- Migration: 021_recruitment_achievements.sql
-- Create table for tracking member invitations via Gatekeeper onboarding

CREATE TABLE IF NOT EXISTS member_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id TEXT NOT NULL,
  invited_member_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'pending', 'revoked')),
  invited_account_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_member_invites_inviter ON member_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_member_invites_status ON member_invites(status);
CREATE INDEX IF NOT EXISTS idx_member_invites_invited ON member_invites(invited_member_id);

-- Enable Row Level Security
ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;

-- Policies for public reading and service role management
CREATE POLICY "Allow public read access on member_invites"
  ON member_invites FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access on member_invites"
  ON member_invites FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_member_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_member_invites_updated_at ON member_invites;
CREATE TRIGGER trigger_member_invites_updated_at
  BEFORE UPDATE ON member_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_member_invites_updated_at();

-- Seed initial recruitment achievement configuration into guild_config for default guild if present
INSERT INTO guild_config (guild_id, feature_key, enabled, config)
VALUES (
  'global',
  'recruitment_achievement',
  true,
  '{
    "min_account_age_days": 365,
    "require_onboarding": true,
    "auto_assign_roles": true,
    "tiers": {
      "enis": {
        "title": "They Who Herald the Nation",
        "threshold": 5,
        "reward_type": "coins",
        "reward_val": 50
      },
      "enara": {
        "title": "Those Who Exalt the Nation",
        "threshold": 50,
        "reward_type": "nitro",
        "reward_val": "1 Month Discord Nitro + Boost"
      },
      "enorium": {
        "title": "The One Who Ordains the Nation",
        "threshold": 100,
        "reward_type": "nitro",
        "reward_val": "1 Year Discord Nitro + Boost",
        "exclusive": true
      }
    }
  }'::jsonb
)
ON CONFLICT (guild_id, feature_key) DO NOTHING;
