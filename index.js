/*
╔══════════════════════════════════════════════════════════════════════════════╗
║                         R.P FRANCE — DISCORD BOT                           ║
║                         index.js — v1.0                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ AVANT DE LANCER                                                             ║
║                                                                              ║
║ 1) Ajoute les variables d'environnement :                                   ║
║      DISCORD_TOKEN=ton_token                                                 ║
║      CLIENT_ID=id_de_ton_application                                        ║
║                                                                              ║
║ 2) Installe :                                                               ║
║      npm install discord.js better-sqlite3                                  ║
║                                                                              ║
║ 3) Active dans le Discord Developer Portal les intents privilégiés :        ║
║      • Server Members Intent                                                ║
║      • Message Content Intent                                               ║
║                                                                              ║
║ 4) Invite le bot avec au minimum :                                          ║
║      • View Channels                                                        ║
║      • Send Messages                                                        ║
║      • Manage Messages                                                      ║
║      • Manage Channels                                                      ║
║      • Manage Roles                                                         ║
║      • Moderate Members                                                      ║
║      • Read Message History                                                  ║
║      • View Audit Log                                                        ║
║                                                                              ║
║ 5) Aucun salon/rôle n'est imposé ici.                                      ║
║    Tu peux tout configurer ensuite avec /config.                            ║
║                                                                              ║
║ 6) Le système de mots interdits est une liste multilingue de base,           ║
║    volontairement extensible avec /config badword-add.                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
*/

'use strict';

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  PermissionFlagsBits,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  SlashCommandBuilder,
  REST,
  Routes,
  AuditLogEvent
} = require('discord.js');

const Database = require('better-sqlite3');

// ============================================================================
// ENV
// ============================================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN ou CLIENT_ID manquant.');
  process.exit(1);
}

// ============================================================================
// DATABASE
// ============================================================================

const db = new Database('./rpfrance.sqlite');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    origin_channel_id TEXT,
    answers TEXT NOT NULL DEFAULT '[]',
    question_index INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'collecting',
    log_channel_id TEXT,
    log_message_id TEXT,
    decision_reason TEXT,
    decided_by TEXT,
    created_at INTEGER NOT NULL,
    decided_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners INTEGER NOT NULL DEFAULT 1,
    role_id TEXT,
    end_at INTEGER NOT NULL,
    participants TEXT NOT NULL DEFAULT '[]',
    ended INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    closed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    upvotes TEXT NOT NULL DEFAULT '[]',
    downvotes TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    server_code TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
`);

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG = {
  accentColor: 0x5865F2,

  channels: {
    welcome: null,
    rules: null,
    applicationLogs: null,
    ticketCategory: null,
    suggestions: null,
    sessions: null,
    logs: null
  },

  roles: {
    verified: null,
    staff: null,
    ticketSupport: null
  },

  systems: {
    welcome: true,
    rules: true,
    applications: true,
    giveaways: true,
    security: true,
    tickets: true,
    sessions: true,
    suggestions: true
  },

  security: {
    enabled: true,

    antiRaid: true,
    antiSpam: true,
    antiMassMention: true,
    antiMassDelete: true,
    badWords: true,

    antiRaidJoinThreshold: 8,
    antiRaidWindowSeconds: 10,
    antiRaidTimeoutSeconds: 600,

    antiSpamCount: 6,
    antiSpamWindowSeconds: 5,
    antiSpamTimeoutSeconds: 15,

    massMentionThreshold: 5,
    massMentionTimeoutSeconds: 600,

    massDeleteThreshold: 10,
    massDeleteTimeoutSeconds: 600,

    badWordTimeoutSeconds: 30
  },

  tickets: {
    deleteOnClose: true,
    namePrefix: 'ticket'
  },

  sessions: {
    clearOnShutdown: true,
    pingEveryoneOnOpen: true
  },

  applications: {
    assignStaffRoleOnAccept: true,
    questions: [
      'Quel âge avez-vous ?',
      'Depuis combien de temps êtes-vous sur le serveur ?',
      'Pourquoi souhaitez-vous rejoindre le staff ?',
      'Avez-vous déjà eu une expérience en modération ?',
      'Quelles seraient vos qualités en tant que membre du staff ?',
      'Pourquoi devrions-nous vous accepter ?'
    ]
  },

  text: {
    welcomeTitle: 'Bienvenue sur R.P FRANCE !',
    welcomeMessage:
      'Bienvenue sur **R.P FRANCE** ! Pense à consulter le règlement et à valider ton accès.',
    dmWelcome:
      'Bienvenue sur **R.P FRANCE** ! 👋\n\nRends-toi dans le salon du règlement et clique sur **J’accepte le règlement** pour obtenir ton accès.',
    badWordDM:
      'Ton message a été supprimé automatiquement et tu as reçu une sanction car il contient un langage interdit par le règlement du serveur.',
    sessionOpened:
      'La session RP est maintenant ouverte.',
    sessionClosed:
      'La session RP est maintenant fermée.',
    ticketCreated:
      'Ton ticket a été créé.',
    ticketClosed:
      'Le ticket va être fermé.',
    applicationAccepted:
      'Félicitations ! Ta candidature staff a été acceptée.',
    applicationRefused:
      'Ta candidature staff a été refusée.'
  },

  bypass: {
    badWords: [],
    antiSpam: [],
    antiMassMention: [],
    antiMassDelete: [],
    antiRaid: [],
    tickets: [],
    applications: [],
    giveaways: [],
    sessions: []
  },

  customBadWords: []
};

// ============================================================================
// CONFIG HELPERS
// ============================================================================

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDeep(base, extra) {
  const output = deepClone(base);

  for (const [key, value] of Object.entries(extra || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = value;
    }
  }

  return output;
}

function getConfig(guildId) {
  const row = db
    .prepare('SELECT data FROM guild_configs WHERE guild_id = ?')
    .get(guildId);

  if (!row) {
    const config = deepClone(DEFAULT_CONFIG);

    db.prepare(`
      INSERT INTO guild_configs (guild_id, data)
      VALUES (?, ?)
    `).run(guildId, JSON.stringify(config));

    return config;
  }

  try {
    return mergeDeep(DEFAULT_CONFIG, JSON.parse(row.data));
  } catch {
    return deepClone(DEFAULT_CONFIG);
  }
}

function saveConfig(guildId, config) {
  db.prepare(`
    INSERT INTO guild_configs (guild_id, data)
    VALUES (?, ?)
    ON CONFLICT(guild_id)
    DO UPDATE SET data = excluded.data
  `).run(guildId, JSON.stringify(config));
}

function setNestedValue(object, path, value) {
  const parts = path.split('.');
  let current = object;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
}

function getNestedValue(object, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], object);
}

// ============================================================================
// CLIENT
// ============================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel]
});

// ============================================================================
// RUNTIME STATE
// ============================================================================

const spamTracker = new Map();
const joinTracker = new Map();

// ============================================================================
// MULTILINGUAL BAD WORD LIST
// ============================================================================

const BAD_WORDS = new Set([
  // French
  'merde',
  'putain',
  'pute',
  'salope',
  'connard',
  'connasse',
  'encule',
  'enculer',
  'bordel',
  'batard',
  'bâtard',

  // English
  'fuck',
  'fucking',
  'fucker',
  'shit',
  'shitty',
  'bitch',
  'asshole',
  'arsehole',
  'dick',
  'dumbass',
  'bastard',
  'motherfucker',
  'crap',

  // Spanish
  'mierda',
  'joder',
  'puta',
  'puto',
  'cabron',
  'cabrón',
  'gilipollas',
  'cojones',

  // German
  'scheisse',
  'scheiße',
  'arschloch',
  'fotze',
  'wichser',
  'hurensohn',
  'schlampe',

  // Portuguese
  'merda',
  'caralho',
  'porra',
  'puta',
  'puto',
  'filhodaputa',
  'viado',

  // Italian
  'cazzo',
  'merda',
  'stronzo',
  'stronza',
  'puttana',
  'bastardo',
  'vaffanculo',

  // Dutch
  'kut',
  'klootzak',
  'lul',
  'hoer',
  'tering',
  'godverdomme',

  // Polish
  'kurwa',
  'chuj',
  'cipa',
  'skurwysyn',
  'pierdol',
  'jebac',
  'jebać',

  // Turkish
  'siktir',
  'orospu',
  'piç',
  'sik',
  'yarrak',
  'amk',

  // Russian
  'блять',
  'блядь',
  'сука',
  'хуй',
  'пизда',
  'ебать',
  'еблан',

  // Ukrainian
  'бля',
  'блядь',
  'сука',
  'хуй',
  'пизда',
  'їбати',

  // Romanian
  'muie',
  'pula',
  'pizda',
  'futu',
  'futut',
  'curva',

  // Greek
  'μαλάκα',
  'μαλακα',
  'γαμώ',
  'γαμω',
  'πουτάνα',
  'πουτανα',

  // Swedish
  'fan',
  'jävla',
  'helvete',
  'hora',
  'fitta',

  // Norwegian
  'faen',
  'jævel',
  'helvete',
  'hore',
  'fitte',

  // Danish
  'fuck',
  'fanden',
  'helvede',
  'luder',
  'pik',

  // Finnish
  'perkele',
  'vittu',
  'saatana',
  'huora',

  // Czech
  'kurva',
  'kokot',
  'pica',
  'jebat',

  // Hungarian
  'kurva',
  'fasz',
  'geci',
  'picsa',

  // Hindi / Hinglish
  'madarchod',
  'bhenchod',
  'chutiya',
  'gandu',
  'harami',
  'kamina',

  // Indonesian
  'anjing',
  'bangsat',
  'kontol',
  'memek',
  'bajingan',

  // Filipino
  'putangina',
  'gago',
  'tarantado',
  'ulol',

  // Malay
  'sial',
  'pukimak',
  'bodoh',

  // Vietnamese
  'đụ',
  'địt',
  'đĩ',
  'cặc',

  // Korean
  '씨발',
  '시발',
  '개새끼',
  '병신',

  // Japanese
  'くそ',
  'クソ',
  'ばか',
  'バカ',

  // Arabic common profanity
  'كلب',
  'حمار',
  'خرا',
  'كس',
  'شرموطة'
]);

// ============================================================================
// TEXT HELPERS
// ============================================================================

function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[4@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsBadWord(content, config) {
  const normalized = normalizeText(content);
  const words = new Set(
    normalized
      .split(/\s+/)
      .filter(Boolean)
  );

  for (const word of BAD_WORDS) {
    const normalizedWord = normalizeText(word);

    if (words.has(normalizedWord)) {
      return normalizedWord;
    }
  }

  for (const word of config.customBadWords || []) {
    const normalizedWord = normalizeText(word);

    if (words.has(normalizedWord)) {
      return normalizedWord;
    }
  }

  return null;
}

function parseDuration(input) {
  if (typeof input !== 'string') return null;

  const clean = input
    .toLowerCase()
    .replace(/\s+/g, '');

  const regex = /(\d+)(s|m|h|d|w)/g;

  let match;
  let total = 0;
  let found = false;

  while ((match = regex.exec(clean)) !== null) {
    found = true;

    const amount = Number(match[1]);
    const unit = match[2];

    if (unit === 's') total += amount * 1000;
    if (unit === 'm') total += amount * 60 * 1000;
    if (unit === 'h') total += amount * 60 * 60 * 1000;
    if (unit === 'd') total += amount * 24 * 60 * 60 * 1000;
    if (unit === 'w') total += amount * 7 * 24 * 60 * 60 * 1000;
  }

  if (!found) return null;
  return total;
}

function mentionRole(roleId) {
  return roleId ? `<@&${roleId}>` : 'Aucun rôle configuré';
}

function truncate(text, max = 1000) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

// ============================================================================
// V2 BUILDERS
// ============================================================================

function buildV2Container({
  title,
  description,
  accent = 0x5865F2,
  footer = null,
  buttons = [],
  select = null
}) {
  const container = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${title}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(description)
    );

  if (select) {
    container.addActionRowComponents(select);
  }

  if (buttons.length > 0) {
    const row = new ActionRowBuilder().addComponents(...buttons);
    container.addActionRowComponents(row);
  }

  if (footer) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${footer}`)
      );
  }

  return container;
}

