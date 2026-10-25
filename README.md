# NexVault Discord Bot (JavaScript)

Discord.js v14 bot for `NexVault`. It provides `/generate category:<category>` and `/status`, sends codes by DM, checks configured guild/role requirements, and keeps its presence at **Do Not Disturb** while rotating the Watching activity every 120 seconds:

1. `Watching X available codes`
2. `Watching made by .sl4m3d`

The available count comes from the PHP API and includes only codes in active categories with `available` status.

## Important: API hosting

The website and API must be hosted on a service that allows direct server-to-server requests. Do not use the previous InfinityFree URL for the bot API, because its free-tier JavaScript challenge can return HTML instead of JSON. Deploy the PHP website and database to the new host first, then generate a fresh API URL in the new Admin Panel. The free HOKAS plan advertises PHP, MySQL and public URLs, but its uptime allowance must be renewed by watching an ad; this is free but not guaranteed always-on.

## Requirements

- Node.js 20 or newer
- A Discord application and bot token
- A host that can keep a Node.js process running continuously
- The website deployed and its API configured

InfinityFree is for the PHP website; do not try to run this bot as a persistent process on InfinityFree.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in `DISCORD_TOKEN`, `CLIENT_ID`, and `NEXVAULT_API`.
3. Log in to the website as `admin`, open Admin Panel, and use **Generate / rotate bot API key**. Copy the complete URL shown once (it starts with `https://YOUR-NEW-HOST/api/index.php?key=`) and paste the entire URL into `NEXVAULT_API` in `.env`. You do not need a local computer or PHP CLI to create it. If lost, generate a replacement in Admin Panel; the old key is immediately revoked.
4. In this directory, run `npm install`.
5. Optionally set `GUILD_ID` for quick testing in one server. Leave it blank to register the command globally (global command propagation may take time).
6. Run `npm run deploy-commands` once whenever command definitions change.
7. Run `npm start` and keep the process online. Use `/status` in Discord to test the website API connection and see latency, categories, and available codes.
8. In the Discord Developer Portal, set the bot's display name to `NexVault`, invite it with the `bot` and `applications.commands` scopes, and grant it permission to send messages in DMs. The bot uses only the standard Guilds intent; role requirements are checked against the role IDs delivered with the interaction, so no privileged Server Members Intent is required.

## Category requirements

Set a category's optional required Discord server ID and role ID in the website Admin Panel. IDs must be numeric Discord snowflakes. If a role is configured, users must have that role. A category can also have a per-user generation limit and cooldown. `/generate` uses autocomplete to show active categories from the website.

If DMs are closed, the bot tells the user to enable them and retry. The API returns the same assigned code on retry rather than consuming another code. A code becomes redeemed only when a website user successfully redeems it.

## Presence details

The first activity is set when the bot becomes ready, then the activity changes every 120 seconds. The bot sets `dnd` on each update. The activity alternates every 120 seconds even when the API is down; the bot shows `Watching codes status unavailable` if it has not obtained a valid count yet. `/status` diagnoses the API and explicitly reports HTML/JavaScript challenge responses.

Keep `.env` private. Never commit your Discord token or the generated API URL; the URL contains the private API key.

## Hosting note

If `/status` receives a `text/html` JavaScript browser-check page instead of JSON, this is a hosting-layer block from the current InfinityFree setup. Bot code cannot turn that HTML into the API data. The API must be served from a host that permits machine-to-machine requests, or the website hosting must be moved. Do not treat an HTTP 200 alone as API success.
