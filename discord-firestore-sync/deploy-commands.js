const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { REST, Routes, PermissionFlagsBits } = require('discord.js');

const commands = [
  {
    name: 'syncmembers',
    description: 'Sync all Discord members (display names, nicknames, roles) to Firestore',
    dm_permission: false,
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
  },
  {
    name: 'listroles',
    description: 'List all role names and IDs in this guild',
    dm_permission: false,
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
  console.log('Registered slash commands for guild', process.env.GUILD_ID);
  } catch (e) {
    console.error('Failed to register commands:', e);
    process.exit(1);
  }
})();
