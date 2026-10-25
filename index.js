'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, Events } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = process.env.NEXVAULT_API;
const ROTATION_MS = 120_000;
if (!TOKEN || !CLIENT_ID || !API_URL || API_URL.includes('PASTE_THE_COMPLETE_API_URL') || !/^https?:\/\//i.test(API_URL)) {
  console.error('Missing configuration. Copy .env.example to .env and fill in every required value.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let categoriesCache = [];
let lastAvailableCount = null;
let presenceToggle = false;
let presenceTimer;

async function api(action, options = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  const response = await fetch(url, {
    method: options.body ? 'POST' : 'GET',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const contentType = response.headers.get('content-type') || '(missing content-type)';
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch {
    const preview = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(`Website API returned non-JSON (HTTP ${response.status}; ${contentType}). Response preview: ${preview || '(empty response)'}`);
  }
  if (!response.ok) throw new Error(data.error || `Website API error (${response.status}).`);
  return data;
}

async function fetchCategories() {
  const result = await api('categories');
  categoriesCache = Array.isArray(result.categories) ? result.categories : [];
  return categoriesCache;
}

async function updatePresence() {
  // Toggle the activity on every scheduled update, even when the website API is unavailable.
  if (!presenceToggle) {
    try {
      const result = await api('available_count');
      const count = Number(result.available);
      if (!Number.isFinite(count)) throw new Error('API response did not contain a numeric available count.');
      lastAvailableCount = count;
    } catch (error) {
      console.error(`[presence] ${error.message}`);
    }
    const label = lastAvailableCount === null ? 'codes status unavailable' : `${lastAvailableCount} available codes`;
    client.user.setPresence({ status: 'dnd', activities: [{ name: label, type: ActivityType.Watching }] });
  } else {
    client.user.setPresence({ status: 'dnd', activities: [{ name: 'made by .sl4m3d', type: ActivityType.Watching }] });
  }
  presenceToggle = !presenceToggle;
}

async function websiteStatus() {
  const started = Date.now();
  try {
    const health = await api('health');
    const [categoriesResult, countResult] = await Promise.all([api('categories'), api('available_count')]);
    const categories = Array.isArray(categoriesResult.categories) ? categoriesResult.categories : [];
    const count = Number(countResult.available);
    return {
      ok: true,
      latency: Date.now() - started,
      service: health.service || 'NexVault API',
      categories: categories.length,
      available: Number.isFinite(count) ? count : 'unknown',
    };
  } catch (error) {
    return { ok: false, latency: Date.now() - started, error: error.message };
  }
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await updatePresence();
  presenceTimer = setInterval(updatePresence, ROTATION_MS);
  try { await fetchCategories(); } catch (error) { console.error(`[categories] ${error.message}`); }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName !== 'generate') return;
      let categories;
      try { categories = await fetchCategories(); } catch { categories = categoriesCache; }
      const focused = interaction.options.getFocused().toLowerCase();
      const choices = categories
        .filter(c => c.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(c => ({ name: c.name.slice(0, 100), value: String(c.id) }));
      await interaction.respond(choices);
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'status') {
      await interaction.deferReply({ ephemeral: true });
      const status = await websiteStatus();
      if (status.ok) {
        await interaction.editReply(`**NexVault connection: ONLINE**\nWebsite API: responding with valid JSON\nLatency: ${status.latency} ms\nCategories: ${status.categories}\nAvailable codes: ${status.available}\nBot: online`);
      } else {
        await interaction.editReply(`**NexVault connection: OFFLINE / BLOCKED**\nBot: online\nWebsite API check failed after ${status.latency} ms.\n\`\`\`${status.error.slice(0, 900)}\`\`\`\nThe website must return JSON to the bot; a JavaScript browser-check HTML page means the hosting security layer is blocking the API request.`);
      }
      return;
    }
    if (interaction.commandName === 'generate') {
      await interaction.deferReply({ ephemeral: true });
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.editReply('Use this command inside the configured Discord server.');
        return;
      }
      let categories;
      try { categories = await fetchCategories(); } catch (error) {
        await interaction.editReply('The NexVault website is temporarily unavailable. Please try again later.');
        return;
      }
      const categoryId = interaction.options.getString('category', true);
      const category = categories.find(c => String(c.id) === categoryId);
      if (!category) {
        await interaction.editReply('That category is unavailable. Please choose an active category.');
        return;
      }
      if (category.required_guild_id && interaction.guildId !== String(category.required_guild_id)) {
        await interaction.editReply('This category can only be used in its required Discord server.');
        return;
      }
      if (category.required_role_id) {
        const member = interaction.member;
        const roleCache = member?.roles?.cache;
        const hasRole = roleCache ? roleCache.has(String(category.required_role_id)) : Array.isArray(member?.roles) ? member.roles.includes(String(category.required_role_id)) : false;
        if (!hasRole) {
          await interaction.editReply('You do not have the required Discord role for this category.');
          return;
        }
      }
      let result;
      try { result = await api('generate', { body: { discord_id: interaction.user.id, category_id: Number(category.id) } }); }
      catch (error) { await interaction.editReply(error.message || 'Could not generate a code.'); return; }
      try {
        await interaction.user.send({ content: `**NexVault redemption code**\nCategory: **${result.category || category.name}**\n\n\`${result.code}\`\n\nRedeem this code at ${new URL('../', API_URL).origin}. Each code can be redeemed once. Keep it private.` });
        await interaction.editReply('Your code has been sent to you in a direct message.');
      } catch {
        // The API keeps the assignment linked to this Discord ID. Retrying /generate returns the same code.
        await interaction.editReply('I could not DM you. Enable direct messages from server members, then run `/generate` again. Your assigned code will not be consumed by this message failure.');
      }
    }
  } catch (error) {
    console.error(`[interaction] ${error.stack || error.message}`);
    const message = 'Something went wrong. Please try again later.';
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    else if (interaction.isRepliable()) await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
});

process.on('unhandledRejection', error => console.error('[unhandledRejection]', error));
process.on('SIGINT', () => { if (presenceTimer) clearInterval(presenceTimer); client.destroy(); process.exit(0); });
client.login(TOKEN);