function v2Flags(ephemeral = false) {
  let flags = MessageFlags.IsComponentsV2;

  if (ephemeral) {
    flags |= MessageFlags.Ephemeral;
  }

  return flags;
}

async function replyV2(interaction, options) {
  return interaction.reply({
    flags: v2Flags(options.ephemeral),
    components: [
      buildV2Container(options)
    ]
  });
}

async function sendV2(channel, options) {
  return channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: [
      buildV2Container(options)
    ]
  });
}

async function editV2(message, options) {
  return message.edit({
    flags: MessageFlags.IsComponentsV2,
    components: [
      buildV2Container(options)
    ]
  });
}

// ============================================================================
// CHANNEL / ROLE RESOLUTION
// ============================================================================

async function resolveChannel(guild, configuredId, fallback = null) {
  if (configuredId) {
    const configured = guild.channels.cache.get(configuredId);

    if (configured && configured.isTextBased()) {
      return configured;
    }

    try {
      const fetched = await guild.channels.fetch(configuredId);

      if (fetched && fetched.isTextBased()) {
        return fetched;
      }
    } catch {}
  }

  return fallback;
}

async function resolveRole(guild, roleId) {
  if (!roleId) return null;

  const cached = guild.roles.cache.get(roleId);
  if (cached) return cached;

  try {
    return await guild.roles.fetch(roleId);
  } catch {
    return null;
  }
}

// ============================================================================
// PERMISSIONS / BYPASS
// ============================================================================

function isAdmin(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  );
}

function canManageServer(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function hasBypass(member, config, system) {
  if (!member || !member.roles?.cache) return false;

  const roleIds = config.bypass?.[system] || [];

  return roleIds.some((roleId) =>
    member.roles.cache.has(roleId)
  );
}

function canStaff(member, config) {
  if (!member) return false;

  if (
    member.permissions?.has(PermissionFlagsBits.Administrator) ||
    member.permissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  if (config.roles.staff && member.roles.cache.has(config.roles.staff)) {
    return true;
  }

  if (hasBypass(member, config, 'applications')) {
    return true;
  }

  return false;
}

// ============================================================================
// LOGGING
// ============================================================================

async function logEvent(guild, title, description, accent = 0x5865F2) {
  const config = getConfig(guild.id);

  if (!config.channels.logs) return;

  const channel = await resolveChannel(guild, config.channels.logs);

  if (!channel) return;

  try {
    await sendV2(channel, {
      title,
      description,
      accent,
      footer: `R.P FRANCE • ${new Date().toLocaleString('fr-FR')}`
    });
  } catch (error) {
    console.error('Log error:', error.message);
  }
}

// ============================================================================
// SANCTIONS
// ============================================================================

async function timeoutMember(member, seconds, reason) {
  if (!member?.moderatable) return false;

  try {
    const duration = Math.max(1, Math.min(seconds, 28 * 24 * 60 * 60));

    await member.timeout(
      duration * 1000,
      reason
    );

    return true;
  } catch {
    return false;
  }
}

async function dmSanction(member, reason) {
  try {
    await member.send({
      flags: MessageFlags.IsComponentsV2,
      components: [
        buildV2Container({
          title: 'Sanction automatique',
          description:
            `Ton message a été supprimé automatiquement.\n\n` +
            `**Raison :** ${reason}\n\n` +
            `Le système de sécurité de **R.P FRANCE** a appliqué cette sanction automatiquement.`,
          accent: 0xED4245,
          footer: 'R.P FRANCE • Modération automatique'
        })
      ]
    });
  } catch {}
}

// ============================================================================
// WELCOME
// ============================================================================

async function handleWelcome(member) {
  const guild = member.guild;
  const config = getConfig(guild.id);

  if (!config.systems.welcome) return;

  const configuredChannel = await resolveChannel(
    guild,
    config.channels.welcome
  );

  let channel = configuredChannel;

  if (!channel) {
    channel = guild.systemChannel;

    if (!channel || !channel.isTextBased()) {
      channel = guild.channels.cache
        .filter(
          c =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(guild.members.me)?.has(
              PermissionFlagsBits.SendMessages
            )
        )
        .first();
    }
  }

  if (channel) {
    try {
      await sendV2(channel, {
        title: config.text.welcomeTitle,
        description:
          `${member} vient de rejoindre le serveur.\n\n` +
          `${config.text.welcomeMessage}`,
        accent: config.accentColor,
        footer: `Membre : ${member.user.tag}`
      });
    } catch {}
  }

  try {
    await member.send({
      flags: MessageFlags.IsComponentsV2,
      components: [
        buildV2Container({
          title: 'Bienvenue sur R.P FRANCE',
          description: config.text.dmWelcome,
          accent: config.accentColor
        })
      ]
    });
  } catch {}
}

// ============================================================================
// RULES PANEL
// ============================================================================

function buildRulesText() {
  return [
    '# Règlement R.P FRANCE',
    '',
    '## Bonjour à tous',
    '',
    '### Respect Mutuel',
    '> Traitez tous les membres avec respect. Les insultes, les propos haineux et les discriminations ne seront pas tolérés.',
    '',
    '### Pas de Spam',
    '> Évitez de spammer des messages, des liens ou des images. Cela inclut les messages répétitifs et les publicités non autorisées.',
    '',
    '### Contenu Approprié',
    '> Partagez uniquement du contenu approprié. Les contenus NSFW, violents ou choquants sont strictement interdits.',
    '',
    '### Confidentialité',
    '> Ne partagez pas d’informations personnelles (les vôtres ou celles des autres) sans consentement. Respectez la vie privée de chacun.',
    '',
    '### Canaux',
    '> Utilisez les canaux pour leur objectif prévu. Lisez les descriptions pour savoir où poster vos messages.',
    '',
    '### Pas de Trolls',
    '> Évitez de provoquer les autres ou de créer des conflits inutiles. Les comportements de troll ne seront pas tolérés.',
    '',
    '### Suivre les Instructions des Modérateurs',
    '> Les modérateurs sont là pour maintenir un environnement agréable. Suivez leurs directives et respectez leurs décisions.',
    '',
    '### Sanctions',
    '> Tout manquement à ces règles pourra entraîner des avertissements, des expulsions temporaires ou permanentes, selon la gravité de l’infraction.',
    '',
    '**En cliquant sur le bouton ci-dessous, vous confirmez avoir lu et accepté le règlement.**'
  ].join('\n');
}

async function sendRulesPanel(channel) {
  const button = new ButtonBuilder()
    .setCustomId('rules:accept')
    .setLabel('J’accepte le règlement')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  return sendV2(channel, {
    title: 'Règlement R.P FRANCE',
    description: buildRulesText(),
    accent: 0x57F287,
    buttons: [button],
    footer: 'Merci de respecter les règles de R.P FRANCE.'
  });
}

// ============================================================================
// APPLICATION SYSTEM
// ============================================================================

function buildApplicationPanel() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('application:select')
    .setPlaceholder('Sélectionnez une option...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Candidature Staff')
        .setDescription('Commencer une candidature pour rejoindre le staff.')
        .setEmoji('📋')
        .setValue('staff')
    );

  return buildV2Container({
    title: 'Candidatures Staff',
    description:
      'Tu souhaites rejoindre le staff ?\n\n' +
      'Sélectionne **Candidature Staff** ci-dessous. Le bot te contactera en DM et te posera les questions une par une.',
    accent: 0x5865F2,
    select,
    footer: 'Les candidatures sont traitées par le staff.'
  });
}

async function startApplicationDM(user, guildId, originChannelId) {
  const config = getConfig(guildId);

  const existing = db.prepare(`
    SELECT *
    FROM applications
    WHERE guild_id = ?
      AND user_id = ?
      AND status = 'collecting'
    ORDER BY id DESC
    LIMIT 1
  `).get(guildId, user.id);

  if (existing) {
    try {
      await user.send({
        flags: MessageFlags.IsComponentsV2,
        components: [
          buildV2Container({
            title: 'Candidature déjà en cours',
            description:
              'Tu as déjà une candidature en cours. Termine celle-ci avant d’en commencer une nouvelle.',
            accent: 0xFEE75C
          })
        ]
      });
    } catch {}

    return;
  }

  const row = db.prepare(`
    INSERT INTO applications (
      guild_id,
      user_id,
      origin_channel_id,
      answers,
      question_index,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, 0, 'collecting', ?)
  `).run(
    guildId,
    user.id,
    originChannelId || null,
    JSON.stringify([]),
    Date.now()
  );

  const startButton = new ButtonBuilder()
    .setCustomId(`app:start:${guildId}:${row.lastInsertRowid}`)
    .setLabel('Commencer')
    .setEmoji('▶️')
    .setStyle(ButtonStyle.Primary);

  try {
    await user.send({
      flags: MessageFlags.IsComponentsV2,
      components: [
        buildV2Container({
          title: 'Candidature Staff',
          description:
            `Bienvenue dans le système de candidature de **R.P FRANCE**.\n\n` +
            `La candidature se fait directement en DM.\n` +
            `Le bot te posera plusieurs questions, une par une.\n\n` +
            `Clique sur **Commencer** lorsque tu es prêt.`,
          accent: config.accentColor,
          buttons: [startButton],
          footer: `Candidature #${row.lastInsertRowid}`
        })
      ]
    });
  } catch {
    db.prepare(`
      UPDATE applications
      SET status = 'cancelled'
      WHERE id = ?
    `).run(row.lastInsertRowid);

    throw new Error('DM fermés');
  }
}

