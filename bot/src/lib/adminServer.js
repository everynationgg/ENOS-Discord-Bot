const http = require('http');
const { supabase } = require('./supabase');
const logger = require('./logger');
const { spawnBossForGuild } = require('../modules/gaming/bossSpawn');

/**
 * Lightweight internal HTTP server for dashboard-triggered actions.
 * Secured with DASHBOARD_SECRET header.
 */
function startAdminServer(client) {
  const PORT = process.env.ADMIN_HTTP_PORT || 4080;
  const SECRET = process.env.DASHBOARD_SECRET;

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-dashboard-secret');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check
    const reqSecret = req.headers['x-dashboard-secret'];
    if (SECRET && reqSecret !== SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Parse body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const url = req.url;

        if (req.method === 'POST' && url === '/boss/spawn') {
          const guildId = data.guild_id || process.env.DISCORD_GUILD_ID;
          const customName = data.customName || null;
          const customHp = data.customHp ? parseInt(data.customHp, 10) : null;

          const result = await spawnBossForGuild(client, guildId, { customName, customHp });
          res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        if (req.method === 'GET' && url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      } catch (e) {
        logger.error('[ADMIN SERVER] Request error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[ADMIN SERVER] Listening on port ${PORT}`);
  });

  return server;
}

module.exports = { startAdminServer };
