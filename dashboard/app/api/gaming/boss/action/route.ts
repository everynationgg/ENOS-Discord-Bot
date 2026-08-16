import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function getGuildId(req: NextRequest, body?: any) {
  return (
    req.nextUrl.searchParams.get('guild_id') ||
    body?.guild_id ||
    process.env.DISCORD_GUILD_ID!
  );
}

function getWeekIdentifier(date = new Date()) {
  const tzOffsetMs = 8 * 60 * 60 * 1000;
  const targetDate = new Date(date.getTime() + tzOffsetMs);
  const d = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// NOTE: Discord posting is handled exclusively by the bot worker via Supabase Realtime
// on the boss_seasons table. The dashboard only writes to the database.

async function resolveDirectImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  if (url.includes('i.ibb.co/') || /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)) return url;
  return url;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const guildId = getGuildId(req, body);
    const { action, customName, gameName, customHp, customImageUrl: rawImageUrl, customBgUrl: rawBgUrl } = body;
    const currentWeek = getWeekIdentifier();
    const resolvedImageUrl = await resolveDirectImageUrl(rawImageUrl);
    const resolvedBgUrl = await resolveDirectImageUrl(rawBgUrl);

    if (action === 'spawn' || action === 'spawn_staged') {
      // Check if Guild Admin pre-staged next week's boss config in guild_config or passed in body
      const { data: featureRow } = await supabaseAdmin
        .from('guild_config')
        .select('config')
        .eq('guild_id', guildId)
        .eq('feature_key', 'weekly_boss')
        .maybeSingle();

      const stagedConfig = body.stagedConfig || featureRow?.config?.staged_boss_config;

      const charName = customName && customName.trim() ? customName.trim() : 'Corrupted Anomaly';
      const gameLabel = gameName && gameName.trim() ? gameName.trim() : 'Gaming Realm';

      let bossName = charName.startsWith('ERROR-MOD:') ? charName : `ERROR-MOD: Corrupted ${charName}`;
      let bossTitle = `System Threat (${gameLabel})`;
      let lore = `A space-time realm rift merged ${gameLabel} data with ENOS core protocols. ${charName} has manifested in the server! Coordinate your triad skills to neutralize!`;
      let hp = customHp ? parseInt(customHp, 10) : 150000;
      let finalImageUrl = resolvedImageUrl || null;
      let finalBgUrl = resolvedBgUrl || featureRow?.config?.custom_bg_url || null;

      if (action === 'spawn_staged' || stagedConfig) {
        const sName = stagedConfig?.override_name || stagedConfig?.boss_name;
        const sTitle = stagedConfig?.boss_title;
        const sLore = stagedConfig?.lore;
        const sHp = stagedConfig?.max_hp || stagedConfig?.override_hp;
        if (sName) bossName = sName;
        if (sTitle) bossTitle = sTitle;
        if (sLore) lore = sLore;
        if (sHp) hp = Number(sHp);
        if (stagedConfig?.custom_image_url) finalImageUrl = await resolveDirectImageUrl(stagedConfig.custom_image_url);
        if (stagedConfig?.custom_bg_url) finalBgUrl = await resolveDirectImageUrl(stagedConfig.custom_bg_url);

        // Promote staged artwork & fields into active config and clear staged_boss_config
        const updatedCfg = { ...(featureRow?.config || {}) };
        if (stagedConfig?.game_name) updatedCfg.game_name = stagedConfig.game_name;
        if (sName) updatedCfg.override_name = sName;
        if (sTitle) updatedCfg.boss_title = sTitle;
        if (sLore) updatedCfg.lore = sLore;
        if (sHp) updatedCfg.override_hp = sHp;
        if (stagedConfig?.custom_image_url) updatedCfg.custom_image_url = stagedConfig.custom_image_url;
        if (stagedConfig?.custom_bg_url) updatedCfg.custom_bg_url = stagedConfig.custom_bg_url;
        if (stagedConfig?.victory_image_url) updatedCfg.victory_image_url = stagedConfig.victory_image_url;
        if (stagedConfig?.loss_image_url) updatedCfg.loss_image_url = stagedConfig.loss_image_url;
        if (stagedConfig?.mom_image_url) updatedCfg.mom_image_url = stagedConfig.mom_image_url;
        if (stagedConfig?.dad_image_url) updatedCfg.dad_image_url = stagedConfig.dad_image_url;
        if (stagedConfig?.kid_image_url) updatedCfg.kid_image_url = stagedConfig.kid_image_url;

        delete updatedCfg.staged_boss_config;
        await supabaseAdmin.from('guild_config').upsert({
          guild_id: guildId,
          feature_key: 'weekly_boss',
          config: updatedCfg,
          updated_at: new Date().toISOString(),
        });
      }

      // Check for existing active normal boss row for current week for THIS guild
      const { data: existingBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false)
        .maybeSingle();

      let activeBoss: any = null;
      if (existingBoss) {
        // Update existing row
        const { data: updated, error: updErr } = await supabaseAdmin
          .from('boss_seasons')
          .update({
            boss_name: bossName,
            boss_title: bossTitle,
            lore,
            max_hp: hp,
            current_hp: hp,
            is_defeated: false,
            mom_buff: false,
            dad_debuff: false,
            custom_image_url: finalImageUrl,
            custom_bg_url: finalBgUrl,
            last_action: '⚡ Admin force spawned a new Weekly Boss!',
          })
          .eq('id', existingBoss.id)
          .select()
          .single();

        if (updErr && updErr.message.includes('custom_bg_url')) {
          // Fallback if custom_bg_url column migration has not been applied yet
          const { data: retryUpdated, error: retryErr } = await supabaseAdmin
            .from('boss_seasons')
            .update({
              boss_name: bossName,
              boss_title: bossTitle,
              lore,
              max_hp: hp,
              current_hp: hp,
              is_defeated: false,
              mom_buff: false,
              dad_debuff: false,
              custom_image_url: finalImageUrl,
              last_action: '⚡ Admin force spawned a new Weekly Boss!',
            })
            .eq('id', existingBoss.id)
            .select()
            .single();

          if (retryErr) {
            return NextResponse.json({ error: retryErr.message }, { status: 500 });
          }
          activeBoss = retryUpdated;
        } else if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        } else {
          activeBoss = updated;
        }
      } else {
        // Upsert row safely
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from('boss_seasons')
          .upsert({
            guild_id: guildId,
            week_identifier: currentWeek,
            boss_name: bossName,
            boss_title: bossTitle,
            lore,
            max_hp: hp,
            current_hp: hp,
            is_overkill: false,
            is_defeated: false,
            mom_buff: false,
            dad_debuff: false,
            custom_image_url: finalImageUrl,
            custom_bg_url: finalBgUrl,
            last_action: '⚡ Admin force spawned a new Weekly Boss!',
          }, { onConflict: 'guild_id,week_identifier,is_overkill' })
          .select()
          .single();

        if (insErr && insErr.message.includes('custom_bg_url')) {
          // Fallback if custom_bg_url column migration has not been applied yet
          const { data: retryInserted, error: retryInsErr } = await supabaseAdmin
            .from('boss_seasons')
            .upsert({
              guild_id: guildId,
              week_identifier: currentWeek,
              boss_name: bossName,
              boss_title: bossTitle,
              lore,
              max_hp: hp,
              current_hp: hp,
              is_overkill: false,
              is_defeated: false,
              mom_buff: false,
              dad_debuff: false,
              custom_image_url: finalImageUrl,
              last_action: '⚡ Admin force spawned a new Weekly Boss!',
            }, { onConflict: 'guild_id,week_identifier,is_overkill' })
            .select()
            .single();

          if (retryInsErr) {
            return NextResponse.json({ error: retryInsErr.message }, { status: 500 });
          }
          activeBoss = retryInserted;
        } else if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        } else {
          activeBoss = inserted;
        }
      }

      // Bot worker will detect this DB change via Realtime and post the full canvas card
      return NextResponse.json({ success: true, action: 'spawn', boss: activeBoss });
    }

    if (action === 'update_image') {
      const { data: existingBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false)
        .maybeSingle();

      if (!existingBoss) {
        return NextResponse.json({ error: 'No active boss season found to update' }, { status: 400 });
      }

      const { data: updatedBoss, error } = await supabaseAdmin
        .from('boss_seasons')
        .update({
          custom_image_url: resolvedImageUrl || null,
          last_action: '🎨 Boss Artwork updated from Admin Dashboard!',
        })
        .eq('id', existingBoss.id)
        .select()
        .single();

      if (error || !updatedBoss) {
        return NextResponse.json({ error: error?.message || 'Failed to update boss image' }, { status: 500 });
      }

      // Bot worker will detect this DB change via Realtime and post the full canvas card
      return NextResponse.json({ success: true, action: 'update_image', boss: updatedBoss });
    }

    if (action === 'refresh') {
      const { data: featureRow } = await supabaseAdmin
        .from('guild_config')
        .select('config')
        .eq('guild_id', guildId)
        .eq('feature_key', 'weekly_boss')
        .maybeSingle();

      const { data: existingBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false)
        .maybeSingle();

      const cfgName = featureRow?.config?.override_name || featureRow?.config?.boss_name;
      const cfgGame = featureRow?.config?.game_name;
      const cfgTitle = featureRow?.config?.boss_title;
      const cfgLore = featureRow?.config?.lore;
      const cfgHp = featureRow?.config?.override_hp || featureRow?.config?.max_hp;
      const cfgImg = featureRow?.config?.custom_image_url;
      const cfgBg = featureRow?.config?.custom_bg_url;

      const rawCharName = cfgName || (existingBoss ? existingBoss.boss_name.replace(/^ERROR-MOD:\s*Corrupted\s*/i, '') : 'Anomaly');
      const gameLabel = cfgGame || 'Gaming Realm';

      const newBossName = cfgName ? (cfgName.startsWith('ERROR-MOD:') ? cfgName : `ERROR-MOD: Corrupted ${cfgName}`) : (existingBoss?.boss_name || `ERROR-MOD: Corrupted ${rawCharName}`);
      const newBossTitle = cfgTitle || (cfgGame ? `System Threat (${gameLabel})` : (existingBoss?.boss_title || `System Threat (${gameLabel})`));
      const newLore = cfgLore || (existingBoss?.lore || `A space-time realm rift merged ${gameLabel} data with ENOS core protocols. ${rawCharName} has manifested in the server! Coordinate your triad skills to neutralize!`);
      const newMaxHp = cfgHp ? Number(cfgHp) : (existingBoss?.max_hp || 150000);
      const newImg = cfgImg ? await resolveDirectImageUrl(cfgImg) : existingBoss?.custom_image_url;
      const newBg = cfgBg ? await resolveDirectImageUrl(cfgBg) : existingBoss?.custom_bg_url;

      if (existingBoss) {
        const { data: updatedBoss, error } = await supabaseAdmin
          .from('boss_seasons')
          .update({
            boss_name: newBossName,
            boss_title: newBossTitle,
            lore: newLore,
            max_hp: newMaxHp,
            custom_image_url: newImg,
            custom_bg_url: newBg,
            last_action: '🔄 Boss Card refreshed from Admin Dashboard!',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingBoss.id)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'refresh', boss: updatedBoss });
      } else {
        const { data: newBoss, error } = await supabaseAdmin
          .from('boss_seasons')
          .insert({
            guild_id: guildId,
            week_identifier: currentWeek,
            boss_name: newBossName,
            boss_title: newBossTitle,
            lore: newLore,
            max_hp: newMaxHp,
            current_hp: newMaxHp,
            is_defeated: false,
            is_overkill: false,
            mom_buff: false,
            dad_debuff: false,
            custom_image_url: newImg,
            custom_bg_url: newBg,
            last_action: '⚡ Admin initialized Weekly Boss from Dashboard!',
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'refresh', boss: newBoss });
      }
    }

    if (action === 'end') {
      await supabaseAdmin
        .from('boss_seasons')
        .update({ is_defeated: true, current_hp: 0 })
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek);

      await supabaseAdmin
        .from('boss_player_states')
        .update({ ap_remaining: 5, is_locked: false })
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek);

      return NextResponse.json({ success: true, action: 'end' });
    }

    if (action === 'overkill') {
      const { data: currentBoss } = await supabaseAdmin
        .from('boss_seasons')
        .select('*')
        .eq('guild_id', guildId)
        .eq('week_identifier', currentWeek)
        .eq('is_overkill', false)
        .maybeSingle();

      if (!currentBoss) {
        return NextResponse.json({ error: 'No active normal boss found to transition to Overkill.' }, { status: 400 });
      }

      await supabaseAdmin
        .from('boss_seasons')
        .update({ is_defeated: true, current_hp: 0 })
        .eq('id', currentBoss.id);

      const overkillHp = Math.round(Number(currentBoss.max_hp) * 1.5);
      const { data: overkillBoss, error: okErr } = await supabaseAdmin
        .from('boss_seasons')
        .upsert({
          guild_id: currentBoss.guild_id || guildId,
          week_identifier: currentWeek,
          boss_name: `[OVERKILL] ${currentBoss.boss_name}`,
          boss_title: `${currentBoss.boss_title} (Unbound)`,
          lore: `EMERGENCY OVERDRIVE: ${currentBoss.boss_name} evolved into an unstoppable system threat! All players receive bonus points for extra damage!`,
          max_hp: overkillHp,
          current_hp: overkillHp,
          is_overkill: true,
          is_defeated: false,
          mom_buff: false,
          dad_debuff: false,
          custom_image_url: currentBoss.custom_image_url,
          last_action: '⚡ OVERKILL MODE ACTIVATED! Emergency Backup System online.',
        }, { onConflict: 'guild_id,week_identifier,is_overkill' })
        .select()
        .single();

      if (okErr) {
        return NextResponse.json({ error: okErr.message }, { status: 500 });
      }

      // Bot worker will detect this DB change via Realtime and post the full canvas card
      return NextResponse.json({ success: true, action: 'overkill', boss: overkillBoss });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