async function askApplicationQuestion(application) {
  const config = getConfig(application.guild_id);
  const questions = config.applications.questions || [];

  if (!questions.length) return;

  const index = application.question_index;
  const question = questions[index];

  if (!question) return;

  const user = await client.users.fetch(application.user_id);

  await user.send({
    flags: MessageFlags.IsComponentsV2,
    components: [
      buildV2Container({
        title: `Question ${index + 1}/${questions.length}`,
        description:
          `${question}\n\n` +
          `Réponds simplement à ce message avec ta réponse.`,
        accent: config.accentColor,
        footer: 'Tape ta réponse directement dans ce DM.'
      })
    ]
  });
}

async function finalizeApplication(applicationId) {
  const application = db
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(applicationId);

  if (!application) return;

  const config = getConfig(application.guild_id);
  const guild = client.guilds.cache.get(application.guild_id);

  if (!guild) return;

  const configuredLog = await resolveChannel(
    guild,
    config.channels.applicationLogs
  );

  let logChannel = configuredLog;

  if (!logChannel && application.origin_channel_id) {
    logChannel = await resolveChannel(
      guild,
      application.origin_channel_id
    );
  }

  if (!logChannel) {
    logChannel = guild.systemChannel;
  }

  if (!logChannel) return;

  const answers = JSON.parse(application.answers || '[]');
  const questions = config.applications.questions || [];

  const body = answers
    .map(
      (answer, index) =>
        `**${index + 1}. ${truncate(questions[index] || 'Question', 150)}**\n${truncate(answer, 500)}`
    )
    .join('\n\n');

  const accept = new ButtonBuilder()
    .setCustomId(`app:decision:accept:${application.id}`)
    .setLabel('Accepter')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const refuse = new ButtonBuilder()
    .setCustomId(`app:decision:refuse:${application.id}`)
    .setLabel('Refuser')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Danger);

  const message = await sendV2(logChannel, {
    title: `Nouvelle candidature #${application.id}`,
    description:
      `**Candidat :** <@${application.user_id}>\n` +
      `**ID :** ${application.user_id}\n` +
      `**Date :** <t:${Math.floor(application.created_at / 1000)}:F>\n\n` +
      `${truncate(body, 3300)}`,
    accent: config.accentColor,
    buttons: [accept, refuse],
    footer: 'Utilisez les boutons pour traiter la candidature.'
  });

  db.prepare(`
    UPDATE applications
    SET status = 'pending',
        log_channel_id = ?,
        log_message_id = ?
    WHERE id = ?
  `).run(
    logChannel.id,
    message.id,
    application.id
  );

  try {
    const user = await client.users.fetch(application.user_id);

    await user.send({
      flags: MessageFlags.IsComponentsV2,
      components: [
        buildV2Container({
          title: 'Candidature envoyée',
          description:
            'Ta candidature a bien été envoyée au staff.\n\n' +
            'Tu recevras un message privé lorsque la décision aura été prise.',
          accent: config.accentColor
        })
      ]
    });
  } catch {}
}

// ============================================================================
// GIVEAWAYS
// ============================================================================

function buildGiveawayContainer(giveaway) {
  const participants = JSON.parse(giveaway.participants || '[]');
  const endTimestamp = Math.floor(giveaway.end_at / 1000);

  const joinButton = new ButtonBuilder()
    .setCustomId(`gw:join:${giveaway.id}`)
    .setLabel('Participer')
    .setEmoji('🎉')
    .setStyle(ButtonStyle.Primary);

  const leaveButton = new ButtonBuilder()
    .setCustomId(`gw:leave:${giveaway.id}`)
    .setLabel('Quitter')
    .setEmoji('🚪')
    .setStyle(ButtonStyle.Secondary);

  return buildV2Container({
    title: '🎉 GIVEAWAY',
    description:
      `## ${giveaway.prize}\n\n` +
      `**Gagnant(s) :** ${giveaway.winners}\n` +
      `**Participants :** ${participants.length}\n` +
      `**Fin :** <t:${endTimestamp}:F>\n` +
      `**Temps restant :** <t:${endTimestamp}:R>\n\n` +
      `**Rôle requis :** ${mentionRole(giveaway.role_id)}\n\n` +
      `Clique sur **Participer** pour rejoindre le giveaway.`,
    accent: 0xFEE75C,
    buttons: [joinButton, leaveButton],
    footer: `Giveaway #${giveaway.id}`
  });
}

async function updateGiveawayMessage(giveaway) {
  try {
    const channel = await client.channels.fetch(giveaway.channel_id);

    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(giveaway.message_id);

    await message.edit({
      flags: MessageFlags.IsComponentsV2,
      components: [buildGiveawayContainer(giveaway)]
    });
  } catch {}
}

async function finishGiveaway(giveawayId) {
  const giveaway = db.prepare(`
    SELECT *
    FROM giveaways
    WHERE id = ?
  `).get(giveawayId);

  if (!giveaway || giveaway.ended) return;

  const guild = client.guilds.cache.get(giveaway.guild_id);
  if (!guild) return;

  const participants = JSON.parse(giveaway.participants || '[]');

  const shuffled = [...participants];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i]
    ];
  }

  const winners = shuffled.slice(
    0,
    Math.min(giveaway.winners, shuffled.length)
  );

  db.prepare(`
    UPDATE giveaways
    SET ended = 1
    WHERE id = ?
  `).run(giveaway.id);

  const channel = await client.channels.fetch(giveaway.channel_id);

  if (!channel?.isTextBased()) return;

  const winnerText = winners.length
    ? winners.map(id => `<@${id}>`).join(', ')
    : 'Aucun gagnant';

  await sendV2(channel, {
    title: '🎉 Giveaway terminé',
    description:
      `## ${giveaway.prize}\n\n` +
      `**Gagnant(s) :** ${winnerText}\n` +
      `**Participants :** ${participants.length}`,
    accent: 0x57F287,
    footer: `Giveaway #${giveaway.id}`
  });

  try {
    const original = await channel.messages.fetch(giveaway.message_id);

    await original.edit({
      flags: MessageFlags.IsComponentsV2,
      components: [
        buildV2Container({
          title: '🎉 GIVEAWAY TERMINÉ',
          description:
            `## ${giveaway.prize}\n\n` +
            `**Gagnant(s) :** ${winnerText}\n` +
            `**Participants :** ${participants.length}`,
          accent: 0x57F287,
          footer: `Giveaway #${giveaway.id}`
        })
      ]
    });
  } catch {}
}

// ============================================================================
// TICKETS
// ============================================================================

function buildTicketPanel() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket:create')
    .setPlaceholder('Sélectionnez une option...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Ouvrir un ticket')
        .setDescription('Créer un ticket privé avec le support.')
        .setEmoji('🎫')
        .setValue('open')
    );

  return buildV2Container({
    title: 'Centre de tickets',
    description:
      'Tu as besoin d’aide ?\n\n' +
      'Sélectionne **Ouvrir un ticket** ci-dessous afin de créer un espace privé avec le support.',
    accent: 0x5865F2,
    select,
    footer: 'Un ticket inutile peut être fermé par le staff.'
  });
}

async function createTicket(interaction) {
  const guild = interaction.guild;
  const config = getConfig(guild.id);

  const existing = db.prepare(`
    SELECT *
    FROM tickets
    WHERE guild_id = ?
      AND user_id = ?
      AND closed_at IS NULL
    LIMIT 1
  `).get(guild.id, interaction.user.id);

  if (existing) {
    return interaction.reply({
      content: `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`,
      flags: MessageFlags.Ephemeral
    });
  }

  let parent = null;

  if (config.channels.ticketCategory) {
    const candidate = guild.channels.cache.get(
      config.channels.ticketCategory
    );

    if (candidate?.type === ChannelType.GuildCategory) {
      parent = candidate;
    }
  }

  const supportRole = await resolveRole(
    guild,
    config.roles.ticketSupport
  );

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    }
  ];

  if (supportRole) {
    permissionOverwrites.push({
      id: supportRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    });
  }

  const channel = await guild.channels.create({
    name: `${config.tickets.namePrefix}-${interaction.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 90),
    type: ChannelType.GuildText,
    parent: parent?.id || undefined,
    permissionOverwrites
  });

  db.prepare(`
    INSERT INTO tickets (
      guild_id,
      channel_id,
      user_id,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    guild.id,
    channel.id,
    interaction.user.id,
    Date.now()
  );

  const closeButton = new ButtonBuilder()
    .setCustomId('ticket:close')
    .setLabel('Fermer le ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  await sendV2(channel, {
    title: '🎫 Ticket ouvert',
    description:
      `${interaction.user} ton ticket est maintenant ouvert.\n\n` +
      `Décris clairement ta demande afin que le support puisse t’aider.\n\n` +
      `Lorsqu’il n’est plus nécessaire, utilise **Fermer le ticket**.`,
    accent: config.accentColor,
    buttons: [closeButton],
    footer: `Ticket de ${interaction.user.tag}`
  });

  await interaction.reply({
    content: `✅ ${config.text.ticketCreated} <#${channel.id}>`,
    flags: MessageFlags.Ephemeral
  });
}

// ============================================================================
// SUGGESTIONS
// ============================================================================

function buildSuggestionPanel() {
  const button = new ButtonBuilder()
    .setCustomId('suggestion:create')
    .setLabel('Créer une suggestion')
    .setEmoji('💡')
    .setStyle(ButtonStyle.Primary);

  return buildV2Container({
    title: 'Boîte à suggestions',
    description:
      'Une idée pour améliorer le serveur ?\n\n' +
      'Clique sur **Créer une suggestion** puis explique clairement ton idée.',
    accent: 0xFEE75C,
    buttons: [button],
    footer: 'Les suggestions sont soumises aux votes de la communauté.'
  });
}

function buildSuggestionContainer(suggestion) {
  const upvotes = JSON.parse(suggestion.upvotes || '[]');
  const downvotes = JSON.parse(suggestion.downvotes || '[]');

  const up = new ButtonBuilder()
    .setCustomId(`suggestion:up:${suggestion.id}`)
    .setLabel(`Pour ${upvotes.length}`)
    .setEmoji('👍')
    .setStyle(ButtonStyle.Success);

  const down = new ButtonBuilder()
    .setCustomId(`suggestion:down:${suggestion.id}`)
    .setLabel(`Contre ${downvotes.length}`)
    .setEmoji('👎')
    .setStyle(ButtonStyle.Danger);

  return buildV2Container({
    title: `💡 Suggestion #${suggestion.id}`,
    description:
      `**Auteur :** <@${suggestion.user_id}>\n` +
      `**Statut :** ${suggestion.status === 'pending' ? '🕐 En attente' : suggestion.status}\n\n` +
      `${truncate(suggestion.content, 3000)}\n\n` +
      `Utilise les boutons pour voter.`,
    accent: 0xFEE75C,
    buttons: [up, down],
    footer: `Pour : ${upvotes.length} • Contre : ${downvotes.length}`
  });
}

async function updateSuggestionMessage(suggestion) {
  try {
    const channel = await client.channels.fetch(suggestion.channel_id);

    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(
      suggestion.message_id
    );

    await message.edit({
      flags: MessageFlags.IsComponentsV2,
      components: [
        buildSuggestionContainer(suggestion)
      ]
    });
  } catch {}
}

// ============================================================================
// SESSION RP
// ============================================================================

