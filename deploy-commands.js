'use strict';
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Set DISCORD_TOKEN and CLIENT_ID in .env first.');
  process.exit(1);
}
const commands = [
  new SlashCommandBuilder()
    .setName('generate')
    .setDescription('Request a one-time NexVault redemption code')
    .addStringOption(option => option
      .setName('category')
      .setDescription('Choose a code category')
      .setRequired(true)
      .setAutocomplete(true)),
].map(command => command.toJSON());
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log(`Successfully registered ${commands.length} command(s) ${GUILD_ID ? 'for guild ' + GUILD_ID : 'globally'}.`);
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exitCode = 1;
  }
})();
