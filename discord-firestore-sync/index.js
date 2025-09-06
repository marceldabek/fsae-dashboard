const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const admin = require('firebase-admin');

// Firebase Admin init
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp(); // uses the service account JSON via env path
  } else {
    try {
      const svc = require('./secrets/serviceAccount.json');
      admin.initializeApp({ credential: admin.credential.cert(svc) });
    } catch (e) {
      // Fallback to your actual key file name if present
      const svc = require('./secrets/uconn-fsae-ev-firebase-adminsdk-fbsvc-d98afe7345.json');
      admin.initializeApp({ credential: admin.credential.cert(svc) });
    }
  }
} catch (err) {
  console.error('Firebase Admin init failed:', err);
  process.exit(1);
}
const db = admin.firestore();

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Allowed role IDs (comma-separated in env). If empty, allow all.
const ALLOWED = new Set(
  (process.env.ALLOWED_ROLE_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

// Map a GuildMember -> Firestore doc
function memberToDoc(guild, m, syncTag) {
  const roles = m.roles.cache
    .filter(r => r.id !== guild.id) // drop @everyone
    .map(r => ({ id: r.id, name: r.name }));

  return {
    uid: m.id,
    username: m.user.username,
    globalName: m.user.globalName || null,
    displayName: m.displayName,         // nickname if set, else username
    nickname: m.nickname || null,       // explicit nickname only
    roles,                               // [{id,name}]
    roleIds: roles.map(r => r.id),       // convenience for queries
    avatarUrl: m.user.displayAvatarURL({ size: 256 }),
    joinedAt: m.joinedAt ? admin.firestore.Timestamp.fromDate(m.joinedAt) : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSyncTag: syncTag,                // mark docs touched by this run
  };
}

async function authoritativeSync(guildId) {
  const guild = await client.guilds.fetch(guildId);
  const members = await guild.members.fetch(); // requires Server Members intent

  const col = db.collection('discordGuilds').doc(guild.id).collection('members');
  const syncTag = new Date().toISOString();

  // 1) Upsert all current members with lastSyncTag = syncTag
  const WRITE_CHUNK = 450;
  let writeBatch = db.batch();
  let upserted = 0;

  for (const m of members.values()) {
    const hasAllowed = ALLOWED.size === 0 ? true : m.roles.cache.some(r => ALLOWED.has(r.id));
    if (!hasAllowed) continue; // skip writing this doc
    writeBatch.set(col.doc(m.id), memberToDoc(guild, m, syncTag), { merge: true });
    upserted++;
    if (upserted % WRITE_CHUNK === 0) {
      await writeBatch.commit();
      writeBatch = db.batch();
    }
  }
  if (upserted % WRITE_CHUNK !== 0) await writeBatch.commit();

  // 2) Remove any docs NOT seen this run (lastSyncTag != syncTag)
  const snap = await col.get();
  const DELETE_CHUNK = 450;
  let deleteBatch = db.batch();
  let removed = 0;

  snap.forEach(doc => {
    const data = doc.data() || {};
    if (data.lastSyncTag !== syncTag) {
      deleteBatch.delete(doc.ref);
      removed++;
      if (removed % DELETE_CHUNK === 0) {
        deleteBatch.commit(); // fire and forget
        deleteBatch = db.batch();
      }
    }
  });
  if (removed % DELETE_CHUNK !== 0) await deleteBatch.commit();

  return { upserted, removed, total: members.size };
}

// Event hooks
client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'syncmembers') {
    // Only allow Manage Server (matches command default)
    const ok = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!ok) return interaction.reply({ content: 'You need Manage Server.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId; // sync the guild where command is run
      const { upserted, removed, total } = await authoritativeSync(guildId);
      const allowedStr = ALLOWED.size ? `Allowed roles: ${[...ALLOWED].join(', ')}` : 'Allowed roles: (all)';
      await interaction.editReply(`Synced ${upserted} members (roles included). Removed ${removed} stale docs. Current total: ${total}.\n${allowedStr}`);
    } catch (e) {
      console.error(e);
      await interaction.editReply(`Sync failed: ${e.message}`);
    }
    return;
  }

  if (interaction.commandName === 'listroles') {
    try {
      const guild = await client.guilds.fetch(interaction.guildId);
      await guild.roles.fetch();
      const lines = guild.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => `${r.name} — ${r.id}`)
        .sort((a, b) => a.localeCompare(b));

      const content = lines.join('\n');
      const max = 1900;
      const truncated = content.length > max ? content.slice(0, max) + '\n…' : content;
      await interaction.reply({ content: truncated || 'No roles found.', ephemeral: true });
    } catch (e) {
      console.error(e);
      await interaction.reply({ content: `Failed to list roles: ${e.message}`, ephemeral: true });
    }
  }
});

client.on('error', (e) => console.error('Discord client error:', e));

// Start bot
client.login(process.env.BOT_TOKEN);