function buildSessionOpenContainer(serverCode, config) {
  const shutdownButton = new ButtonBuilder()
    .setCustomId('session:shutdown')
    .setLabel('Fermer la session')
    .setEmoji('🔴')
    .setStyle(ButtonStyle.Danger);

  return buildV2Container({
    title: '🟢 SESSION RP OUVERTE',
    description:
      `Le serveur RP est actuellement **OUVERT**.\n\n` +
      `**Code serveur :** \`${serverCode}\`\n\n` +
      `**État :** 🟢 En ligne\n\n` +
      `Rejoignez le serveur avec le code indiqué ci-dessus.`,
    accent: 0x57F287,
    buttons: [shutdownButton],
    footer: `Session ouverte le ${new Date().toLocaleString('fr-FR')}`
  });
}

function buildSessionClosedContainer(config) {
  return buildV2Container({
    title: '🔴 SESSION RP FERMÉE',
    description:
      `${config.text.sessionClosed}\n\n` +
      `Le serveur RP n'est actuellement plus disponible.`,
    accent: 0xED4245
  });
}

async function clearChannel(channel) {
  let totalDeleted = 0;
  const maxMessages = 20000;

  while (totalDeleted < maxMessages) {
    const messages = await channel.messages.fetch({
      limit: 100
    });

    if (!messages.size) break;

    const recent = messages.filter(
      m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
    );

    const old = messages.filter(
      m => Date.now() - m.createdTimestamp >= 14 * 24 * 60 * 60 * 1000
    );

    if (recent.size) {
      try {
        await channel.bulkDelete(recent, true);
      } catch {
        for (const message of recent.values()) {
          try {
            await message.delete();
          } catch {}
        }
      }

      totalDeleted += recent.size;
    }

    if (old.size) {
      for (const message of old.values()) {
        try {
          await message.delete();
          totalDeleted++;
        } catch {}
      }
    }

    if (messages.size < 100) break;
  }

  return totalDeleted;
}

// ============================================================================
// SLASH COMMANDS
// ============================================================================

const configChannelKeys = [
  ['welcome', 'Salon de bienvenue'],
  ['rules', 'Salon du règlement'],
  ['applicationLogs', 'Salon des candidatures'],
  ['ticketCategory', 'Catégorie des tickets'],
  ['suggestions', 'Salon des suggestions'],
  ['sessions', 'Salon des sessions RP'],
  ['logs', 'Salon des logs']
];

const configRoleKeys = [
  ['verified', 'Rôle obtenu après acceptation du règlement'],
  ['staff', 'Rôle principal du staff'],
  ['ticketSupport', 'Rôle pouvant voir les tickets']
];

const configNumberKeys = [
  ['security.antiRaidJoinThreshold', 'Seuil anti-raid'],
  ['security.antiRaidWindowSeconds', 'Fenêtre anti-raid'],
  ['security.antiRaidTimeoutSeconds', 'Timeout anti-raid'],
  ['security.antiSpamCount', 'Messages avant anti-spam'],
  ['security.antiSpamWindowSeconds', 'Fenêtre anti-spam'],
  ['security.antiSpamTimeoutSeconds', 'Timeout anti-spam'],
  ['security.massMentionThreshold', 'Seuil mass mention'],
  ['security.massMentionTimeoutSeconds', 'Timeout mass mention'],
  ['security.massDeleteThreshold', 'Seuil suppression massive'],
  ['security.massDeleteTimeoutSeconds', 'Timeout suppression massive'],
  ['security.badWordTimeoutSeconds', 'Timeout mots interdits']
];

const configToggleKeys = [
  'welcome',
  'rules',
  'applications',
  'giveaways',
  'security',
  'tickets',
  'sessions',
  'suggestions',
  'security.antiRaid',
  'security.antiSpam',
  'security.antiMassMention',
  'security.antiMassDelete',
  'security.badWords'
];

const commands = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurer le bot R.P FRANCE')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Afficher la configuration actuelle')
    )
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Configurer un salon')
        .addStringOption(option =>
          option
            .setName('key')
            .setDescription('Élément à configurer')
            .setRequired(true)
            .addChoices(
              ...configChannelKeys.map(([value, name]) => ({
                name,
                value
              }))
            )
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Salon choisi')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('role')
        .setDescription('Configurer un rôle')
        .addStringOption(option =>
          option
            .setName('key')
            .setDescription('Élément à configurer')
            .setRequired(true)
            .addChoices(
              ...configRoleKeys.map(([value, name]) => ({
                name,
                value
              }))
            )
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Rôle choisi')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('number')
        .setDescription('Configurer une valeur numérique')
        .addStringOption(option =>
          option
            .setName('key')
            .setDescription('Paramètre')
            .setRequired(true)
            .addChoices(
              ...configNumberKeys.map(([value, name]) => ({
                name,
                value
              }))
            )
        )
        .addIntegerOption(option =>
          option
            .setName('value')
            .setDescription('Valeur')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Activer ou désactiver une fonction')
        .addStringOption(option =>
          option
            .setName('system')
            .setDescription('Système')
            .setRequired(true)
            .addChoices(
              ...configToggleKeys.map(key => ({
                name: key,
                value: key
              }))
            )
        )
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Activé ?')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('bypass-add')
        .setDescription('Ajouter un rôle bypass')
        .addStringOption(option =>
          option
            .setName('system')
            .setDescription('Système concerné')
            .setRequired(true)
            .addChoices(
              { name: 'Mots interdits', value: 'badWords' },
              { name: 'Anti-spam', value: 'antiSpam' },
              { name: 'Anti-mass mention', value: 'antiMassMention' },
              { name: 'Suppression massive', value: 'antiMassDelete' },
              { name: 'Anti-raid', value: 'antiRaid' },
              { name: 'Tickets', value: 'tickets' },
              { name: 'Candidatures', value: 'applications' },
              { name: 'Giveaways', value: 'giveaways' },
              { name: 'Sessions', value: 'sessions' }
            )
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Rôle autorisé')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('bypass-remove')
        .setDescription('Retirer un rôle bypass')
        .addStringOption(option =>
          option
            .setName('system')
            .setDescription('Système concerné')
            .setRequired(true)
            .addChoices(
              { name: 'Mots interdits', value: 'badWords' },
              { name: 'Anti-spam', value: 'antiSpam' },
              { name: 'Anti-mass mention', value: 'antiMassMention' },
              { name: 'Suppression massive', value: 'antiMassDelete' },
              { name: 'Anti-raid', value: 'antiRaid' },
              { name: 'Tickets', value: 'tickets' },
              { name: 'Candidatures', value: 'applications' },
              { name: 'Giveaways', value: 'giveaways' },
              { name: 'Sessions', value: 'sessions' }
            )
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Rôle à retirer')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('question-add')
        .setDescription('Ajouter une question de candidature')
        .addStringOption(option =>
          option
            .setName('question')
            .setDescription('Question')
            .setRequired(true)
            .setMaxLength(1000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('question-remove')
        .setDescription('Supprimer une question')
        .addIntegerOption(option =>
          option
            .setName('index')
            .setDescription('Numéro de la question')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('question-list')
        .setDescription('Afficher les questions')
    )
    .addSubcommand(sub =>
      sub
        .setName('badword-add')
        .setDescription('Ajouter un mot interdit')
        .addStringOption(option =>
          option
            .setName('word')
            .setDescription('Mot')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('badword-remove')
        .setDescription('Retirer un mot interdit personnalisé')
        .addStringOption(option =>
          option
            .setName('word')
            .setDescription('Mot')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Envoyer un panneau')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Panneau à envoyer')
        .setRequired(true)
        .addChoices(
          { name: 'Règlement', value: 'rules' },
          { name: 'Candidatures Staff', value: 'applications' },
          { name: 'Tickets', value: 'tickets' },
          { name: 'Suggestions', value: 'suggestions' }
        )
    ),

  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Gestion des giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Créer un giveaway')
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('Ex: 30m, 2h, 1d')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('prize')
            .setDescription('Récompense')
            .setRequired(true)
            .setMaxLength(300)
        )
        .addIntegerOption(option =>
          option
            .setName('winners')
            .setDescription('Nombre de gagnants')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Rôle requis pour participer')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('Terminer immédiatement un giveaway')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID du giveaway')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Relancer les gagnants')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID du giveaway')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Gestion des sessions RP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('open')
        .setDescription('Ouvrir une session RP')
        .addStringOption(option =>
          option
            .setName('server-code')
            .setDescription('Code du serveur')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('shutdown')
        .setDescription('Fermer la session RP')
    )
];

// ============================================================================
// REGISTER COMMANDS
// ============================================================================

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const body = commands.map(command => command.toJSON());

  if (GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body }
    );

    console.log(`✅ Commandes enregistrées sur le serveur ${GUILD_ID}`);
  } else {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body }
    );

    console.log('✅ Commandes enregistrées globalement');
  }
}

// ============================================================================
// READY
// ============================================================================

client.once(Events.ClientReady, async ready => {
  console.log('');
  console.log('══════════════════════════════════════');
  console.log(`✅ ${ready.user.tag} est connecté.`);
  console.log(`🏠 Serveurs : ${ready.guilds.cache.size}`);
  console.log('🧠 Base SQLite : active');
  console.log('🛡️ Sécurité : active');
  console.log('🧩 Components V2 : active');
  console.log('🇫🇷 Mode français : actif');
  console.log('══════════════════════════════════════');
  console.log('');

  await registerCommands();

  setInterval(processGiveaways, 5000);
});

// ============================================================================
// GIVEAWAY PROCESSOR
// ============================================================================

async function processGiveaways() {
  const giveaways = db.prepare(`
    SELECT *
    FROM giveaways
    WHERE ended = 0
      AND end_at <= ?
  `).all(Date.now());

  for (const giveaway of giveaways) {
    await finishGiveaway(giveaway.id);
  }
}

// ============================================================================
// MEMBER JOIN — WELCOME + ANTI RAID
// ============================================================================

client.on(Events.GuildMemberAdd, async member => {
  await handleWelcome(member);

  const guild = member.guild;
  const config = getConfig(guild.id);

  if (
    !config.systems.security ||
    !config.security.enabled ||
    !config.security.antiRaid
  ) {
    return;
  }

  const key = guild.id;
  const now = Date.now();

  if (!joinTracker.has(key)) {
    joinTracker.set(key, []);
  }

  const joins = joinTracker.get(key);

  joins.push(now);

  const windowMs =
    config.security.antiRaidWindowSeconds * 1000;

  while (
    joins.length &&
    now - joins[0] > windowMs
  ) {
    joins.shift();
  }

  if (
    joins.length >= config.security.antiRaidJoinThreshold
  ) {
    if (!hasBypass(member, config, 'antiRaid')) {
      await timeoutMember(
        member,
        config.security.antiRaidTimeoutSeconds,
        'Anti-raid automatique'
      );
    }

    await logEvent(
      guild,
      '🚨 Détection Anti-Raid',
      `${member} a rejoint pendant une activité de raid détectée.\n\n` +
      `**Entrées récentes :** ${joins.length}\n` +
      `**Fenêtre :** ${config.security.antiRaidWindowSeconds}s`,
      0xED4245
    );
  }
});

