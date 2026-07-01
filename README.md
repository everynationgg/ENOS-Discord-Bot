# ENOS — Every Nation Discord Bot & Dashboard

> Full-stack Discord community platform: persistent bot + web configuration dashboard.

---

## Project Structure

```
ENOS/
├── bot/          # discord.js v14 bot (Node.js)
├── dashboard/    # Next.js 14 App Router dashboard
└── supabase/     # PostgreSQL schema migrations
```

---

## Quick Start

### 1. Supabase Setup
1. Create a free project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run the contents of `supabase/migrations/001_initial_schema.sql`
3. Copy your **Project URL** and **Service Role Key** from Project Settings → API

### 2. Discord Application
1. Go to [discord.com/developers](https://discord.com/developers/applications)
2. Create a new application → add a Bot
3. Enable **Message Content Intent**, **Server Members Intent**, **Presence Intent**
4. Copy the **Application Client ID**, **Client Secret**, and **Bot Token**
5. Under OAuth2 → Redirects, add `http://localhost:3000/api/auth/callback/discord`

### 3. Bot Setup

```bash
cd bot
cp .env.example .env
# Fill in your values in .env

npm install
npm run deploy    # Register slash commands
npm run dev       # Start bot with hot reload
```

### 4. Dashboard Setup

```bash
cd dashboard
cp .env.example .env.local
# Fill in your values in .env.local

npm install
npm run dev       # Start at http://localhost:3000
```

---

## Environment Variables

### Bot (`bot/.env`)

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application Client ID |
| `DISCORD_GUILD_ID` | Your server's ID |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `TWITCH_CLIENT_ID` | Twitch application client ID |
| `TWITCH_CLIENT_SECRET` | Twitch application client secret |
| `YOUTUBE_API_KEY` | Google Cloud YouTube Data API v3 key |
| `BOT_TIMEZONE` | Timezone for cron jobs (default: `Asia/Manila`) |
| `DIGEST_POST_TIME` | Daily digest time in 24h format (default: `08:00`) |

### Dashboard (`dashboard/.env.local`)

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Dashboard URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret for session encryption |
| `DISCORD_CLIENT_ID` | Same as bot |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 client secret |
| `DISCORD_GUILD_ID` | Your server's ID |
| `DISCORD_ADMIN_ROLE_ID` | Role ID that grants dashboard access |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

---

## Discord Bot Permissions

When inviting the bot, use this permission integer: `8` (Administrator) or at minimum:
- Manage Roles, Manage Nicknames
- Send Messages, Embed Links, Read Message History
- View Channels

OAuth2 Scopes: `bot applications.commands`

---

## Discord Slash Commands

| Command | Description |
|---|---|
| `/lfg create` | Create a new LFG party session |
| `/vault profile` | View your Vault coin balance and tier |
| `/vault leaderboard` | Top 10 earners leaderboard |
| `/vault give @user amount` | Admin: award coins manually |
| `/admin setup-landing` | Post/refresh the verification welcome embed |
| `/admin run-digest` | Manually trigger the daily digest |
| `/admin prune-now` | Run 30-day data pruning immediately |
| `/admin status` | Bot health and uptime status |

---

## Deployment

### Bot → Railway
1. Push code to GitHub
2. Create a new Railway project → Deploy from GitHub → select `bot/` root
3. Add all environment variables in Railway dashboard
4. Service stays alive 24/7 on free tier

### Dashboard → Vercel
1. Push code to GitHub
2. Import repository at [vercel.com](https://vercel.com)
3. Set Root Directory to `dashboard`
4. Add environment variables in Vercel dashboard
5. Add Vercel deployment URL to Discord OAuth2 Redirects

---

## Features

| Feature | Tab | Status |
|---|---|---|
| Gatekeeper Onboarding | Moderation | ✅ |
| LFG Party Finder | Gaming | ✅ |
| Vault Economy | Gaming | ✅ |
| Daily Slang Digest (Gemini) | System Ops | ✅ |
| Twitch Live Alerts | Social | ✅ |
| YouTube Live Alerts | Social | ✅ |
| 30-Day Auto Pruning | System | ✅ |
| Web Config Dashboard | — | ✅ |
| Discord OAuth2 Admin Login | — | ✅ |
