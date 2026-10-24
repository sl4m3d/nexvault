# NexVault Discord Bot (JavaScript)

Discord.js v14 bot for `NexVault`. It provides `/generate category:<category>`, sends codes by DM, checks configured guild/role requirements, and keeps its presence at **Do Not Disturb** while rotating the Watching activity every 120 seconds:

1. `Watching X available codes`
2. `Watching made by .sl4m3d`

The available count comes from the PHP API and includes only codes in active categories with `available` status.

## Requirements

- Node.js 20 or newer
- A Discord application and bot token
- A host that can keep a Node.js process running continuously
- The website deployed and its API configured

InfinityFree is for the PHP website; do not try to run this bot as a persistent process on InfinityFree.

## Setup

1. Run `npm start` once. If `.env` is missing, the bot automatically creates it from `.env.example` in the bot folder and exits with setup instructions. Edit that `.env` file and replace every placeholder. Both `index.js` and `deploy-commands.js` read the `.env` in this folder, even if the process is started from another working directory.
2. Fill in `DISCORD_TOKEN`, `CLIENT_ID`, and `NEXVAULT_API_URL`.
3. Log in to the website as `admin`, open Admin Panel, and use **Generate / rotate bot API key**. Copy the key shown once and paste it into `NEXVAULT_API_SECRET` in `.env`. You do not need a local computer or PHP CLI to create it. If lost, generate a replacement in Admin Panel; the old key is immediately revoked.
4. In this directory, run `npm install`.
5. Optionally set `GUILD_ID` for quick testing in one server. Leave it blank to register the command globally (global command propagation may take time).
6. Run `npm run deploy` (or `npm run deploy-commands`) once whenever command definitions change.
7. Run `npm start` and keep the process online.
8. In the Discord Developer Portal, set the bot's display name to `NexVault`, invite it with the `bot` and `applications.commands` scopes, and grant it permission to send messages in DMs. The bot uses only the standard Guilds intent; role requirements are checked against the role IDs delivered with the interaction, so no privileged Server Members Intent is required.

## Category requirements

Set a category's optional required Discord server ID and role ID in the website Admin Panel. IDs must be numeric Discord snowflakes. If a role is configured, users must have that role. A category can also have a per-user generation limit and cooldown. `/generate` uses autocomplete to show active categories from the website.

If DMs are closed, the bot tells the user to enable them and retry. The API returns the same assigned code on retry rather than consuming another code. A code becomes redeemed only when a website user successfully redeems it.

## Presence details

The first activity is set when the bot becomes ready, then the activity changes every 120 seconds. The bot sets `dnd` on each update. If the website API is temporarily unavailable, the bot logs the issue and displays `Watching made by .sl4m3d` until a later update succeeds.

Keep `.env` private. Never commit your Discord token or API secret.