// ============================================================================
// MESSAGE SECURITY
// ============================================================================

client.on(Events.MessageCreate, async message => {
  if (!message.guild) {
    await handleApplicationDM(message);
    return;
  }

  if (message.author.bot) return;

  const guild = message.guild;
  const member = message.member;
  const config = getConfig(guild.id);

  if (!config.systems.security || !config.security.enabled) {
    return;
  }

  // --------------------------------------------------------------------------
  // BAD WORDS
  // --------------------------------------------------------------------------

  if (
    config.security.badWords &&
    !hasBypass(member, config, 'badWords')
  ) {
    const badWord = containsBadWord(
      message.content,
      config
    );

    if (badWord) {
      try {
        await message.delete();
      } catch {}

      await timeoutMember(
        member,
        config.security.badWordTimeoutSeconds,
        `Mot interdit détecté : ${badWord}`
      );

      await dmSanction(
        member,
        `Utilisation d'un mot interdit (${badWord}).`
      );

      await logEvent(
        guild,
        '🚫 Mot interdit détecté',
        `${member} a envoyé un message contenant un mot interdit.\n\n` +
        `**Mot détecté :** ||${badWord}||`,
        0xED4245
      );

      return;
    }
  }

  // --------------------------------------------------------------------------
  // MASS MENTION
  // --------------------------------------------------------------------------

  if (
    config.security.antiMassMention &&
    !hasBypass(member, config, 'antiMassMention')
  ) {
    let mentionCount =
      message.mentions.users.size +
      message.mentions.roles.size;

    if (message.mentions.everyone) {
      mentionCount = Math.max(
        mentionCount,
        config.security.massMentionThreshold
      );
    }

    if (
      mentionCount >= config.security.massMentionThreshold
    ) {
      try {
        await message.delete();
      } catch {}

      await timeoutMember(
        member,
        config.security.massMentionTimeoutSeconds,
        'Mass mention automatique'
      );

      await dmSanction(
        member,
        'Utilisation excessive des mentions.'
      );

      await logEvent(
        guild,
        '📢 Mass Mention bloqué',
        `${member} a déclenché la protection contre les mentions massives.\n\n` +
        `**Mentions détectées :** ${mentionCount}`,
        0xED4245
      );

      return;
    }
  }

  // --------------------------------------------------------------------------
  // ANTI SPAM
  // --------------------------------------------------------------------------

  if (
    config.security.antiSpam &&
    !hasBypass(member, config, 'antiSpam')
  ) {
    const key = `${guild.id}:${message.author.id}`;

    if (!spamTracker.has(key)) {
      spamTracker.set(key, []);
    }

    const timestamps = spamTracker.get(key);
    const now = Date.now();

    timestamps.push(now);

    const windowMs =
      config.security.antiSpamWindowSeconds * 1000;

    while (
      timestamps.length &&
      now - timestamps[0] > windowMs
    ) {
      timestamps.shift();
    }

    if (
      timestamps.length >= config.security.antiSpamCount
    ) {
      try {
        await message.delete();
      } catch {}

      await timeoutMember(
        member,
        config.security.antiSpamTimeoutSeconds,
        'Anti-spam automatique'
      );

      timestamps.length = 0;

      await dmSanction(
        member,
        'Spam de messages détecté automatiquement.'
      );

      await logEvent(
        guild,
        '🛑 Anti-Spam déclenché',
        `${member} a été sanctionné pour spam.\n\n` +
        `**Limite :** ${config.security.antiSpamCount} messages / ${config.security.antiSpamWindowSeconds}s`,
        0xED4245
      );
    }
  }
});

// ============================================================================
// DM APPLICATION FLOW
// ============================================================================

async function handleApplicationDM(message) {
  if (message.author.bot) return;

  const application = db.prepare(`
    SELECT *
    FROM applications
    WHERE user_id = ?
      AND status = 'collecting'
    ORDER BY id DESC
    LIMIT 1
  `).get(message.author.id);

  if (!application) return;

  const config = getConfig(application.guild_id);
  const questions = config.applications.questions || [];

  if (!questions.length) return;

  const maxLength = 1000;

  if (message.content.length > maxLength) {
    try {
      await message.author.send({
        flags: MessageFlags.IsComponentsV2,
        components: [
          buildV2Container({
            title: 'Réponse trop longue',
            description:
              `Ta réponse dépasse la limite de ${maxLength} caractères.\n\n` +
              `Envoie une réponse plus courte.`,
            accent: 0xED4245
          })
        ]
      });
    } catch {}

    return;
  }

  const answers = JSON.parse(application.answers || '[]');

  answers.push(message.content);

  const nextIndex = application.question_index + 1;

  if (nextIndex >= questions.length) {
    db.prepare(`
      UPDATE applications
      SET answers = ?,
          question_index = ?,
          status = 'pending'
      WHERE id = ?
    `).run(
      JSON.stringify(answers),
      nextIndex,
      application.id
    );

    try {
      await message.author.send({
        flags: MessageFlags.IsComponentsV2,
        components: [
          buildV2Container({
            title: 'Candidature terminée',
            description:
              'Merci ! Tu as répondu à toutes les questions.\n\n' +
              'Ta candidature est maintenant envoyée au staff.',
            accent: 0x57F287
          })
        ]
      });
    } catch {}

    const updated = db.prepare(`
      SELECT *
      FROM applications
      WHERE id = ?
    `).get(application.id);

    await finalizeApplication(updated);
    return;
  }

  db.prepare(`
    UPDATE applications
    SET answers = ?,
        question_index = ?
    WHERE id = ?
  `).run(
    JSON.stringify(answers),
    nextIndex,
    application.id
  );

  const updated = db.prepare(`
    SELECT *
    FROM applications
    WHERE id = ?
  `).get(application.id);

  await askApplicationQuestion(updated);
}

// ============================================================================
// AUDIT LOG — MASS DELETE
// ============================================================================

client.on(
  Events.GuildAuditLogEntryCreate,
  async (entry, guild) => {
    const config = getConfig(guild.id);

    if (
      !config.systems.security ||
      !config.security.enabled ||
      !config.security.antiMassDelete
    ) {
      return;
    }

    if (
      entry.action !== AuditLogEvent.MessageBulkDelete
    ) {
      return;
    }

    const count = Number(
      entry.extra?.count || 0
    );

    if (
      count < config.security.massDeleteThreshold
    ) {
      return;
    }

    const executorId = entry.executorId;
    if (!executorId) return;

    const member = await guild.members
      .fetch(executorId)
      .catch(() => null);

    if (!member) return;

    if (
      member.permissions.has(
        PermissionFlagsBits.Administrator
      )
    ) {
      return;
    }

    if (hasBypass(member, config, 'antiMassDelete')) {
      return;
    }

    await timeoutMember(
      member,
      config.security.massDeleteTimeoutSeconds,
      'Suppression massive détectée'
    );

    try {
      await member.send(
        `⚠️ Une suppression massive de messages a été détectée. ` +
        `Une sanction automatique a été appliquée sur **${guild.name}**.`
      );
    } catch {}

    await logEvent(
      guild,
      '🧹 Suppression massive détectée',
      `${member} a supprimé massivement des messages.\n\n` +
      `**Nombre détecté :** ${count}`,
      0xED4245
    );
  }
);

// ============================================================================
// INTERACTIONS
// ============================================================================

