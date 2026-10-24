'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, Events } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = process.env.NEXVAULT_API_URL;
const API_SECRET = process.env.NEXVAULT_API_SECRET;
const ROTATION_MS = 120_000;
if (!TOKEN || !CLIENT_ID || !API_URL || !API_SECRET || API_SECRET.includes('CHANGE_THIS')) {
  console.error('Missing configuration. Copy .env.example to .env and fill in every required value.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let categoriesCache = [];
let presenceToggle = false;
let presenceTimer;

async function api(action, options = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  const response = await fetch(url, {
    method: options.body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${API_SECRET}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Website API returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || `Website API error (${response.status}).`);
  return data;
}

async function fetchCategories() {
  const result = await api('categories');
  categoriesCache = Array.isArray(result.categories) ? result.categories : [];
  return categoriesCache;
}

async function updatePresence() {
  try {
    if (!presenceToggle) {
      const result = await api('available_count');
      const count = Number.isFinite(Number(result.available)) ? Number(result.available) : 0;
      client.user.setPresence({ status: 'dnd', activities: [{ name: `${count} available codes`, type: ActivityType.Watching }] });
    } else {
      client.user.setPresence({ status: 'dnd', activities: [{ name: 'made by .sl4m3d', type: ActivityType.Watching }] });
    }
  } catch (error) {
    console.error(`[presence] ${error.message}`);
    // Keep the requested DND status and use a safe fallback if the website is temporarily offline.
    client.user.setPresence({ status: 'dnd', activities: [{ name: 'made by .sl4m3d', type: ActivityType.Watching }] });
  }
  presenceToggle = !presenceToggle;
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
