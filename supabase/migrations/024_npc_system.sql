-- Migration: 024_npc_system.sql
-- Description: Creates tables for the ENOS AI Community Member (NPC) system

-- 1. Member Relationships Table
CREATE TABLE IF NOT EXISTS npc_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT,
    familiarity_tier INTEGER DEFAULT 0, -- 0: Stranger, 1: Acquaintance, 2: Regular, 3: Veteran
    interaction_count INTEGER DEFAULT 0,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_spoke_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_npc_relationships_lookup ON npc_relationships(guild_id, user_id);

-- 2. Member Memories Table (Learned Facts with Decay)
CREATE TABLE IF NOT EXISTS npc_member_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    fact TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'gaming_taste', 'habit', 'preference', 'shared_moment'
    confidence NUMERIC DEFAULT 0.8,
    last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_npc_memories_user ON npc_member_memories(guild_id, user_id);

-- 3. Server Lore & Milestones Table
CREATE TABLE IF NOT EXISTS npc_server_lore (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'milestone', 'tradition', 'joke', 'general'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_npc_lore_guild ON npc_server_lore(guild_id);

-- 4. Deliberation & Thought Logs Table (Ephemeral, for admin transparency)
CREATE TABLE IF NOT EXISTS npc_deliberation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'mention', 'name_drop', 'ambient_chat'
    trigger_message TEXT,
    author_id TEXT,
    should_speak BOOLEAN NOT NULL,
    internal_thought TEXT,
    generated_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_npc_logs_guild ON npc_deliberation_logs(guild_id, created_at DESC);

-- 5. Seed default guild_config row for npc_companion if not present
INSERT INTO guild_config (guild_id, feature_key, enabled, config)
VALUES (
    'default',
    'npc_companion',
    false,
    '{
        "sarcasm_level": 3,
        "social_energy": 2,
        "response_brevity": "balanced",
        "allowed_channel_ids": [],
        "ambient_cooldown_minutes": 20,
        "quiet_hours_enabled": false,
        "quiet_hours_start": "02:00",
        "quiet_hours_end": "08:00",
        "banned_topics": []
    }'::jsonb
)
ON CONFLICT (guild_id, feature_key) DO NOTHING;