client.on(Events.InteractionCreate, async interaction => {
  try {
    // ========================================================================
    // SLASH COMMANDS
    // ========================================================================

    if (interaction.isChatInputCommand()) {
      // ----------------------------------------------------------------------
      // CONFIG
      // ----------------------------------------------------------------------

      if (interaction.commandName === 'config') {
        if (!canManageServer(interaction)) {
          return interaction.reply({
            content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
            flags: MessageFlags.Ephemeral
          });
        }

        const subcommand = interaction.options.getSubcommand();
        const config = getConfig(interaction.guild.id);

        if (subcommand === 'view') {
          const lines = [
            `**Accent :** #${config.accentColor.toString(16).padStart(6, '0')}`,
            '',
            '**SALONS**',
            `Bienvenue : ${config.channels.welcome ? `<#${config.channels.welcome}>` : 'Non configuré'}`,
            `Règlement : ${config.channels.rules ? `<#${config.channels.rules}>` : 'Non configuré'}`,
            `Candidatures : ${config.channels.applicationLogs ? `<#${config.channels.applicationLogs}>` : 'Non configuré'}`,
            `Tickets : ${config.channels.ticketCategory ? `<#${config.channels.ticketCategory}>` : 'Non configuré'}`,
            `Suggestions : ${config.channels.suggestions ? `<#${config.channels.suggestions}>` : 'Non configuré'}`,
            `Sessions : ${config.channels.sessions ? `<#${config.channels.sessions}>` : 'Non configuré'}`,
            `Logs : ${config.channels.logs ? `<#${config.channels.logs}>` : 'Non configuré'}`,
            '',
            '**RÔLES**',
            `Vérifié : ${mentionRole(config.roles.verified)}`,
            `Staff : ${mentionRole(config.roles.staff)}`,
            `Support Tickets : ${mentionRole(config.roles.ticketSupport)}`,
            '',
            '**SÉCURITÉ**',
            `Anti-raid : ${config.security.antiRaid ? '🟢' : '🔴'}`,
            `Anti-spam : ${config.security.antiSpam ? '🟢' : '🔴'}`,
            `Mass mentions : ${config.security.antiMassMention ? '🟢' : '🔴'}`,
            `Mass delete : ${config.security.antiMassDelete ? '🟢' : '🔴'}`,
            `Mots interdits : ${config.security.badWords ? '🟢' : '🔴'}`,
            '',
            `**Questions candidature :** ${config.applications.questions.length}`,
            `**Mots personnalisés :** ${config.customBadWords.length}`
          ];

          return replyV2(interaction, {
            title: 'Configuration R.P FRANCE',
            description: lines.join('\n'),
            accent: config.accentColor,
            footer: 'Utilise /config pour modifier les paramètres.'
          });
        }

        if (subcommand === 'channel') {
          const key = interaction.options.getString('key');
          const channel = interaction.options.getChannel('channel');

          config.channels[key] = channel.id;
          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content: `✅ Le paramètre \`${key}\` utilise maintenant ${channel}.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'role') {
          const key = interaction.options.getString('key');
          const role = interaction.options.getRole('role');

          config.roles[key] = role.id;
          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content: `✅ Le rôle \`${key}\` est maintenant ${role}.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'number') {
          const key = interaction.options.getString('key');
          const value = interaction.options.getInteger('value');

          setNestedValue(config, key, value);
          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content: `✅ \`${key}\` = \`${value}\`.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'toggle') {
          const key = interaction.options.getString('system');
          const enabled = interaction.options.getBoolean('enabled');

          setNestedValue(config, `systems.${key}`, enabled);

          if (key.startsWith('security.')) {
            setNestedValue(
              config,
              key,
              enabled
            );
          }

          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content:
              `✅ \`${key}\` est maintenant **${enabled ? 'activé' : 'désactivé'}**.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (
          subcommand === 'bypass-add' ||
          subcommand === 'bypass-remove'
        ) {
          const system =
            interaction.options.getString('system');

          const role =
            interaction.options.getRole('role');

          if (!config.bypass[system]) {
            config.bypass[system] = [];
          }

          const roles = config.bypass[system];

          if (subcommand === 'bypass-add') {
            if (!roles.includes(role.id)) {
              roles.push(role.id);
            }

            saveConfig(interaction.guild.id, config);

            return interaction.reply({
              content:
                `✅ ${role} peut maintenant bypass **${system}**.`,
              flags: MessageFlags.Ephemeral
            });
          }

          config.bypass[system] =
            roles.filter(id => id !== role.id);

          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content:
              `✅ ${role} ne peut plus bypass **${system}**.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'question-add') {
          const question =
            interaction.options.getString('question');

          config.applications.questions.push(
            question
          );

          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content:
              `✅ Question #${config.applications.questions.length} ajoutée.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'question-remove') {
          const index =
            interaction.options.getInteger('index') - 1;

          if (!config.applications.questions[index]) {
            return interaction.reply({
              content:
                '❌ Cette question n’existe pas.',
              flags: MessageFlags.Ephemeral
            });
          }

          const removed =
            config.applications.questions.splice(
              index,
              1
            );

          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content:
              `✅ Question supprimée : ${removed[0]}`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'question-list') {
          const list =
            config.applications.questions
              .map(
                (q, i) =>
                  `**${i + 1}.** ${q}`
              )
              .join('\n');

          return replyV2(interaction, {
            title: 'Questions de candidature',
            description:
              list ||
              'Aucune question configurée.',
            accent: config.accentColor
          });
        }

        if (subcommand === 'badword-add') {
          const word =
            interaction.options.getString('word')
              .toLowerCase()
              .trim();

          if (
            !config.customBadWords.includes(word)
          ) {
            config.customBadWords.push(word);
          }

          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content:
              `✅ \`${word}\` a été ajouté à la liste personnalisée.`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'badword-remove') {
          const word =
            interaction.options.getString('word')
              .toLowerCase()
              .trim();

          config.customBadWords =
            config.customBadWords.filter(
              w => w !== word
            );

          saveConfig(interaction.guild.id, config);

          return interaction.reply({
            content:
              `✅ \`${word}\` a été retiré de la liste personnalisée.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // ----------------------------------------------------------------------
      // PANELS
      // ----------------------------------------------------------------------

      if (interaction.commandName === 'panel') {
        const type =
          interaction.options.getString('type');

        const config =
          getConfig(interaction.guild.id);

        if (
          type === 'rules'
        ) {
          if (!config.systems.rules) {
            return interaction.reply({
              content: '❌ Le système de règlement est désactivé.',
              flags: MessageFlags.Ephemeral
            });
          }

          await sendRulesPanel(
            interaction.channel
          );

          return interaction.reply({
            content: '✅ Panneau du règlement envoyé.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (
          type === 'applications'
        ) {
          if (!config.systems.applications) {
            return interaction.reply({
              content:
                '❌ Le système de candidatures est désactivé.',
              flags: MessageFlags.Ephemeral
            });
          }

          await interaction.channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
              buildApplicationPanel()
            ]
          });

          return interaction.reply({
            content:
              '✅ Panneau des candidatures envoyé.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (
          type === 'tickets'
        ) {
          if (!config.systems.tickets) {
            return interaction.reply({
              content:
                '❌ Le système de tickets est désactivé.',
              flags: MessageFlags.Ephemeral
            });
          }

          await interaction.channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
              buildTicketPanel()
            ]
          });

          return interaction.reply({
            content:
              '✅ Panneau des tickets envoyé.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (
          type === 'suggestions'
        ) {
          if (!config.systems.suggestions) {
            return interaction.reply({
              content:
                '❌ Le système de suggestions est désactivé.',
              flags: MessageFlags.Ephemeral
            });
          }

          await interaction.channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
              buildSuggestionPanel()
            ]
          });

          return interaction.reply({
            content:
              '✅ Panneau des suggestions envoyé.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // ----------------------------------------------------------------------
      // GIVEAWAY
      // ----------------------------------------------------------------------

      if (interaction.commandName === 'giveaway') {
        const subcommand =
          interaction.options.getSubcommand();

        const config =
          getConfig(interaction.guild.id);

        if (!config.systems.giveaways) {
          return interaction.reply({
            content:
              '❌ Le système de giveaways est désactivé.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'create') {
          const duration =
            interaction.options.getString('duration');

          const prize =
            interaction.options.getString('prize');

          const winners =
            interaction.options.getInteger('winners');

          const role =
            interaction.options.getRole('role');

          const durationMs =
            parseDuration(duration);

          if (!durationMs || durationMs < 10000) {
            return interaction.reply({
              content:
                '❌ Durée invalide. Exemple : `30m`, `2h`, `1d`.',
              flags: MessageFlags.Ephemeral
            });
          }

          const endAt =
            Date.now() + durationMs;

          const placeholder = {
            prize,
            winners,
            role_id: role?.id || null,
            participants: JSON.stringify([]),
            end_at: endAt
          };

          const result = db.prepare(`
            INSERT INTO giveaways (
              guild_id,
              channel_id,
              message_id,
              prize,
              winners,
              role_id,
              end_at,
              participants,
              ended
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          `).run(
            interaction.guild.id,
            interaction.channel.id,
            'pending',
            prize,
            winners,
            role?.id || null,
            endAt,
            placeholder.participants
          );

          const giveaway = db.prepare(`
            SELECT *
            FROM giveaways
            WHERE id = ?
          `).get(result.lastInsertRowid);

          const message =
            await interaction.channel.send({
              flags: MessageFlags.IsComponentsV2,
              components: [
                buildGiveawayContainer(giveaway)
              ]
            });

          db.prepare(`
            UPDATE giveaways
            SET message_id = ?
            WHERE id = ?
          `).run(
            message.id,
            giveaway.id
          );

          await interaction.reply({
            content:
              `✅ Giveaway #${giveaway.id} créé.`,
            flags: MessageFlags.Ephemeral
          });

          await logEvent(
            interaction.guild,
            '🎉 Giveaway créé',
            `${interaction.user} a créé le giveaway **#${giveaway.id}**.\n\n` +
            `**Récompense :** ${prize}`,
            0xFEE75C
          );

          return;
        }

        if (subcommand === 'end') {
          const id =
            interaction.options.getInteger('id');

          const giveaway = db.prepare(`
            SELECT *
            FROM giveaways
            WHERE id = ?
              AND guild_id = ?
          `).get(
            id,
            interaction.guild.id
          );

          if (!giveaway) {
            return interaction.reply({
              content:
                '❌ Giveaway introuvable.',
              flags: MessageFlags.Ephemeral
            });
          }

          if (giveaway.ended) {
            return interaction.reply({
              content:
                '❌ Ce giveaway est déjà terminé.',
              flags: MessageFlags.Ephemeral
            });
          }

          db.prepare(`
            UPDATE giveaways
            SET end_at = ?
            WHERE id = ?
          `).run(
            Date.now(),
            id
          );

          await finishGiveaway(id);

          return interaction.reply({
            content:
              '✅ Giveaway terminé.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'reroll') {
          const id =
            interaction.options.getInteger('id');

          const giveaway = db.prepare(`
            SELECT *
            FROM giveaways
            WHERE id = ?
              AND guild_id = ?
          `).get(
            id,
            interaction.guild.id
          );

          if (!giveaway) {
            return interaction.reply({
              content:
                '❌ Giveaway introuvable.',
              flags: MessageFlags.Ephemeral
            });
          }

          const participants =
            JSON.parse(
              giveaway.participants || '[]'
            );

          if (!participants.length) {
            return interaction.reply({
              content:
                '❌ Aucun participant.',
              flags: MessageFlags.Ephemeral
            });
          }

          const random =
            participants[
              Math.floor(
                Math.random() * participants.length
              )
            ];

          await sendV2(
            interaction.channel,
            {
              title: '🔄 Reroll',
              description:
                `Nouveau gagnant du giveaway #${id} : <@${random}>`,
              accent: 0x5865F2
            }
          );

          return interaction.reply({
            content:
              `✅ Reroll effectué : <@${random}>`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // ----------------------------------------------------------------------
      // SESSION
      // ----------------------------------------------------------------------

      if (interaction.commandName === 'session') {
        const subcommand =
          interaction.options.getSubcommand();

        const config =
          getConfig(interaction.guild.id);

        if (!config.systems.sessions) {
          return interaction.reply({
            content:
              '❌ Le système de sessions est désactivé.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (subcommand === 'open') {
          const serverCode =
            interaction.options.getString('server-code');

          const existing = db.prepare(`
            SELECT *
            FROM sessions
            WHERE guild_id = ?
              AND active = 1
          `).get(interaction.guild.id);

          if (existing) {
            return interaction.reply({
              content:
                `❌ Une session est déjà ouverte dans <#${existing.channel_id}>.`,
              flags: MessageFlags.Ephemeral
            });
          }

          const sessionChannel =
            await resolveChannel(
              interaction.guild,
              config.channels.sessions,
              interaction.channel
            );

          const pingEveryone =
            config.sessions.pingEveryoneOnOpen;

          if (pingEveryone) {
            /*
             * Components V2 ne permet pas content + message V2.
             * Le ping est donc envoyé juste avant le panneau V2.
             */
            await sessionChannel.send({
              content: '@everyone',
              allowedMentions: {
                parse: ['everyone']
              }
            });
          }

          const sessionMessage =
            await sessionChannel.send({
              flags: MessageFlags.IsComponentsV2,
              components: [
                buildSessionOpenContainer(
                  serverCode,
                  config
                )
              ]
            });

          db.prepare(`
            INSERT INTO sessions (
              guild_id,
              channel_id,
              server_code,
              opened_at,
              active
            )
            VALUES (?, ?, ?, ?, 1)
          `).run(
            interaction.guild.id,
            sessionChannel.id,
            serverCode,
            Date.now()
          );

          await interaction.reply({
            content:
              `✅ Session ouverte dans ${sessionChannel}.`,
            flags: MessageFlags.Ephemeral
          });

          await logEvent(
            interaction.guild,
            '🟢 Session RP ouverte',
            `${interaction.user} a ouvert une session.\n\n` +
            `**Salon :** ${sessionChannel}\n` +
            `**Code :** \`${serverCode}\`\n` +
            `**Message :** ${sessionMessage.id}`,
            0x57F287
          );

          return;
        }

        if (subcommand === 'shutdown') {
          const session = db.prepare(`
            SELECT *
            FROM sessions
            WHERE guild_id = ?
              AND active = 1
          `).get(
            interaction.guild.id
          );

          if (!session) {
            return interaction.reply({
              content:
                '❌ Aucune session active.',
              flags: MessageFlags.Ephemeral
            });
          }

          const channel =
            await interaction.guild.channels.fetch(
              session.channel_id
            );

          if (!channel?.isTextBased()) {
            db.prepare(`
              UPDATE sessions
              SET active = 0
              WHERE guild_id = ?
            `).run(interaction.guild.id);

            return interaction.reply({
              content:
                '⚠️ Le salon de session n’est plus accessible.',
              flags: MessageFlags.Ephemeral
            });
          }

          if (config.sessions.clearOnShutdown) {
            await clearChannel(channel);
          }

          await sendV2(
            channel,
            buildSessionClosedOptions(config)
          );

          db.prepare(`
            UPDATE sessions
            SET active = 0
            WHERE guild_id = ?
          `).run(interaction.guild.id);

          await interaction.reply({
            content:
              '✅ Session fermée.',
            flags: MessageFlags.Ephemeral
          });

          await logEvent(
            interaction.guild,
            '🔴 Session RP fermée',
            `${interaction.user} a fermé la session dans ${channel}.`,
            0xED4245
          );

          return;
        }
      }
    }

    // ========================================================================
    // STRING SELECT MENUS
    // ========================================================================

    if (interaction.isStringSelectMenu()) {
      // APPLICATION
      if (
        interaction.customId === 'application:select'
      ) {
        if (
          interaction.values[0] !== 'staff'
        ) {
          return;
        }

        try {
          await startApplicationDM(
            interaction.user,
            interaction.guild.id,
            interaction.channel.id
          );

          return interaction.reply({
            content:
              '✅ Je viens de t’envoyer un DM pour commencer la candidature.',
            flags: MessageFlags.Ephemeral
          });
        } catch {
          return interaction.reply({
            content:
              '❌ Impossible de t’envoyer un DM. Vérifie que tes messages privés sont ouverts.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // TICKET
      if (
        interaction.customId === 'ticket:create'
      ) {
        if (interaction.values[0] === 'open') {
          await createTicket(interaction);
        }

        return;
      }
    }

    // ========================================================================
    // BUTTONS
    // ========================================================================

    if (interaction.isButton()) {
      // ----------------------------------------------------------------------
      // RULES
      // ----------------------------------------------------------------------

      if (
        interaction.customId === 'rules:accept'
      ) {
        const config =
          getConfig(interaction.guild.id);

        if (!config.roles.verified) {
          return interaction.reply({
            content:
              '⚠️ Le rôle de validation n’a pas encore été configuré. Utilisez `/config role`.',
            flags: MessageFlags.Ephemeral
          });
        }

        const role =
          await resolveRole(
            interaction.guild,
            config.roles.verified
          );

        if (!role) {
          return interaction.reply({
            content:
              '❌ Le rôle configuré est introuvable.',
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          await interaction.member.roles.add(
            role,
            'Acceptation du règlement'
          );

          return interaction.reply({
            content:
              `✅ Règlement accepté. Le rôle ${role} t’a été attribué.`,
            flags: MessageFlags.Ephemeral
          });
        } catch {
          return interaction.reply({
            content:
              '❌ Je ne peux pas attribuer ce rôle. Vérifie la position du rôle du bot.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // ----------------------------------------------------------------------
      // APPLICATION START
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith('app:start:')
      ) {
        const parts =
          interaction.customId.split(':');

        const guildId = parts[2];
        const applicationId = Number(parts[3]);

        const application =
          db.prepare(`
            SELECT *
            FROM applications
            WHERE id = ?
              AND guild_id = ?
              AND user_id = ?
              AND status = 'collecting'
          `).get(
            applicationId,
            guildId,
            interaction.user.id
          );

        if (!application) {
          return interaction.reply({
            content:
              '❌ Cette candidature n’est plus disponible.',
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [
              buildV2Container({
                title: 'Candidature démarrée',
                description:
                  'Parfait. On commence.\n\n' +
                  'Réponds à chaque question directement dans ce DM.',
                accent:
                  getConfig(guildId).accentColor
              })
            ]
          });

          await askApplicationQuestion(
            application
          );
        } catch (error) {
          console.error(error);
        }

        return;
      }

      // ----------------------------------------------------------------------
      // APPLICATION DECISION
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'app:decision:'
        )
      ) {
        if (!canStaff(
          interaction.member,
          getConfig(interaction.guild.id)
        )) {
          return interaction.reply({
            content:
              '❌ Tu n’as pas la permission de traiter les candidatures.',
            flags: MessageFlags.Ephemeral
          });
        }

        const parts =
          interaction.customId.split(':');

        const action = parts[2];
        const applicationId = Number(parts[3]);

        const modal =
          new ModalBuilder()
            .setCustomId(
              `app:modal:${action}:${applicationId}`
            )
            .setTitle(
              action === 'accept'
                ? 'Accepter la candidature'
                : 'Refuser la candidature'
            );

        const reason =
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Pourquoi ?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
              'Explique la décision...'
            )
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            reason
          )
        );

        return interaction.showModal(modal);
      }

      // ----------------------------------------------------------------------
      // GIVEAWAY JOIN
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'gw:join:'
        )
      ) {
        const giveawayId =
          Number(
            interaction.customId.split(':')[2]
          );

        const giveaway = db.prepare(`
          SELECT *
          FROM giveaways
          WHERE id = ?
        `).get(giveawayId);

        if (!giveaway || giveaway.ended) {
          return interaction.reply({
            content:
              '❌ Ce giveaway est terminé.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (
          giveaway.end_at <= Date.now()
        ) {
          await finishGiveaway(
            giveaway.id
          );

          return interaction.reply({
            content:
              '❌ Ce giveaway vient de se terminer.',
            flags: MessageFlags.Ephemeral
          });
        }

        const member =
          await interaction.guild.members.fetch(
            interaction.user.id
          );

        const config =
          getConfig(interaction.guild.id);

        if (
          giveaway.role_id &&
          !member.roles.cache.has(
            giveaway.role_id
          )
        ) {
          return interaction.reply({
            content:
              `❌ Tu dois posséder ${mentionRole(giveaway.role_id)} pour participer.`,
            flags: MessageFlags.Ephemeral
          });
        }

        let participants =
          JSON.parse(
            giveaway.participants || '[]'
          );

        if (
          participants.includes(
            interaction.user.id
          )
        ) {
          const confirm =
            new ButtonBuilder()
              .setCustomId(
                `gw:confirm-leave:${giveaway.id}`
              )
              .setLabel(
                'Oui, quitter le giveaway'
              )
              .setStyle(ButtonStyle.Danger);

          return replyV2(interaction, {
            title: 'Quitter le giveaway ?',
            description:
              'Tu participes déjà à ce giveaway.\n\n' +
              'Veux-tu vraiment quitter ?',
            accent: 0xED4245,
            buttons: [confirm],
            footer:
              'Cette confirmation est uniquement visible par toi.',
            ephemeral: true
          });
        }

        participants.push(
          interaction.user.id
        );

        db.prepare(`
          UPDATE giveaways
          SET participants = ?
          WHERE id = ?
        `).run(
          JSON.stringify(participants),
          giveaway.id
        );

        const updated =
          db.prepare(`
            SELECT *
            FROM giveaways
            WHERE id = ?
          `).get(giveaway.id);

        await updateGiveawayMessage(
          updated
        );

        return interaction.reply({
          content:
            '🎉 Tu participes maintenant au giveaway !',
          flags: MessageFlags.Ephemeral
        });
      }

      // ----------------------------------------------------------------------
      // GIVEAWAY LEAVE DIRECT BUTTON
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'gw:leave:'
        )
      ) {
        const giveawayId =
          Number(
            interaction.customId.split(':')[2]
          );

        const confirm =
          new ButtonBuilder()
            .setCustomId(
              `gw:confirm-leave:${giveawayId}`
            )
            .setLabel(
              'Oui, quitter le giveaway'
            )
            .setStyle(ButtonStyle.Danger);

        return replyV2(interaction, {
          title: 'Quitter le giveaway ?',
          description:
            'Tu vas être retiré de la liste des participants.\n\n' +
            'Confirme ci-dessous pour continuer.',
          accent: 0xED4245,
          buttons: [confirm],
          footer:
            'Cette confirmation est uniquement visible par toi.',
          ephemeral: true
        });
      }

      // ----------------------------------------------------------------------
      // CONFIRM GIVEAWAY LEAVE
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'gw:confirm-leave:'
        )
      ) {
        const giveawayId =
          Number(
            interaction.customId.split(':')[2]
          );

        const giveaway =
          db.prepare(`
            SELECT *
            FROM giveaways
            WHERE id = ?
          `).get(giveawayId);

        if (!giveaway || giveaway.ended) {
          return interaction.update({
            flags: MessageFlags.Ephemeral |
              MessageFlags.IsComponentsV2,
            components: [
              buildV2Container({
                title: 'Giveaway terminé',
                description:
                  'Ce giveaway est déjà terminé.',
                accent: 0xED4245
              })
            ]
          });
        }

        let participants =
          JSON.parse(
            giveaway.participants || '[]'
          );

        participants =
          participants.filter(
            id => id !== interaction.user.id
          );

        db.prepare(`
          UPDATE giveaways
          SET participants = ?
          WHERE id = ?
        `).run(
          JSON.stringify(participants),
          giveaway.id
        );

        const updated =
          db.prepare(`
            SELECT *
            FROM giveaways
            WHERE id = ?
          `).get(giveaway.id);

        await updateGiveawayMessage(
          updated
        );

        return interaction.update({
          flags:
            MessageFlags.Ephemeral |
            MessageFlags.IsComponentsV2,
          components: [
            buildV2Container({
              title: 'Participation supprimée',
              description:
                'Tu as quitté le giveaway avec succès.',
              accent: 0x57F287
            })
          ]
        });
      }

      // ----------------------------------------------------------------------
      // TICKET CLOSE
      // ----------------------------------------------------------------------

      if (
        interaction.customId === 'ticket:close'
      ) {
        const ticket =
          db.prepare(`
            SELECT *
            FROM tickets
            WHERE channel_id = ?
              AND closed_at IS NULL
          `).get(
            interaction.channel.id
          );

        if (!ticket) {
          return interaction.reply({
            content:
              '❌ Ce salon n’est pas un ticket actif.',
            flags: MessageFlags.Ephemeral
          });
        }

        const config =
          getConfig(interaction.guild.id);

        const member =
          interaction.member;

        const isOwner =
          ticket.user_id === interaction.user.id;

        const isStaff =
          canStaff(
            member,
            config
          );

        if (!isOwner && !isStaff) {
          return interaction.reply({
            content:
              '❌ Tu ne peux pas fermer ce ticket.',
            flags: MessageFlags.Ephemeral
          });
        }

        db.prepare(`
          UPDATE tickets
          SET closed_at = ?
          WHERE channel_id = ?
        `).run(
          Date.now(),
          interaction.channel.id
        );

        await interaction.reply({
          content:
            '🔒 Fermeture du ticket...',
          flags: MessageFlags.Ephemeral
        });

        await logEvent(
          interaction.guild,
          '🔒 Ticket fermé',
          `${interaction.user} a fermé le ticket <#${interaction.channel.id}>.`,
          0xED4245
        );

        setTimeout(async () => {
          try {
            await interaction.channel.delete(
              'Ticket fermé'
            );
          } catch {}
        }, 1200);

        return;
      }

      // ----------------------------------------------------------------------
      // SUGGESTION CREATE
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'suggestion:create'
      ) {
        const modal =
          new ModalBuilder()
            .setCustomId(
              'suggestion:modal'
            )
            .setTitle(
              'Nouvelle suggestion'
            );

        const input =
          new TextInputBuilder()
            .setCustomId('suggestion')
            .setLabel('Ta suggestion')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
              'Explique ton idée le plus clairement possible...'
            )
            .setRequired(true)
            .setMaxLength(2000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            input
          )
        );

        return interaction.showModal(
          modal
        );
      }

      // ----------------------------------------------------------------------
      // SUGGESTION VOTE
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'suggestion:up:'
        ) ||
        interaction.customId.startsWith(
          'suggestion:down:'
        )
      ) {
        const [_, action, idString] =
          interaction.customId.split(':');

        const suggestionId =
          Number(idString);

        const suggestion =
          db.prepare(`
            SELECT *
            FROM suggestions
            WHERE id = ?
          `).get(suggestionId);

        if (!suggestion) {
          return interaction.reply({
            content:
              '❌ Suggestion introuvable.',
            flags: MessageFlags.Ephemeral
          });
        }

        let upvotes =
          JSON.parse(
            suggestion.upvotes || '[]'
          );

        let downvotes =
          JSON.parse(
            suggestion.downvotes || '[]'
          );

        if (action === 'up') {
          downvotes =
            downvotes.filter(
              id => id !== interaction.user.id
            );

          if (
            upvotes.includes(
              interaction.user.id
            )
          ) {
            upvotes =
              upvotes.filter(
                id =>
                  id !== interaction.user.id
              );
          } else {
            upvotes.push(
              interaction.user.id
            );
          }
        }

        if (action === 'down') {
          upvotes =
            upvotes.filter(
              id => id !== interaction.user.id
            );

          if (
            downvotes.includes(
              interaction.user.id
            )
          ) {
            downvotes =
              downvotes.filter(
                id =>
                  id !== interaction.user.id
              );
          } else {
            downvotes.push(
              interaction.user.id
            );
          }
        }

        db.prepare(`
          UPDATE suggestions
          SET upvotes = ?,
              downvotes = ?
          WHERE id = ?
        `).run(
          JSON.stringify(upvotes),
          JSON.stringify(downvotes),
          suggestionId
        );

        const updated =
          db.prepare(`
            SELECT *
            FROM suggestions
            WHERE id = ?
          `).get(
            suggestionId
          );

        await updateSuggestionMessage(
          updated
        );

        return interaction.reply({
          content:
            '✅ Ton vote a été enregistré.',
          flags: MessageFlags.Ephemeral
        });
      }

      // ----------------------------------------------------------------------
      // SESSION SHUTDOWN BUTTON
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'session:shutdown'
      ) {
        if (!canManageServer(interaction)) {
          return interaction.reply({
            content:
              '❌ Tu n’as pas la permission de fermer la session.',
            flags: MessageFlags.Ephemeral
          });
        }

        const config =
          getConfig(interaction.guild.id);

        const session =
          db.prepare(`
            SELECT *
            FROM sessions
            WHERE guild_id = ?
              AND active = 1
          `).get(
            interaction.guild.id
          );

        if (!session) {
          return interaction.reply({
            content:
              '❌ Aucune session active.',
            flags: MessageFlags.Ephemeral
          });
        }

        const channel =
          await interaction.guild.channels.fetch(
            session.channel_id
          );

        if (!channel?.isTextBased()) {
          return interaction.reply({
            content:
              '❌ Le salon de session n’est plus disponible.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (config.sessions.clearOnShutdown) {
          await clearChannel(channel);
        }

        await sendV2(
          channel,
          buildSessionClosedOptions(config)
        );

        db.prepare(`
          UPDATE sessions
          SET active = 0
          WHERE guild_id = ?
        `).run(interaction.guild.id);

        return interaction.reply({
          content:
            '✅ Session fermée.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // ========================================================================
    // MODALS
    // ========================================================================

    if (interaction.isModalSubmit()) {
      // ----------------------------------------------------------------------
      // APPLICATION DECISION
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'app:modal:'
        )
      ) {
        if (!canStaff(
          interaction.member,
          getConfig(interaction.guild.id)
        )) {
          return interaction.reply({
            content:
              '❌ Tu n’as pas la permission.',
            flags: MessageFlags.Ephemeral
          });
        }

        const parts =
          interaction.customId.split(':');

        const action = parts[2];
        const applicationId =
          Number(parts[3]);

        const application =
          db.prepare(`
            SELECT *
            FROM applications
            WHERE id = ?
              AND guild_id = ?
          `).get(
            applicationId,
            interaction.guild.id
          );

        if (!application) {
          return interaction.reply({
            content:
              '❌ Candidature introuvable.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (
          application.status !== 'pending'
        ) {
          return interaction.reply({
            content:
              '❌ Cette candidature a déjà été traitée.',
            flags: MessageFlags.Ephemeral
          });
        }

        const reason =
          interaction.fields.getTextInputValue(
            'reason'
          );

        const newStatus =
          action === 'accept'
            ? 'accepted'
            : 'refused';

        db.prepare(`
          UPDATE applications
          SET status = ?,
              decision_reason = ?,
              decided_by = ?,
              decided_at = ?
          WHERE id = ?
        `).run(
          newStatus,
          reason,
          interaction.user.id,
          Date.now(),
          application.id
        );

        const config =
          getConfig(interaction.guild.id);

        // Give staff role after accept
        if (
          action === 'accept' &&
          config.applications.assignStaffRoleOnAccept &&
          config.roles.staff
        ) {
          const member =
            await interaction.guild.members
              .fetch(application.user_id)
              .catch(() => null);

          const staffRole =
            await resolveRole(
              interaction.guild,
              config.roles.staff
            );

          if (
            member &&
            staffRole &&
            member.manageable
          ) {
            try {
              await member.roles.add(
                staffRole,
                'Candidature staff acceptée'
              );
            } catch {}
          }
        }

        // Update original log message
        if (
          application.log_channel_id &&
          application.log_message_id
        ) {
          try {
            const channel =
              await interaction.guild.channels.fetch(
                application.log_channel_id
              );

            const message =
              await channel.messages.fetch(
                application.log_message_id
              );

            await editV2(
              message,
              {
                title:
                  action === 'accept'
                    ? `✅ Candidature #${application.id} acceptée`
                    : `❌ Candidature #${application.id} refusée`,
                description:
                  `**Candidat :** <@${application.user_id}>\n` +
                  `**Décision par :** ${interaction.user}\n` +
                  `**Raison :** ${reason}\n\n` +
                  `**État :** ${
                    action === 'accept'
                      ? '✅ Acceptée'
                      : '❌ Refusée'
                  }`,
                accent:
                  action === 'accept'
                    ? 0x57F287
                    : 0xED4245,
                footer:
                  `Traité le ${new Date().toLocaleString('fr-FR')}`
              }
            );
          } catch {}
        }

        // DM applicant
        try {
          const user =
            await client.users.fetch(
              application.user_id
            );

          await user.send({
            flags:
              MessageFlags.IsComponentsV2,
            components: [
              buildV2Container({
                title:
                  action === 'accept'
                    ? '✅ Candidature acceptée'
                    : '❌ Candidature refusée',
                description:
                  action === 'accept'
                    ? `${config.text.applicationAccepted}\n\n` +
                      `**Raison :** ${reason}`
                    : `${config.text.applicationRefused}\n\n` +
                      `**Raison :** ${reason}`,
                accent:
                  action === 'accept'
                    ? 0x57F287
                    : 0xED4245
              })
            ]
          });
        } catch {}

        await interaction.reply({
          content:
            action === 'accept'
              ? '✅ Candidature acceptée et candidat averti.'
              : '✅ Candidature refusée et candidat averti.',
          flags: MessageFlags.Ephemeral
        });

        await logEvent(
          interaction.guild,
          action === 'accept'
            ? '✅ Candidature acceptée'
            : '❌ Candidature refusée',
          `${interaction.user} a traité la candidature #${application.id}.\n\n` +
          `**Candidat :** <@${application.user_id}>\n` +
          `**Raison :** ${reason}`,
          action === 'accept'
            ? 0x57F287
            : 0xED4245
        );

        return;
      }

      // ----------------------------------------------------------------------
      // SUGGESTION MODAL
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'suggestion:modal'
      ) {
        const content =
          interaction.fields.getTextInputValue(
            'suggestion'
          );

        const config =
          getConfig(interaction.guild.id);

        const target =
          await resolveChannel(
            interaction.guild,
            config.channels.suggestions,
            interaction.channel
          );

        const result =
          db.prepare(`
            INSERT INTO suggestions (
              guild_id,
              channel_id,
              message_id,
              user_id,
              content,
              upvotes,
              downvotes,
              status,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            interaction.guild.id,
            target.id,
            'pending',
            interaction.user.id,
            content,
            JSON.stringify([]),
            JSON.stringify([]),
            'pending',
            Date.now()
          );

        const suggestion =
          db.prepare(`
            SELECT *
            FROM suggestions
            WHERE id = ?
          `).get(
            result.lastInsertRowid
          );

        const message =
          await target.send({
            flags:
              MessageFlags.IsComponentsV2,
            components: [
              buildSuggestionContainer(
                suggestion
              )
            ]
          });

        db.prepare(`
          UPDATE suggestions
          SET message_id = ?
          WHERE id = ?
        `).run(
          message.id,
          suggestion.id
        );

        await interaction.reply({
          content:
            `✅ Suggestion envoyée dans ${target}.`,
          flags: MessageFlags.Ephemeral
        });

        return;
      }
    }
  } catch (error) {
    console.error(
      'Interaction error:',
      error
    );

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content:
            '❌ Une erreur est survenue. Vérifie la console du bot.',
          flags: MessageFlags.Ephemeral
        });
      } catch {}
    }
  }
});

// ============================================================================
// SESSION HELPER
// ============================================================================

function buildSessionClosedOptions(config) {
  return {
    title: '🔴 SESSION RP FERMÉE',
    description:
      `${config.text.sessionClosed}\n\n` +
      `Le serveur RP n'est actuellement plus disponible.`,
    accent: 0xED4245,
    footer: 'R.P FRANCE • Session fermée'
  };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

client.on(Events.Error, error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

// ============================================================================
// START
// ============================================================================

(async () => {
  try {
    await client.login(TOKEN);
  } catch (error) {
    console.error(
      '❌ Impossible de connecter le bot :',
      error.message
    );

    process.exit(1);
  }
})();
