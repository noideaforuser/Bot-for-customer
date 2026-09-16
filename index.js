/*
╔══════════════════════════════════════════════════════════════════════════════╗
║                              BRETAGNE RP                                    ║
║                           Discord Bot Core                                  ║
║                                                                              ║
║  Node.js 24+                                                                ║
║  discord.js 14.x                                                            ║
║  SQLite                                                                      ║
║  Components V2                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

INSTALL:
npm install discord.js better-sqlite3

ENVIRONMENT:
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...

IMPORTANT:
- This version is intentionally in TEST MODE.
- Command/channel restrictions are NOT enforced yet.
- The IDs below are used as default destinations, but can be changed
  through /config.
- The bot automatically checks/reuses its panels when it starts.
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
  Routes
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

const db = new Database('./bretagne-rp.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS configs (
  guild_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS panel_messages (
  guild_id TEXT NOT NULL,
  panel_key TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, panel_key)
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '[]',
  question_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'collecting',
  log_channel_id TEXT,
  log_message_id TEXT,
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  duration TEXT NOT NULL,
  winners INTEGER NOT NULL DEFAULT 1,
  required_role_id TEXT,
  end_at INTEGER NOT NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  ended INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS user_sanctions (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  strikes INTEGER NOT NULL DEFAULT 0,
  last_strike_at INTEGER,
  PRIMARY KEY (guild_id, user_id)
);
`);

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG = {
  serverName: 'Bretagne RP',

  appearance: {
    accentColor: 0x5865F2,
    successColor: 0x57F287,
    dangerColor: 0xED4245,
    warningColor: 0xFEE75C,
    neutralColor: 0x5865F2
  },

  channels: {
    welcome: '1548280111890042891',
    rules: '1548280076377006220',
    applicationLogs: '1548280161622040687',
    suggestions: '1548280159948251190',
    sessions: null,
    logs: null,
    ticketCategory: null
  },

  roles: {
    verified: '1548280026842005594',
    staff: null,
    ticketSupport: null,
    config: '1548279987453296643',
    giveaways: '1548279987453296643'
  },

  systems: {
    welcome: true,
    rules: true,
    applications: true,
    giveaways: true,
    tickets: true,
    suggestions: true,
    sessions: true,

    security: true,
    antiRaid: true,
    antiSpam: true,
    antiMassMention: true,
    antiMassDelete: true,
    badWords: true
  },

  testMode: true,

  welcome: {
    title: 'Bienvenue sur Bretagne RP',
    message:
      'Bienvenue sur **Bretagne RP** !\n\n' +
      'Pense à consulter le règlement et à valider ton accès.',
    dm:
      'Bienvenue sur **Bretagne RP** !\n\n' +
      'Rends-toi dans le salon du règlement et clique sur **J’accepte le règlement** pour obtenir ton accès.'
  },

  applications: {
    questions: [
      'Quel âge avez-vous ?',
      'Depuis combien de temps êtes-vous sur Bretagne RP ?',
      'Pourquoi souhaitez-vous rejoindre le staff ?',
      'Avez-vous déjà eu une expérience en modération ?',
      'Quelles sont vos qualités pour ce poste ?',
      'Pourquoi devrions-nous vous accepter ?'
    ],
    giveStaffRoleOnAccept: true
  },

  tickets: {
    prefix: 'ticket',
    deleteAfterClose: true
  },

  sessions: {
    autoPingEveryone: true,
    clearOnShutdown: true
  },

  giveaways: {
    minimumDurationSeconds: 10
  },

  security: {
    antiRaid: {
      joinThreshold: 8,
      windowSeconds: 10
    },

    antiSpam: {
      messageThreshold: 6,
      windowSeconds: 5
    },

    antiMassMention: {
      threshold: 5
    },

    antiMassDelete: {
      threshold: 10
    },

    badWords: {
      timeoutAtStrike: true
    }
  },

  bypassRoles: {
    antiRaid: [],
    antiSpam: [],
    antiMassMention: [],
    antiMassDelete: [],
    badWords: [],
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, extra) {
  const output = clone(base);

  for (const [key, value] of Object.entries(extra || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = merge(output[key], value);
    } else {
      output[key] = value;
    }
  }

  return output;
}

function getConfig(guildId) {
  const row = db
    .prepare('SELECT data FROM configs WHERE guild_id = ?')
    .get(guildId);

  if (!row) {
    const config = clone(DEFAULT_CONFIG);

    db.prepare(`
      INSERT INTO configs (guild_id, data)
      VALUES (?, ?)
    `).run(
      guildId,
      JSON.stringify(config)
    );

    return config;
  }

  try {
    return merge(
      DEFAULT_CONFIG,
      JSON.parse(row.data)
    );
  } catch {
    return clone(DEFAULT_CONFIG);
  }
}

function saveConfig(guildId, config) {
  db.prepare(`
    INSERT INTO configs (guild_id, data)
    VALUES (?, ?)
    ON CONFLICT(guild_id)
    DO UPDATE SET data = excluded.data
  `).run(
    guildId,
    JSON.stringify(config)
  );
}

function getNested(object, path) {
  return path
    .split('.')
    .reduce((acc, key) => acc?.[key], object);
}

function setNested(object, path, value) {
  const parts = path.split('.');
  let current = object;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }

    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
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
  partials: [
    Partials.Channel
  ]
});

// ============================================================================
// MEMORY
// ============================================================================

const spamTracker = new Map();
const raidTracker = new Map();

// ============================================================================
// BAD WORDS
// ============================================================================

const DEFAULT_BAD_WORDS = new Set([
  // French
  'merde',
  'putain',
  'pute',
  'salope',
  'connard',
  'connasse',
  'encule',
  'enculer',
  'batard',
  'bâtard',
  'bordel',

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

  // Italian
  'cazzo',
  'merda',
  'stronzo',
  'stronza',
  'puttana',
  'bastardo',
  'vaffanculo',

  // Portuguese
  'merda',
  'caralho',
  'porra',
  'puta',
  'puto',

  // Dutch
  'klootzak',
  'hoer',
  'tering',
  'godverdomme',

  // Polish
  'kurwa',
  'chuj',
  'cipa',
  'skurwysyn',

  // Turkish
  'siktir',
  'orospu',
  'pic',
  'piç',

  // Russian
  'блять',
  'блядь',
  'сука',
  'хуй',
  'пизда',
  'ебать',

  // Ukrainian
  'бля',
  'блядь',
  'сука',
  'хуй',

  // Romanian
  'muie',
  'pula',
  'pizda',
  'futu',
  'curva',

  // Greek
  'μαλάκα',
  'μαλακα',
  'γαμω',
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

  // Danish
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
  'jebat',

  // Hungarian
  'kurva',
  'fasz',
  'geci',

  // Hindi/Hinglish
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

  // Arabic
  'كلب',
  'حمار',
  'خرا',
  'كس',
  'شرموطة'
]);

function normalizeText(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[4@]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBadWord(content, config) {
  const normalized = normalizeText(content);

  const words = new Set(
    normalized
      .split(/\s+/)
      .filter(Boolean)
  );

  for (const badWord of DEFAULT_BAD_WORDS) {
    if (
      words.has(
        normalizeText(badWord)
      )
    ) {
      return badWord;
    }
  }

  for (const badWord of config.customBadWords) {
    if (
      words.has(
        normalizeText(badWord)
      )
    ) {
      return badWord;
    }
  }

  return null;
}

// ============================================================================
// SANCTION ESCALATION
// ============================================================================

const SANCTION_STEPS = [
  30,
  60,
  300,
  600,
  1800,
  3600,
  21600,
  43200,
  86400
];

function getCurrentDayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ].join('-');
}

function getUserStrike(guildId, userId) {
  const row = db
    .prepare(`
      SELECT *
      FROM user_sanctions
      WHERE guild_id = ?
        AND user_id = ?
    `)
    .get(
      guildId,
      userId
    );

  if (!row) {
    return 0;
  }

  const lastStrikeDay =
    row.last_strike_at
      ? new Date(row.last_strike_at)
      : null;

  if (
    lastStrikeDay &&
    [
      lastStrikeDay.getFullYear(),
      lastStrikeDay.getMonth(),
      lastStrikeDay.getDate()
    ].join('-') !== getCurrentDayKey()
  ) {
    return 0;
  }

  return row.strikes;
}

function addStrike(guildId, userId) {
  const current =
    getUserStrike(
      guildId,
      userId
    );

  const next =
    Math.min(
      current + 1,
      SANCTION_STEPS.length
    );

  db.prepare(`
    INSERT INTO user_sanctions (
      guild_id,
      user_id,
      strikes,
      last_strike_at
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id)
    DO UPDATE SET
      strikes = excluded.strikes,
      last_strike_at = excluded.last_strike_at
  `).run(
    guildId,
    userId,
    next,
    Date.now()
  );

  return next;
}

function getTimeoutSeconds(strike) {
  return SANCTION_STEPS[
    Math.max(
      0,
      Math.min(
        strike - 1,
        SANCTION_STEPS.length - 1
      )
    )
  ];
}

function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
  }

  if (seconds < 3600) {
    const minutes =
      Math.floor(seconds / 60);

    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  if (seconds < 86400) {
    const hours =
      Math.floor(seconds / 3600);

    return `${hours} heure${hours > 1 ? 's' : ''}`;
  }

  return '24 heures';
}

// ============================================================================
// COMPONENTS V2 HELPERS
// ============================================================================

function container({
  title,
  description,
  accent = 0x5865F2,
  footer = null,
  components = []
}) {
  const result =
    new ContainerBuilder()
      .setAccentColor(accent)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${title}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(description)
      );

  for (const component of components) {
    if (component.type === 'row') {
      result.addActionRowComponents(
        component.row
      );
    }
  }

  if (footer) {
    result
      .addSeparatorComponents(
        new SeparatorBuilder()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# ${footer}`
          )
      );
  }

  return result;
}

function row(...buttons) {
  return {
    type: 'row',
    row:
      new ActionRowBuilder()
        .addComponents(...buttons)
  };
}

function v2Message(component) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [component]
  };
}

function v2Reply(interaction, component, ephemeral = false) {
  let flags =
    MessageFlags.IsComponentsV2;

  if (ephemeral) {
    flags |= MessageFlags.Ephemeral;
  }

  return interaction.reply({
    flags,
    components: [component]
  });
}

// ============================================================================
// CHANNEL HELPERS
// ============================================================================

async function getTextChannel(guild, id) {
  if (!id) {
    return null;
  }

  let channel =
    guild.channels.cache.get(id);

  if (channel) {
    return channel.isTextBased()
      ? channel
      : null;
  }

  try {
    channel =
      await guild.channels.fetch(id);

    return channel?.isTextBased()
      ? channel
      : null;
  } catch {
    return null;
  }
}

// ============================================================================
// PANEL DATABASE
// ============================================================================

function getPanel(guildId, panelKey) {
  return db.prepare(`
    SELECT *
    FROM panel_messages
    WHERE guild_id = ?
      AND panel_key = ?
  `).get(
    guildId,
    panelKey
  );
}

function savePanel(
  guildId,
  panelKey,
  channelId,
  messageId
) {
  db.prepare(`
    INSERT INTO panel_messages (
      guild_id,
      panel_key,
      channel_id,
      message_id
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, panel_key)
    DO UPDATE SET
      channel_id = excluded.channel_id,
      message_id = excluded.message_id
  `).run(
    guildId,
    panelKey,
    channelId,
    messageId
  );
}

// ============================================================================
// PERSISTENT PANEL SYNC
// ============================================================================

async function syncPersistentPanel(
  guild,
  panelKey,
  channel,
  builder
) {
  if (!channel?.isTextBased()) {
    return;
  }

  const stored =
    getPanel(
      guild.id,
      panelKey
    );

  if (stored) {
    try {
      const oldChannel =
        await getTextChannel(
          guild,
          stored.channel_id
        );

      if (oldChannel) {
        const message =
          await oldChannel.messages.fetch(
            stored.message_id
          );

        if (message) {
          await message.edit(
            v2Message(builder())
          );

          if (
            oldChannel.id !== channel.id
          ) {
            savePanel(
              guild.id,
              panelKey,
              channel.id,
              message.id
            );
          }

          return;
        }
      }
    } catch {
      // Message vanished.
      // Create it again below.
    }
  }

  const message =
    await channel.send(
      v2Message(builder())
    );

  savePanel(
    guild.id,
    panelKey,
    channel.id,
    message.id
  );
}

// ============================================================================
// RULES
// ============================================================================

function buildRulesPanel(config) {
  const rulesText = [
    '## Règlement RP France',
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
    '> Ne partagez pas d’informations personnelles, les vôtres ou celles des autres, sans consentement.',
    '',
    '### Canaux',
    '> Utilisez les canaux pour leur objectif prévu. Lisez les descriptions pour savoir où poster vos messages.',
    '',
    '### Pas de Trolls',
    '> Évitez de provoquer les autres ou de créer des conflits inutiles.',
    '',
    '### Suivre les Instructions des Modérateurs',
    '> Les modérateurs sont là pour maintenir un environnement agréable. Suivez leurs directives et respectez leurs décisions.',
    '',
    '### Sanctions',
    '> Tout manquement à ces règles pourra entraîner des avertissements, des expulsions temporaires ou permanentes, selon la gravité de l’infraction.',
    '',
    '**En cliquant sur le bouton ci-dessous, vous confirmez avoir lu et accepté le règlement.**'
  ].join('\n');

  const acceptButton =
    new ButtonBuilder()
      .setCustomId('rules_accept')
      .setLabel('J’accepte le règlement')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success);

  return container({
    title: 'Règlement RP France',
    description: rulesText,
    accent:
      config.appearance.successColor,
    components: [
      row(acceptButton)
    ],
    footer:
      `${config.serverName} • Merci de respecter les règles`
  });
}

// ============================================================================
// APPLICATION PANEL
// ============================================================================

function buildApplicationPanel(config) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId('application_menu')
      .setPlaceholder(
        'Sélectionnez une option...'
      )
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Candidature Staff')
          .setDescription(
            'Commencer une candidature Staff'
          )
          .setEmoji('📋')
          .setValue('staff')
      );

  return container({
    title: 'Candidatures Staff',
    description:
      '## Rejoindre le Staff\n\n' +
      'Tu souhaites rejoindre l’équipe de **Bretagne RP** ?\n\n' +
      'Sélectionne **Candidature Staff** ci-dessous.\n\n' +
      'La candidature se déroule directement en **messages privés** avec le bot. Les questions sont envoyées une par une et chaque réponse est enregistrée.',
    accent:
      config.appearance.accentColor,
    components: [
      {
        type: 'row',
        row:
          new ActionRowBuilder()
            .addComponents(menu)
      }
    ],
    footer:
      'Bretagne RP • Les candidatures sont traitées par le Staff'
  });
}

// ============================================================================
// TICKET PANEL
// ============================================================================

function buildTicketPanel(config) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId('ticket_menu')
      .setPlaceholder(
        'Sélectionnez une option...'
      )
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Ouvrir un ticket')
          .setDescription(
            'Créer un ticket avec le support'
          )
          .setEmoji('🎫')
          .setValue('open')
      );

  return container({
    title: 'Centre de support',
    description:
      '## Besoin d’aide ?\n\n' +
      'Utilise le menu ci-dessous pour ouvrir un ticket privé avec l’équipe de support.\n\n' +
      'Décris ta demande clairement afin que le Staff puisse t’aider efficacement.',
    accent:
      config.appearance.accentColor,
    components: [
      {
        type: 'row',
        row:
          new ActionRowBuilder()
            .addComponents(menu)
      }
    ],
    footer:
      'Bretagne RP • Support'
  });
}

// ============================================================================
// SUGGESTIONS PANEL
// ============================================================================

function buildSuggestionPanel(config) {
  const button =
    new ButtonBuilder()
      .setCustomId('suggestion_create')
      .setLabel('Créer une suggestion')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Primary);

  return container({
    title: 'Suggestions',
    description:
      '## Une idée pour Bretagne RP ?\n\n' +
      'Tu peux proposer une amélioration pour le serveur grâce au système de suggestions.\n\n' +
      'Les membres pourront ensuite voter pour les propositions.',
    accent:
      config.appearance.warningColor,
    components: [
      row(button)
    ],
    footer:
      'Bretagne RP • Tes idées comptent'
  });
}

// ============================================================================
// AUTO PANELS
// ============================================================================

async function syncAllPanels(guild) {
  const config =
    getConfig(guild.id);

  if (config.systems.rules) {
    const channel =
      await getTextChannel(
        guild,
        config.channels.rules
      );

    if (channel) {
      await syncPersistentPanel(
        guild,
        'rules',
        channel,
        () => buildRulesPanel(config)
      );
    }
  }

  if (config.systems.applications) {
    const channel =
      await getTextChannel(
        guild,
        config.channels.applicationLogs
      );

    if (channel) {
      await syncPersistentPanel(
        guild,
        'applications',
        channel,
        () => buildApplicationPanel(config)
      );
    }
  }

  if (config.systems.tickets) {
    let channel =
      await getTextChannel(
        guild,
        config.channels.logs
      );

    if (!channel) {
      channel =
        guild.channels.cache.find(
          c =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(
              guild.members.me
            )?.has(
              PermissionFlagsBits.SendMessages
            )
        );
    }

    if (channel) {
      await syncPersistentPanel(
        guild,
        'tickets',
        channel,
        () => buildTicketPanel(config)
      );
    }
  }

  if (config.systems.suggestions) {
    const channel =
      await getTextChannel(
        guild,
        config.channels.suggestions
      );

    if (channel) {
      await syncPersistentPanel(
        guild,
        'suggestions',
        channel,
        () =>
          buildSuggestionPanel(config)
      );
    }
  }
}

// ============================================================================
// WELCOME
// ============================================================================

async function sendWelcome(member) {
  const config =
    getConfig(member.guild.id);

  if (!config.systems.welcome) {
    return;
  }

  const channel =
    await getTextChannel(
      member.guild,
      config.channels.welcome
    );

  if (channel) {
    await channel.send(
      v2Message(
        container({
          title:
            config.welcome.title,
          description:
            `${member}\n\n` +
            config.welcome.message,
          accent:
            config.appearance.accentColor,
          footer:
            `${config.serverName} • Nouveau membre`
        })
      )
    );
  }

  try {
    await member.user.send(
      v2Message(
        container({
          title:
            config.welcome.title,
          description:
            config.welcome.dm,
          accent:
            config.appearance.accentColor
        })
      )
    );
  } catch {
    // DMs disabled.
  }
}

// ============================================================================
// BYPASS
// ============================================================================

function hasBypass(
  member,
  config,
  system
) {
  const bypass =
    config.bypassRoles[system] || [];

  if (!member?.roles?.cache) {
    return false;
  }

  return bypass.some(
    roleId =>
      member.roles.cache.has(roleId)
  );
}

// ============================================================================
// SANCTION DM
// ============================================================================

async function sendSanctionDM(
  member,
  reason,
  strike,
  seconds
) {
  try {
    await member.user.send(
      v2Message(
        container({
          title: 'Sanction automatique',
          description:
            `Ton message a été supprimé automatiquement.\n\n` +
            `**Raison :** ${reason}\n\n` +
            `**Sanction :** timeout de ${formatDuration(seconds)}\n` +
            `**Niveau de sanction :** ${strike}\n\n` +
            `Les sanctions augmentent progressivement et sont réinitialisées à la fin de la journée.`,
          accent: 0xED4245,
          footer:
            'Bretagne RP • Modération automatique'
        })
      )
    );
  } catch {
    // DMs disabled.
  }
}

// ============================================================================
// APPLY TIMEOUT
// ============================================================================

async function applyProgressiveTimeout(
  member,
  reason
) {
  if (!member?.moderatable) {
    return null;
  }

  const strike =
    addStrike(
      member.guild.id,
      member.id
    );

  const seconds =
    getTimeoutSeconds(strike);

  try {
    await member.timeout(
      seconds * 1000,
      reason
    );
  } catch {
    return null;
  }

  await sendSanctionDM(
    member,
    reason,
    strike,
    seconds
  );

  return {
    strike,
    seconds
  };
}

// ============================================================================
// APPLICATION DM START
// ============================================================================

async function startApplication(user, guildId) {
  const existing =
    db.prepare(`
      SELECT *
      FROM applications
      WHERE guild_id = ?
        AND user_id = ?
        AND status = 'collecting'
      LIMIT 1
    `).get(
      guildId,
      user.id
    );

  if (existing) {
    await user.send(
      v2Message(
        container({
          title: 'Candidature déjà en cours',
          description:
            'Tu as déjà une candidature en cours.\n\n' +
            'Termine celle-ci avant d’en commencer une nouvelle.',
          accent: 0xFEE75C
        })
      )
    );

    return;
  }

  const result =
    db.prepare(`
      INSERT INTO applications (
        guild_id,
        user_id,
        answers,
        question_index,
        status,
        created_at
      )
      VALUES (?, ?, ?, 0, 'collecting', ?)
    `).run(
      guildId,
      user.id,
      JSON.stringify([]),
      Date.now()
    );

  const start =
    new ButtonBuilder()
      .setCustomId(
        `application_start:${result.lastInsertRowid}`
      )
      .setLabel('Commencer')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Primary);

  await user.send(
    v2Message(
      container({
        title: 'Candidature Staff',
        description:
          'Bienvenue dans le système de candidature de **Bretagne RP**.\n\n' +
          'Le bot va te poser plusieurs questions, une par une.\n\n' +
          'Réponds honnêtement et clairement.\n\n' +
          'Clique sur **Commencer** lorsque tu es prêt.',
        accent: 0x5865F2,
        components: [
          row(start)
        ],
        footer:
          `Candidature #${result.lastInsertRowid}`
      })
    )
  );
}

// ============================================================================
// ASK APPLICATION QUESTION
// ============================================================================

async function askNextApplicationQuestion(
  application
) {
  const config =
    getConfig(application.guild_id);

  const questions =
    config.applications.questions;

  if (
    application.question_index >=
    questions.length
  ) {
    return;
  }

  const question =
    questions[
      application.question_index
    ];

  const user =
    await client.users.fetch(
      application.user_id
    );

  await user.send(
    v2Message(
      container({
        title:
          `Question ${application.question_index + 1}/${questions.length}`,
        description:
          question +
          '\n\n' +
          'Réponds directement à ce message.',
        accent:
          config.appearance.accentColor
      })
    )
  );
}

// ============================================================================
// FINALIZE APPLICATION
// ============================================================================

async function finalizeApplication(
  application
) {
  const config =
    getConfig(application.guild_id);

  const guild =
    client.guilds.cache.get(
      application.guild_id
    );

  if (!guild) {
    return;
  }

  const channel =
    await getTextChannel(
      guild,
      config.channels.applicationLogs
    );

  if (!channel) {
    return;
  }

  const answers =
    JSON.parse(
      application.answers
    );

  const questions =
    config.applications.questions;

  const formatted =
    answers
      .map(
        (answer, index) =>
          `### ${index + 1}. ${questions[index] || 'Question'}\n${answer}`
      )
      .join('\n\n');

  const accept =
    new ButtonBuilder()
      .setCustomId(
        `application_accept:${application.id}`
      )
      .setLabel('Accepter')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success);

  const refuse =
    new ButtonBuilder()
      .setCustomId(
        `application_refuse:${application.id}`
      )
      .setLabel('Refuser')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger);

  const message =
    await channel.send(
      v2Message(
        container({
          title:
            `Candidature Staff #${application.id}`,
          description:
            `**Candidat :** <@${application.user_id}>\n` +
            `**Date :** <t:${Math.floor(application.created_at / 1000)}:F>\n\n` +
            formatted,
          accent:
            config.appearance.accentColor,
          components: [
            row(
              accept,
              refuse
            )
          ],
          footer:
            'Utilisez les boutons pour traiter cette candidature.'
        })
      )
    );

  db.prepare(`
    UPDATE applications
    SET
      status = 'pending',
      log_channel_id = ?,
      log_message_id = ?
    WHERE id = ?
  `).run(
    channel.id,
    message.id,
    application.id
  );

  try {
    const user =
      await client.users.fetch(
        application.user_id
      );

    await user.send(
      v2Message(
        container({
          title:
            'Candidature envoyée',
          description:
            'Ta candidature a été envoyée au Staff.\n\n' +
            'Tu recevras un message privé lorsque la décision aura été prise.',
          accent:
            config.appearance.accentColor
        })
      )
    );
  } catch {}
}

// ============================================================================
// TICKET CREATION
// ============================================================================

async function createTicket(
  interaction
) {
  const guild =
    interaction.guild;

  const config =
    getConfig(guild.id);

  const existing =
    db.prepare(`
      SELECT *
      FROM tickets
      WHERE guild_id = ?
        AND user_id = ?
        AND closed_at IS NULL
    `).get(
      guild.id,
      interaction.user.id
    );

  if (existing) {
    return interaction.reply({
      content:
        `❌ Tu as déjà un ticket : <#${existing.channel_id}>`,
      flags:
        MessageFlags.Ephemeral
    });
  }

  let parent = null;

  if (
    config.channels.ticketCategory
  ) {
    const candidate =
      guild.channels.cache.get(
        config.channels.ticketCategory
      );

    if (
      candidate?.type ===
      ChannelType.GuildCategory
    ) {
      parent = candidate;
    }
  }

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [
        PermissionFlagsBits.ViewChannel
      ]
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

  if (config.roles.ticketSupport) {
    permissionOverwrites.push({
      id: config.roles.ticketSupport,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    });
  }

  const channel =
    await guild.channels.create({
      name:
        `${config.tickets.prefix}-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .slice(0, 90),

      type:
        ChannelType.GuildText,

      parent:
        parent?.id,

      permissionOverwrites
    });

  db.prepare(`
    INSERT INTO tickets (
      guild_id,
      channel_id,
      user_id,
      opened_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    guild.id,
    channel.id,
    interaction.user.id,
    Date.now()
  );

  const close =
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Fermer le ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger);

  await channel.send(
    v2Message(
      container({
        title: 'Ticket ouvert',
        description:
          `${interaction.user}\n\n` +
          'Ton ticket est maintenant ouvert.\n\n' +
          'Explique ta demande clairement afin que le Staff puisse t’aider.',
        accent:
          config.appearance.accentColor,
        components: [
          row(close)
        ],
        footer:
          'Bretagne RP • Support'
      })
    )
  );

  return interaction.reply({
    content:
      `✅ Ticket créé : <#${channel.id}>`,
    flags:
      MessageFlags.Ephemeral
  });
}

// ============================================================================
// GIVEAWAY
// ============================================================================

function parseDuration(input) {
  const text =
    String(input)
      .toLowerCase()
      .replace(/\s+/g, '');

  const regex =
    /(\d+)(s|m|h|d|w)/g;

  let total = 0;
  let found = false;

  let match;

  while (
    (match = regex.exec(text))
  ) {
    found = true;

    const amount =
      Number(match[1]);

    switch (match[2]) {
      case 's':
        total += amount * 1000;
        break;

      case 'm':
        total += amount * 60 * 1000;
        break;

      case 'h':
        total += amount * 60 * 60 * 1000;
        break;

      case 'd':
        total += amount * 24 * 60 * 60 * 1000;
        break;

      case 'w':
        total += amount * 7 * 24 * 60 * 60 * 1000;
        break;
    }
  }

  return found
    ? total
    : null;
}

function buildGiveawayPanel(
  giveaway
) {
  const participants =
    JSON.parse(
      giveaway.participants
    );

  const participate =
    new ButtonBuilder()
      .setCustomId(
        `giveaway_join:${giveaway.id}`
      )
      .setLabel('Participer')
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Primary);

  const leave =
    new ButtonBuilder()
      .setCustomId(
        `giveaway_leave:${giveaway.id}`
      )
      .setLabel('Quitter')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Secondary);

  return container({
    title: 'Giveaway',
    description:
      `## ${giveaway.prize}\n\n` +
      `**Gagnant(s) :** ${giveaway.winners}\n` +
      `**Participants :** ${participants.length}\n` +
      `**Fin :** <t:${Math.floor(giveaway.end_at / 1000)}:F>\n` +
      `**Temps restant :** <t:${Math.floor(giveaway.end_at / 1000)}:R>\n\n` +
      `**Rôle requis :** ${
        giveaway.required_role_id
          ? `<@&${giveaway.required_role_id}>`
          : 'Aucun'
      }\n\n` +
      'Utilise le bouton ci-dessous pour participer.',
    accent:
      0xFEE75C,
    components: [
      row(
        participate,
        leave
      )
    ],
    footer:
      `Bretagne RP • Giveaway #${giveaway.id}`
  });
}

async function updateGiveaway(
  giveaway
) {
  try {
    const channel =
      await client.channels.fetch(
        giveaway.channel_id
      );

    if (
      !channel?.isTextBased()
    ) {
      return;
    }

    const message =
      await channel.messages.fetch(
        giveaway.message_id
      );

    await message.edit(
      v2Message(
        buildGiveawayPanel(
          giveaway
        )
      )
    );
  } catch {}
}

async function finishGiveaway(
  giveawayId
) {
  const giveaway =
    db.prepare(`
      SELECT *
      FROM giveaways
      WHERE id = ?
    `).get(
      giveawayId
    );

  if (
    !giveaway ||
    giveaway.ended
  ) {
    return;
  }

  const participants =
    JSON.parse(
      giveaway.participants
    );

  const shuffled =
    [...participants];

  for (
    let i = shuffled.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      shuffled[i],
      shuffled[j]
    ] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  const winners =
    shuffled.slice(
      0,
      giveaway.winners
    );

  const winnerText =
    winners.length
      ? winners
          .map(id => `<@${id}>`)
          .join(', ')
      : 'Aucun gagnant';

  db.prepare(`
    UPDATE giveaways
    SET ended = 1
    WHERE id = ?
  `).run(
    giveawayId
  );

  const channel =
    await client.channels.fetch(
      giveaway.channel_id
    );

  if (
    channel?.isTextBased()
  ) {
    await channel.send(
      v2Message(
        container({
          title:
            'Giveaway terminé',
          description:
            `## ${giveaway.prize}\n\n` +
            `**Gagnant(s) :** ${winnerText}\n` +
            `**Participants :** ${participants.length}`,
          accent:
            0x57F287,
          footer:
            `Giveaway #${giveaway.id}`
        })
      )
    );
  }

  try {
    const original =
      await channel.messages.fetch(
        giveaway.message_id
      );

    await original.edit(
      v2Message(
        container({
          title:
            'Giveaway terminé',
          description:
            `## ${giveaway.prize}\n\n` +
            `**Gagnant(s) :** ${winnerText}\n` +
            `**Participants :** ${participants.length}`,
          accent:
            0x57F287,
          footer:
            `Giveaway #${giveaway.id}`
        })
      )
    );
  } catch {}
}

// ============================================================================
// SESSION
// ============================================================================

function buildSessionOpen(
  config,
  serverCode
) {
  return container({
    title:
      'Session RP ouverte',
    description:
      `## État du serveur\n\n` +
      `**Statut :** 🟢 Ouvert\n\n` +
      `**Code serveur :** \`${serverCode}\`\n\n` +
      'La session RP est officiellement ouverte.',
    accent:
      config.appearance.successColor,
    footer:
      `${config.serverName} • Session ouverte`
  });
}

function buildSessionClosed(
  config
) {
  return container({
    title:
      'Session RP fermée',
    description:
      `## État du serveur\n\n` +
      '**Statut :** 🔴 Fermé\n\n' +
      'La session RP est actuellement fermée.',
    accent:
      config.appearance.dangerColor,
    footer:
      `${config.serverName} • Session fermée`
  });
}

async function clearChannel(
  channel
) {
  while (true) {
    const messages =
      await channel.messages.fetch({
        limit: 100
      });

    if (!messages.size) {
      break;
    }

    const recent =
      messages.filter(
        message =>
          Date.now() -
          message.createdTimestamp <
          14 * 24 * 60 * 60 * 1000
      );

    const old =
      messages.filter(
        message =>
          Date.now() -
          message.createdTimestamp >=
          14 * 24 * 60 * 60 * 1000
      );

    if (recent.size) {
      try {
        await channel.bulkDelete(
          recent,
          true
        );
      } catch {
        for (
          const message of recent.values()
        ) {
          try {
            await message.delete();
          } catch {}
        }
      }
    }

    if (old.size) {
      for (
        const message of old.values()
      ) {
        try {
          await message.delete();
        } catch {}
      }
    }

    if (
      messages.size < 100
    ) {
      break;
    }
  }
}

// ============================================================================
// LOG
// ============================================================================

async function log(
  guild,
  title,
  description,
  accent = 0x5865F2
) {
  const config =
    getConfig(guild.id);

  if (!config.channels.logs) {
    return;
  }

  const channel =
    await getTextChannel(
      guild,
      config.channels.logs
    );

  if (!channel) {
    return;
  }

  try {
    await channel.send(
      v2Message(
        container({
          title,
          description,
          accent,
          footer:
            `${config.serverName} • Journal`
        })
      )
    );
  } catch {}
}

// ============================================================================
// COMMAND: /config
// ============================================================================

const configCommand =
  new SlashCommandBuilder()
    .setName('config')
    .setDescription(
      'Ouvrir le panneau de configuration de Bretagne RP'
    );

const commands = [
  configCommand,

  new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription(
      'Envoyer une suggestion'
    ),

  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription(
      'Créer un giveaway'
    )
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription(
          'Créer un giveaway'
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription(
              'Exemple : 30m, 2h, 1d'
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('prize')
            .setDescription(
              'Récompense'
            )
            .setRequired(true)
            .setMaxLength(300)
        )
        .addIntegerOption(option =>
          option
            .setName('winners')
            .setDescription(
              'Nombre de gagnants'
            )
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription(
              'Rôle requis pour participer'
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription(
          'Terminer un giveaway'
        )
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription(
              'ID du giveaway'
            )
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('session')
    .setDescription(
      'Gestion des sessions RP'
    )
    .addSubcommand(sub =>
      sub
        .setName('open')
        .setDescription(
          'Ouvrir une session RP'
        )
        .addStringOption(option =>
          option
            .setName('server-code')
            .setDescription(
              'Code du serveur'
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('shutdown')
        .setDescription(
          'Fermer la session RP'
        )
    )
];

// ============================================================================
// CONFIG UI
// ============================================================================

function buildConfigHome(
  config
) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        'config_category'
      )
      .setPlaceholder(
        'Choisir une catégorie...'
      )
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Salons')
          .setEmoji('📁')
          .setDescription(
            'Configurer les salons utilisés par le bot'
          )
          .setValue('channels'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Rôles')
          .setEmoji('👥')
          .setDescription(
            'Configurer les rôles'
          )
          .setValue('roles'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Sécurité')
          .setEmoji('🛡️')
          .setDescription(
            'Configurer les protections'
          )
          .setValue('security'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Candidatures')
          .setEmoji('📋')
          .setDescription(
            'Configurer les questions Staff'
          )
          .setValue('applications'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Tickets')
          .setEmoji('🎫')
          .setDescription(
            'Configurer les tickets'
          )
          .setValue('tickets'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Sessions RP')
          .setEmoji('🟢')
          .setDescription(
            'Configurer les sessions'
          )
          .setValue('sessions'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Systèmes')
          .setEmoji('⚙️')
          .setDescription(
            'Activer ou désactiver les fonctions'
          )
          .setValue('systems'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Apparence')
          .setEmoji('🎨')
          .setDescription(
            'Configurer les couleurs'
          )
          .setValue('appearance')
      );

  const refresh =
    new ButtonBuilder()
      .setCustomId(
        'config_refresh'
      )
      .setLabel('Actualiser')
      .setEmoji('↻')
      .setStyle(
        ButtonStyle.Secondary
      );

  return container({
    title:
      'Configuration de Bretagne RP',
    description:
      '## Centre de configuration\n\n' +
      'Bienvenue dans le panneau de configuration.\n\n' +
      'Tout est organisé par catégories. Sélectionne une catégorie dans le menu pour modifier les paramètres.\n\n' +
      `**Mode test :** ${config.testMode ? '🟢 Activé' : '🔴 Désactivé'}\n\n` +
      '-# Les restrictions seront activées plus tard lorsque le serveur de test sera prêt.',
    accent:
      config.appearance.accentColor,
    components: [
      {
        type: 'row',
        row:
          new ActionRowBuilder()
            .addComponents(menu)
      },
      row(refresh)
    ],
    footer:
      `${config.serverName} • Configuration`
  });
}

// ============================================================================
// CONFIG CATEGORY
// ============================================================================

function buildConfigCategory(
  config,
  category
) {
  let title = '';
  let description = '';
  let options = [];

  if (category === 'channels') {
    title =
      'Configuration • Salons';

    description =
      'Les salons utilisés actuellement par le bot.';

    options = [
      ['Salon bienvenue', 'channel_welcome'],
      ['Salon règlement', 'channel_rules'],
      ['Salon candidatures', 'channel_applications'],
      ['Salon suggestions', 'channel_suggestions'],
      ['Salon sessions', 'channel_sessions'],
      ['Salon logs', 'channel_logs'],
      ['Catégorie tickets', 'channel_ticket_category']
    ];
  }

  if (category === 'roles') {
    title =
      'Configuration • Rôles';

    description =
      'Les rôles principaux utilisés par Bretagne RP.';

    options = [
      ['Rôle vérifié', 'role_verified'],
      ['Rôle Staff', 'role_staff'],
      ['Rôle Support', 'role_support'],
      ['Rôle Configuration', 'role_config'],
      ['Rôle Giveaways', 'role_giveaways']
    ];
  }

  if (category === 'security') {
    title =
      'Configuration • Sécurité';

    description =
      'Configure les protections et les rôles bypass.';

    options = [
      ['Anti-raid', 'security_antiraid'],
      ['Anti-spam', 'security_antispam'],
      ['Mass mention', 'security_massmention'],
      ['Suppression massive', 'security_massdelete'],
      ['Mots interdits', 'security_badwords'],
      ['Ajouter un bypass', 'security_bypass_add']
    ];
  }

  if (category === 'applications') {
    title =
      'Configuration • Candidatures';

    description =
      `${config.applications.questions.length} question(s) actuellement configurée(s).`;

    options = [
      ['Liste des questions', 'app_questions'],
      ['Ajouter une question', 'app_add'],
      ['Supprimer une question', 'app_remove'],
      ['Rôle Staff après acceptation', 'app_role_toggle']
    ];
  }

  if (category === 'tickets') {
    title =
      'Configuration • Tickets';

    description =
      `Préfixe actuel : \`${config.tickets.prefix}\``;

    options = [
      ['Modifier le préfixe', 'ticket_prefix'],
      ['Suppression après fermeture', 'ticket_delete']
    ];
  }

  if (category === 'sessions') {
    title =
      'Configuration • Sessions';

    description =
      'Configure le comportement des sessions RP.';

    options = [
      ['Ping @everyone', 'session_ping'],
      ['Effacer le salon à la fermeture', 'session_clear']
    ];
  }

  if (category === 'systems') {
    title =
      'Configuration • Systèmes';

    description =
      'Active ou désactive les fonctions.';

    options = [
      ['Bienvenue', 'system_welcome'],
      ['Règlement', 'system_rules'],
      ['Candidatures', 'system_applications'],
      ['Giveaways', 'system_giveaways'],
      ['Tickets', 'system_tickets'],
      ['Suggestions', 'system_suggestions'],
      ['Sessions', 'system_sessions'],
      ['Sécurité', 'system_security']
    ];
  }

  if (category === 'appearance') {
    title =
      'Configuration • Apparence';

    description =
      'Configure l’accent visuel du bot.';

    options = [
      ['Changer la couleur principale', 'appearance_accent']
    ];
  }

  const select =
    new StringSelectMenuBuilder()
      .setCustomId(
        `config_option:${category}`
      )
      .setPlaceholder(
        'Choisir un paramètre...'
      )
      .addOptions(
        options.map(
          ([label, value]) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(label)
              .setValue(value)
        )
      );

  const back =
    new ButtonBuilder()
      .setCustomId(
        'config_back'
      )
      .setLabel('Retour')
      .setEmoji('←')
      .setStyle(
        ButtonStyle.Secondary
      );

  return container({
    title,
    description,
    accent:
      config.appearance.accentColor,
    components: [
      {
        type: 'row',
        row:
          new ActionRowBuilder()
            .addComponents(select)
      },
      row(back)
    ],
    footer:
      'Bretagne RP • Configuration'
  });
}

// ============================================================================
// REGISTER COMMANDS
// ============================================================================

async function registerCommands() {
  const rest =
    new REST({
      version: '10'
    }).setToken(
      TOKEN
    );

  const body =
    commands.map(
      command =>
        command.toJSON()
    );

  if (GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      { body }
    );

    console.log(
      `✅ Commandes enregistrées sur ${GUILD_ID}`
    );
  } else {
    await rest.put(
      Routes.applicationCommands(
        CLIENT_ID
      ),
      { body }
    );

    console.log(
      '✅ Commandes globales enregistrées'
    );
  }
}

// ============================================================================
// READY
// ============================================================================

client.once(
  Events.ClientReady,
  async ready => {
    console.log('');
    console.log(
      '══════════════════════════════════════════'
    );
    console.log(
      `✅ ${ready.user.tag} est connecté`
    );
    console.log(
      `🏠 Serveurs : ${ready.guilds.cache.size}`
    );
    console.log(
      '🧩 Components V2 : actif'
    );
    console.log(
      '🧠 SQLite : actif'
    );
    console.log(
      '🇫🇷 Bretagne RP : actif'
    );
    console.log(
      '══════════════════════════════════════════'
    );
    console.log('');

    await registerCommands();

    for (
      const guild of ready.guilds.cache.values()
    ) {
      try {
        await syncAllPanels(
          guild
        );

        console.log(
          `✅ Panels vérifiés : ${guild.name}`
        );
      } catch (error) {
        console.error(
          `❌ Panel error (${guild.name}):`,
          error.message
        );
      }
    }

    setInterval(
      processGiveaways,
      5000
    );
  }
);

// ============================================================================
// GIVEAWAY LOOP
// ============================================================================

async function processGiveaways() {
  const giveaways =
    db.prepare(`
      SELECT *
      FROM giveaways
      WHERE ended = 0
        AND end_at <= ?
    `).all(
      Date.now()
    );

  for (
    const giveaway of giveaways
  ) {
    await finishGiveaway(
      giveaway.id
    );
  }
}

// ============================================================================
// MEMBER JOIN
// ============================================================================

client.on(
  Events.GuildMemberAdd,
  async member => {
    await sendWelcome(
      member
    );

    const config =
      getConfig(
        member.guild.id
      );

    if (
      !config.systems.security ||
      !config.systems.antiRaid
    ) {
      return;
    }

    if (
      hasBypass(
        member,
        config,
        'antiRaid'
      )
    ) {
      return;
    }

    const key =
      member.guild.id;

    if (
      !raidTracker.has(key)
    ) {
      raidTracker.set(
        key,
        []
      );
    }

    const list =
      raidTracker.get(key);

    const now =
      Date.now();

    list.push(
      now
    );

    while (
      list.length &&
      now - list[0] >
        config.security.antiRaid.windowSeconds * 1000
    ) {
      list.shift();
    }

    if (
      list.length >=
      config.security.antiRaid.joinThreshold
    ) {
      await log(
        member.guild,
        'Détection anti-raid',
        `Une arrivée importante de membres a été détectée.\n\n` +
        `**Entrées dans la fenêtre :** ${list.length}`,
        0xED4245
      );
    }
  }
);

// ============================================================================
// MESSAGE SECURITY + APPLICATION DM
// ============================================================================

client.on(
  Events.MessageCreate,
  async message => {
    // ------------------------------------------------------------------------
    // DM
    // ------------------------------------------------------------------------

    if (!message.guild) {
      await handleApplicationMessage(
        message
      );

      return;
    }

    if (message.author.bot) {
      return;
    }

    const guild =
      message.guild;

    const member =
      message.member;

    const config =
      getConfig(
        guild.id
      );

    if (
      !config.systems.security
    ) {
      return;
    }

    // ------------------------------------------------------------------------
    // BAD WORDS
    // ------------------------------------------------------------------------

    if (
      config.systems.badWords &&
      !hasBypass(
        member,
        config,
        'badWords'
      )
    ) {
      const found =
        findBadWord(
          message.content,
          config
        );

      if (found) {
        try {
          await message.delete();
        } catch {}

        const result =
          await applyProgressiveTimeout(
            member,
            `Mot interdit détecté : ${found}`
          );

        if (result) {
          await log(
            guild,
            'Mot interdit détecté',
            `${member} a déclenché la modération automatique.\n\n` +
            `**Sanction :** ${formatDuration(result.seconds)}\n` +
            `**Niveau :** ${result.strike}`,
            0xED4245
          );
        }

        return;
      }
    }

    // ------------------------------------------------------------------------
    // MASS MENTION
    // ------------------------------------------------------------------------

    if (
      config.systems.antiMassMention &&
      !hasBypass(
        member,
        config,
        'antiMassMention'
      )
    ) {
      let count =
        message.mentions.users.size +
        message.mentions.roles.size;

      if (message.mentions.everyone) {
        count =
          Math.max(
            count,
            config.security.antiMassMention.threshold
          );
      }

      if (
        count >=
        config.security.antiMassMention.threshold
      ) {
        try {
          await message.delete();
        } catch {}

        const result =
          await applyProgressiveTimeout(
            member,
            'Mass mention détectée'
          );

        if (result) {
          await log(
            guild,
            'Mass mention bloquée',
            `${member} a été sanctionné pour une utilisation excessive des mentions.`,
            0xED4245
          );
        }

        return;
      }
    }

    // ------------------------------------------------------------------------
    // ANTI SPAM
    // ------------------------------------------------------------------------

    if (
      config.systems.antiSpam &&
      !hasBypass(
        member,
        config,
        'antiSpam'
      )
    ) {
      const key =
        `${guild.id}:${member.id}`;

      if (
        !spamTracker.has(key)
      ) {
        spamTracker.set(
          key,
          []
        );
      }

      const timestamps =
        spamTracker.get(key);

      const now =
        Date.now();

      timestamps.push(
        now
      );

      while (
        timestamps.length &&
        now - timestamps[0] >
          config.security.antiSpam.windowSeconds * 1000
      ) {
        timestamps.shift();
      }

      if (
        timestamps.length >=
        config.security.antiSpam.messageThreshold
      ) {
        try {
          await message.delete();
        } catch {}

        timestamps.length = 0;

        const result =
          await applyProgressiveTimeout(
            member,
            'Spam détecté'
          );

        if (result) {
          await log(
            guild,
            'Anti-spam déclenché',
            `${member} a été sanctionné automatiquement.\n\n` +
            `**Sanction :** ${formatDuration(result.seconds)}`,
            0xED4245
          );
        }
      }
    }
  }
);

// ============================================================================
// APPLICATION DM HANDLER
// ============================================================================

async function handleApplicationMessage(
  message
) {
  if (message.author.bot) {
    return;
  }

  const application =
    db.prepare(`
      SELECT *
      FROM applications
      WHERE user_id = ?
        AND status = 'collecting'
      ORDER BY id DESC
      LIMIT 1
    `).get(
      message.author.id
    );

  if (!application) {
    return;
  }

  const config =
    getConfig(
      application.guild_id
    );

  const questions =
    config.applications.questions;

  const answers =
    JSON.parse(
      application.answers
    );

  if (
    message.content.length > 1000
  ) {
    await message.author.send(
      v2Message(
        container({
          title: 'Réponse trop longue',
          description:
            'Ta réponse est limitée à 1000 caractères.\n\n' +
            'Envoie une réponse plus courte.',
          accent: 0xED4245
        })
      )
    );

    return;
  }

  answers.push(
    message.content
  );

  const nextIndex =
    application.question_index + 1;

  if (
    nextIndex >= questions.length
  ) {
    db.prepare(`
      UPDATE applications
      SET
        answers = ?,
        question_index = ?,
        status = 'pending'
      WHERE id = ?
    `).run(
      JSON.stringify(answers),
      nextIndex,
      application.id
    );

    await message.author.send(
      v2Message(
        container({
          title:
            'Candidature terminée',
          description:
            'Merci ! Tu as répondu à toutes les questions.\n\n' +
            'Ta candidature est maintenant envoyée au Staff.',
          accent:
            0x57F287
        })
      )
    );

    const updated =
      db.prepare(`
        SELECT *
        FROM applications
        WHERE id = ?
      `).get(
        application.id
      );

    await finalizeApplication(
      updated
    );

    return;
  }

  db.prepare(`
    UPDATE applications
    SET
      answers = ?,
      question_index = ?
    WHERE id = ?
  `).run(
    JSON.stringify(answers),
    nextIndex,
    application.id
  );

  const updated =
    db.prepare(`
      SELECT *
      FROM applications
      WHERE id = ?
    `).get(
      application.id
    );

  await askNextApplicationQuestion(
    updated
  );
}

// ============================================================================
// AUDIT LOG — MASS DELETE
// ============================================================================

client.on(
  Events.GuildAuditLogEntryCreate,
  async entry => {
    const guild =
      client.guilds.cache.get(
        entry.guild.id
      );

    if (!guild) {
      return;
    }

    const config =
      getConfig(
        guild.id
      );

    if (
      !config.systems.antiMassDelete
    ) {
      return;
    }

    if (
      !entry.action
    ) {
      return;
    }

    const count =
      Number(
        entry.extra?.count || 0
      );

    if (
      count <
      config.security.antiMassDelete.threshold
    ) {
      return;
    }

    const executorId =
      entry.executorId;

    if (!executorId) {
      return;
    }

    try {
      const member =
        await guild.members.fetch(
          executorId
        );

      if (
        member.permissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        return;
      }

      if (
        hasBypass(
          member,
          config,
          'antiMassDelete'
        )
      ) {
        return;
      }

      const result =
        await applyProgressiveTimeout(
          member,
          'Suppression massive de messages'
        );

      if (result) {
        await log(
          guild,
          'Suppression massive détectée',
          `${member} a déclenché la protection contre les suppressions massives.\n\n` +
          `**Messages concernés :** ${count}\n` +
          `**Sanction :** ${formatDuration(result.seconds)}`,
          0xED4245
        );
      }
    } catch {}
  }
);

// ============================================================================
// INTERACTIONS
// ============================================================================

client.on(
  Events.InteractionCreate,
  async interaction => {
    try {
      // ======================================================================
      // CHAT INPUT
      // ======================================================================

      if (
        interaction.isChatInputCommand()
      ) {
        // --------------------------------------------------------------------
        // CONFIG
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'config'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          return interaction.reply({
            flags:
              MessageFlags.IsComponentsV2,
            components: [
              buildConfigHome(
                config
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // SUGGESTION
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'suggestion'
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                'suggestion_modal'
              )
              .setTitle(
                'Nouvelle suggestion'
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                'suggestion_text'
              )
              .setLabel(
                'Ta suggestion'
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setPlaceholder(
                'Explique ton idée clairement...'
              )
              .setRequired(true)
              .setMaxLength(2000);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(
                input
              )
          );

          return interaction.showModal(
            modal
          );
        }

        // --------------------------------------------------------------------
        // GIVEAWAY
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'giveaway'
        ) {
          const subcommand =
            interaction.options
              .getSubcommand();

          if (
            subcommand ===
            'create'
          ) {
            const durationInput =
              interaction.options
                .getString(
                  'duration'
                );

            const prize =
              interaction.options
                .getString(
                  'prize'
                );

            const winners =
              interaction.options
                .getInteger(
                  'winners'
                );

            const role =
              interaction.options
                .getRole(
                  'role'
                );

            const durationMs =
              parseDuration(
                durationInput
              );

            if (
              !durationMs ||
              durationMs <
                getConfig(
                  interaction.guild.id
                ).giveaways
                  .minimumDurationSeconds *
                  1000
            ) {
              return interaction.reply({
                content:
                  '❌ Durée invalide. Exemple : `30m`, `2h`, `1d`.',
                flags:
                  MessageFlags.Ephemeral
              });
            }

            const endAt =
              Date.now() +
              durationMs;

            const result =
              db.prepare(`
                INSERT INTO giveaways (
                  guild_id,
                  channel_id,
                  message_id,
                  prize,
                  duration,
                  winners,
                  required_role_id,
                  end_at,
                  participants
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                interaction.guild.id,
                interaction.channel.id,
                'pending',
                prize,
                durationInput,
                winners,
                role?.id || null,
                endAt,
                JSON.stringify([])
              );

            const giveaway =
              db.prepare(`
                SELECT *
                FROM giveaways
                WHERE id = ?
              `).get(
                result.lastInsertRowid
              );

            const message =
              await interaction.channel.send(
                v2Message(
                  buildGiveawayPanel(
                    giveaway
                  )
                )
              );

            db.prepare(`
              UPDATE giveaways
              SET message_id = ?
              WHERE id = ?
            `).run(
              message.id,
              giveaway.id
            );

            return interaction.reply({
              content:
                `✅ Giveaway #${giveaway.id} créé.`,
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            subcommand ===
            'end'
          ) {
            const id =
              interaction.options
                .getInteger(
                  'id'
                );

            const giveaway =
              db.prepare(`
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
                flags:
                  MessageFlags.Ephemeral
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

            await finishGiveaway(
              id
            );

            return interaction.reply({
              content:
                '✅ Giveaway terminé.',
              flags:
                MessageFlags.Ephemeral
            });
          }
        }

        // --------------------------------------------------------------------
        // SESSION
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'session'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          const subcommand =
            interaction.options
              .getSubcommand();

          if (
            subcommand ===
            'open'
          ) {
            const serverCode =
              interaction.options
                .getString(
                  'server-code'
                );

            const existing =
              db.prepare(`
                SELECT *
                FROM sessions
                WHERE guild_id = ?
                  AND active = 1
              `).get(
                interaction.guild.id
              );

            if (existing) {
              return interaction.reply({
                content:
                  '❌ Une session est déjà ouverte.',
                flags:
                  MessageFlags.Ephemeral
              });
            }

            const channel =
              await getTextChannel(
                interaction.guild,
                config.channels.sessions
              ) ||
              interaction.channel;

            if (
              config.sessions.autoPingEveryone
            ) {
              await channel.send({
                content:
                  '@everyone',
                allowedMentions: {
                  parse: ['everyone']
                }
              });
            }

            await channel.send(
              v2Message(
                buildSessionOpen(
                  config,
                  serverCode
                )
              )
            );

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
              channel.id,
              serverCode,
              Date.now()
            );

            return interaction.reply({
              content:
                '✅ Session RP ouverte.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            subcommand ===
            'shutdown'
          ) {
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
                flags:
                  MessageFlags.Ephemeral
              });
            }

            const channel =
              await getTextChannel(
                interaction.guild,
                session.channel_id
              );

            if (!channel) {
              return interaction.reply({
                content:
                  '❌ Salon de session introuvable.',
                flags:
                  MessageFlags.Ephemeral
              });
            }

            if (
              config.sessions
                .clearOnShutdown
            ) {
              await clearChannel(
                channel
              );
            }

            await channel.send(
              v2Message(
                buildSessionClosed(
                  config
                )
              )
            );

            db.prepare(`
              UPDATE sessions
              SET active = 0
              WHERE guild_id = ?
            `).run(
              interaction.guild.id
            );

            return interaction.reply({
              content:
                '✅ Session RP fermée.',
              flags:
                MessageFlags.Ephemeral
            });
          }
        }
      }

      // ======================================================================
      // SELECT MENUS
      // ======================================================================

      if (
        interaction.isStringSelectMenu()
      ) {
        // --------------------------------------------------------------------
        // APPLICATION
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'application_menu'
        ) {
          if (
            interaction.values[0] ===
            'staff'
          ) {
            try {
              await startApplication(
                interaction.user,
                interaction.guild.id
              );

              return interaction.reply({
                content:
                  '✅ Je viens de t’envoyer un DM pour commencer ta candidature.',
                flags:
                  MessageFlags.Ephemeral
              });
            } catch {
              return interaction.reply({
                content:
                  '❌ Je ne peux pas t’envoyer de DM. Active tes messages privés puis réessaie.',
                flags:
                  MessageFlags.Ephemeral
              });
            }
          }
        }

        // --------------------------------------------------------------------
        // TICKET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'ticket_menu'
        ) {
          if (
            interaction.values[0] ===
            'open'
          ) {
            return createTicket(
              interaction
            );
          }
        }

        // --------------------------------------------------------------------
        // CONFIG HOME
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_category'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,
            components: [
              buildConfigCategory(
                config,
                interaction.values[0]
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG OPTIONS
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'config_option:'
          )
        ) {
          const category =
            interaction.customId
              .split(':')[1];

          const value =
            interaction.values[0];

          await handleConfigOption(
            interaction,
            category,
            value
          );

          return;
        }
      }

      // ======================================================================
      // BUTTONS
      // ======================================================================

      if (
        interaction.isButton()
      ) {
        // --------------------------------------------------------------------
        // CONFIG REFRESH
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_refresh'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,
            components: [
              buildConfigHome(
                config
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG BACK
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_back'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,
            components: [
              buildConfigHome(
                config
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // RULE ACCEPT
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'rules_accept'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            !config.roles.verified
          ) {
            return interaction.reply({
              content:
                '❌ Aucun rôle vérifié n’est configuré.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const role =
            await interaction.guild.roles
              .fetch(
                config.roles.verified
              )
              .catch(
                () => null
              );

          if (!role) {
            return interaction.reply({
              content:
                '❌ Le rôle configuré est introuvable.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          try {
            await interaction.member.roles.add(
              role,
              'Acceptation du règlement'
            );

            return interaction.reply({
              content:
                `✅ Règlement accepté. Tu as reçu ${role}.`,
              flags:
                MessageFlags.Ephemeral
            });
          } catch {
            return interaction.reply({
              content:
                '❌ Je ne peux pas attribuer ce rôle. Vérifie la position du rôle du bot.',
              flags:
                MessageFlags.Ephemeral
            });
          }
        }

        // --------------------------------------------------------------------
        // APPLICATION START
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'application_start:'
          )
        ) {
          const id =
            Number(
              interaction.customId
                .split(':')[1]
            );

          const application =
            db.prepare(`
              SELECT *
              FROM applications
              WHERE id = ?
                AND user_id = ?
                AND status = 'collecting'
            `).get(
              id,
              interaction.user.id
            );

          if (!application) {
            return interaction.reply({
              content:
                '❌ Cette candidature n’est plus disponible.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.update({
            flags:
              MessageFlags.IsComponentsV2,
            components: [
              container({
                title:
                  'Candidature démarrée',
                description:
                  'Très bien.\n\n' +
                  'Réponds à chaque question directement dans ce DM.',
                accent:
                  0x57F287
              })
            ]
          });

          await askNextApplicationQuestion(
            application
          );

          return;
        }

        // --------------------------------------------------------------------
        // APPLICATION DECISION
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'application_accept:'
          ) ||
          interaction.customId.startsWith(
            'application_refuse:'
          )
        ) {
          const accepted =
            interaction.customId.startsWith(
              'application_accept:'
            );

          const id =
            Number(
              interaction.customId
                .split(':')[1]
            );

          const modal =
            new ModalBuilder()
              .setCustomId(
                `application_decision:${accepted ? 'accept' : 'refuse'}:${id}`
              )
              .setTitle(
                accepted
                  ? 'Accepter la candidature'
                  : 'Refuser la candidature'
              );

          const reason =
            new TextInputBuilder()
              .setCustomId(
                'decision_reason'
              )
              .setLabel(
                'Raison'
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setPlaceholder(
                'Explique la décision...'
              )
              .setRequired(true)
              .setMaxLength(1000);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(
                reason
              )
          );

          return interaction.showModal(
            modal
          );
        }

        // --------------------------------------------------------------------
        // GIVEAWAY JOIN
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'giveaway_join:'
          )
        ) {
          const id =
            Number(
              interaction.customId
                .split(':')[1]
            );

          const giveaway =
            db.prepare(`
              SELECT *
              FROM giveaways
              WHERE id = ?
            `).get(id);

          if (
            !giveaway ||
            giveaway.ended
          ) {
            return interaction.reply({
              content:
                '❌ Ce giveaway est terminé.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            giveaway.end_at <=
            Date.now()
          ) {
            await finishGiveaway(
              giveaway.id
            );

            return interaction.reply({
              content:
                '❌ Ce giveaway vient de se terminer.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const member =
            interaction.member;

          if (
            giveaway.required_role_id &&
            !member.roles.cache.has(
              giveaway.required_role_id
            )
          ) {
            return interaction.reply({
              content:
                `❌ Tu dois avoir <@&${giveaway.required_role_id}> pour participer.`,
              flags:
                MessageFlags.Ephemeral
            });
          }

          const participants =
            JSON.parse(
              giveaway.participants
            );

          if (
            participants.includes(
              interaction.user.id
            )
          ) {
            return interaction.reply({
              content:
                '⚠️ Tu participes déjà à ce giveaway. Utilise **Quitter** pour te retirer.',
              flags:
                MessageFlags.Ephemeral
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
            JSON.stringify(
              participants
            ),
            id
          );

          const updated =
            db.prepare(`
              SELECT *
              FROM giveaways
              WHERE id = ?
            `).get(id);

          await updateGiveaway(
            updated
          );

          return interaction.reply({
            content:
              '🎉 Tu participes maintenant au giveaway !',
            flags:
              MessageFlags.Ephemeral
          });
        }

        // --------------------------------------------------------------------
        // GIVEAWAY LEAVE
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'giveaway_leave:'
          )
        ) {
          const id =
            Number(
              interaction.customId
                .split(':')[1]
            );

          const confirm =
            new ButtonBuilder()
              .setCustomId(
                `giveaway_confirm_leave:${id}`
              )
              .setLabel(
                'Oui, quitter'
              )
              .setStyle(
                ButtonStyle.Danger
              );

          return v2Reply(
            interaction,
            container({
              title:
                'Quitter le giveaway ?',
              description:
                'Tu participes actuellement à ce giveaway.\n\n' +
                'Veux-tu vraiment retirer ta participation ?',
              accent:
                0xED4245,
              components: [
                row(confirm)
              ],
              footer:
                'Cette confirmation est visible uniquement par toi.'
            }),
            true
          );
        }

        if (
          interaction.customId.startsWith(
            'giveaway_confirm_leave:'
          )
        ) {
          const id =
            Number(
              interaction.customId
                .split(':')[1]
            );

          const giveaway =
            db.prepare(`
              SELECT *
              FROM giveaways
              WHERE id = ?
            `).get(id);

          if (!giveaway) {
            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2 |
                MessageFlags.Ephemeral,
              components: [
                container({
                  title:
                    'Giveaway introuvable',
                  description:
                    'Ce giveaway n’existe plus.',
                  accent:
                    0xED4245
                })
              ]
            });
          }

          const participants =
            JSON.parse(
              giveaway.participants
            )
              .filter(
                userId =>
                  userId !==
                  interaction.user.id
              );

          db.prepare(`
            UPDATE giveaways
            SET participants = ?
            WHERE id = ?
          `).run(
            JSON.stringify(
              participants
            ),
            id
          );

          const updated =
            db.prepare(`
              SELECT *
              FROM giveaways
              WHERE id = ?
            `).get(id);

          await updateGiveaway(
            updated
          );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2 |
              MessageFlags.Ephemeral,
            components: [
              container({
                title:
                  'Participation retirée',
                description:
                  'Tu as quitté le giveaway avec succès.',
                accent:
                  0x57F287
              })
            ]
          });
        }

        // --------------------------------------------------------------------
        // TICKET CLOSE
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'ticket_close'
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
              flags:
                MessageFlags.Ephemeral
            });
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          const isOwner =
            ticket.user_id ===
            interaction.user.id;

          const isSupport =
            config.roles.ticketSupport &&
            interaction.member.roles.cache.has(
              config.roles.ticketSupport
            );

          if (
            !isOwner &&
            !isSupport &&
            !interaction.member.permissions.has(
              PermissionFlagsBits.ManageChannels
            )
          ) {
            return interaction.reply({
              content:
                '❌ Tu ne peux pas fermer ce ticket.',
              flags:
                MessageFlags.Ephemeral
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
              '🔒 Ticket fermé.',
            flags:
              MessageFlags.Ephemeral
          });

          if (
            config.tickets.deleteAfterClose
          ) {
            setTimeout(
              () =>
                interaction.channel
                  .delete()
                  .catch(
                    () => {}
                  ),
              1000
            );
          }

          return;
        }

        // --------------------------------------------------------------------
        // SUGGESTION BUTTON
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'suggestion_create'
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                'suggestion_modal'
              )
              .setTitle(
                'Nouvelle suggestion'
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                'suggestion_text'
              )
              .setLabel(
                'Ta suggestion'
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setPlaceholder(
                'Explique ton idée...'
              )
              .setRequired(true)
              .setMaxLength(2000);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(
                input
              )
          );

          return interaction.showModal(
            modal
          );
        }
      }

      // ======================================================================
      // MODALS
      // ======================================================================

      if (
        interaction.isModalSubmit()
      ) {
        // --------------------------------------------------------------------
        // APPLICATION DECISION
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'application_decision:'
          )
        ) {
          const parts =
            interaction.customId.split(':');

          const action =
            parts[1];

          const applicationId =
            Number(parts[2]);

          const reason =
            interaction.fields.getTextInputValue(
              'decision_reason'
            );

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

          if (
            !application ||
            application.status !==
              'pending'
          ) {
            return interaction.reply({
              content:
                '❌ Cette candidature n’est plus disponible.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const accepted =
            action === 'accept';

          db.prepare(`
            UPDATE applications
            SET
              status = ?,
              decided_at = ?,
              decided_by = ?,
              reason = ?
            WHERE id = ?
          `).run(
            accepted
              ? 'accepted'
              : 'refused',
            Date.now(),
            interaction.user.id,
            reason,
            applicationId
          );

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            accepted &&
            config.applications
              .giveStaffRoleOnAccept &&
            config.roles.staff
          ) {
            const member =
              await interaction.guild.members
                .fetch(
                  application.user_id
                )
                .catch(
                  () => null
                );

            if (member) {
              await member.roles
                .add(
                  config.roles.staff,
                  'Candidature Staff acceptée'
                )
                .catch(
                  () => {}
                );
            }
          }

          if (
            application.log_channel_id &&
            application.log_message_id
          ) {
            try {
              const channel =
                await getTextChannel(
                  interaction.guild,
                  application.log_channel_id
                );

              const message =
                await channel.messages.fetch(
                  application.log_message_id
                );

              await message.edit(
                v2Message(
                  container({
                    title:
                      accepted
                        ? `Candidature #${applicationId} acceptée`
                        : `Candidature #${applicationId} refusée`,
                    description:
                      `**Candidat :** <@${application.user_id}>\n` +
                      `**Traité par :** ${interaction.user}\n` +
                      `**Raison :** ${reason}\n\n` +
                      `**Statut :** ${
                        accepted
                          ? '✅ Acceptée'
                          : '❌ Refusée'
                      }`,
                    accent:
                      accepted
                        ? 0x57F287
                        : 0xED4245,
                    footer:
                      `${config.serverName} • Candidature traitée`
                  })
                )
              );
            } catch {}
          }

          try {
            const user =
              await client.users.fetch(
                application.user_id
              );

            await user.send(
              v2Message(
                container({
                  title:
                    accepted
                      ? 'Candidature acceptée'
                      : 'Candidature refusée',
                  description:
                    accepted
                      ? `Félicitations ! Ta candidature Staff sur **${config.serverName}** a été acceptée.\n\n` +
                        `**Raison :** ${reason}`
                      : `Ta candidature Staff sur **${config.serverName}** a été refusée.\n\n` +
                        `**Raison :** ${reason}`,
                  accent:
                    accepted
                      ? 0x57F287
                      : 0xED4245
                })
              )
            );
          } catch {}

          return interaction.reply({
            content:
              accepted
                ? '✅ Candidature acceptée et candidat averti.'
                : '✅ Candidature refusée et candidat averti.',
            flags:
              MessageFlags.Ephemeral
          });
        }

        // --------------------------------------------------------------------
        // SUGGESTION MODAL
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'suggestion_modal'
        ) {
          const text =
            interaction.fields.getTextInputValue(
              'suggestion_text'
            );

          const config =
            getConfig(
              interaction.guild.id
            );

          const channel =
            await getTextChannel(
              interaction.guild,
              config.channels.suggestions
            );

          if (!channel) {
            return interaction.reply({
              content:
                '❌ Le salon des suggestions est introuvable.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const result =
            db.prepare(`
              INSERT INTO suggestions (
                guild_id,
                channel_id,
                message_id,
                user_id,
                text,
                created_at
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              interaction.guild.id,
              channel.id,
              'pending',
              interaction.user.id,
              text,
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

          const up =
            new ButtonBuilder()
              .setCustomId(
                `suggestion_up:${suggestion.id}`
              )
              .setLabel('Pour 0')
              .setEmoji('👍')
              .setStyle(
                ButtonStyle.Success
              );

          const down =
            new ButtonBuilder()
              .setCustomId(
                `suggestion_down:${suggestion.id}`
              )
              .setLabel('Contre 0')
              .setEmoji('👎')
              .setStyle(
                ButtonStyle.Danger
              );

          const message =
            await channel.send(
              v2Message(
                container({
                  title:
                    `Suggestion #${suggestion.id}`,
                  description:
                    `**Auteur :** <@${suggestion.user_id}>\n\n` +
                    text +
                    '\n\n' +
                    '**Statut :** 🕐 En attente',
                  accent:
                    0xFEE75C,
                  components: [
                    row(
                      up,
                      down
                    )
                  ],
                  footer:
                    `${config.serverName} • Suggestions`
                })
              )
            );

          db.prepare(`
            UPDATE suggestions
            SET message_id = ?
            WHERE id = ?
          `).run(
            message.id,
            suggestion.id
          );

          return interaction.reply({
            content:
              `✅ Suggestion envoyée dans ${channel}.`,
            flags:
              MessageFlags.Ephemeral
          });
        }
      }
    } catch (error) {
      console.error(
        'Interaction error:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        try {
          await interaction.reply({
            content:
              '❌ Une erreur est survenue.',
            flags:
              MessageFlags.Ephemeral
          });
        } catch {}
      }
    }
  }
);

// ============================================================================
// CONFIG OPTION HANDLER
// ============================================================================

async function handleConfigOption(
  interaction,
  category,
  value
) {
  const config =
    getConfig(
      interaction.guild.id
    );

  // --------------------------------------------------------------------------
  // CHANNEL PICKER
  // --------------------------------------------------------------------------

  const channelMap = {
    channel_welcome:
      'channels.welcome',

    channel_rules:
      'channels.rules',

    channel_applications:
      'channels.applicationLogs',

    channel_suggestions:
      'channels.suggestions',

    channel_sessions:
      'channels.sessions',

    channel_logs:
      'channels.logs',

    channel_ticket_category:
      'channels.ticketCategory'
  };

  if (
    channelMap[value]
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          `config_channel_modal:${channelMap[value]}`
        )
        .setTitle(
          'Modifier un salon'
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          'channel_id'
        )
        .setLabel(
          'ID du salon'
        )
        .setPlaceholder(
          'Ex: 123456789012345678'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(
          input
        )
    );

    return interaction.showModal(
      modal
    );
  }

  // --------------------------------------------------------------------------
  // ROLE PICKER
  // --------------------------------------------------------------------------

  const roleMap = {
    role_verified:
      'roles.verified',

    role_staff:
      'roles.staff',

    role_support:
      'roles.ticketSupport',

    role_config:
      'roles.config',

    role_giveaways:
      'roles.giveaways'
  };

  if (
    roleMap[value]
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          `config_role_modal:${roleMap[value]}`
        )
        .setTitle(
          'Modifier un rôle'
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          'role_id'
        )
        .setLabel(
          'ID du rôle'
        )
        .setPlaceholder(
          'Ex: 123456789012345678'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(
          input
        )
    );

    return interaction.showModal(
      modal
    );
  }

  // --------------------------------------------------------------------------
  // TOGGLES
  // --------------------------------------------------------------------------

  const toggleMap = {
    system_welcome:
      'systems.welcome',

    system_rules:
      'systems.rules',

    system_applications:
      'systems.applications',

    system_giveaways:
      'systems.giveaways',

    system_tickets:
      'systems.tickets',

    system_suggestions:
      'systems.suggestions',

    system_sessions:
      'systems.sessions',

    system_security:
      'systems.security',

    security_antiraid:
      'systems.antiRaid',

    security_antispam:
      'systems.antiSpam',

    security_massmention:
      'systems.antiMassMention',

    security_massdelete:
      'systems.antiMassDelete',

    security_badwords:
      'systems.badWords',

    session_ping:
      'sessions.autoPingEveryone',

    session_clear:
      'sessions.clearOnShutdown',

    ticket_delete:
      'tickets.deleteAfterClose',

    app_role_toggle:
      'applications.giveStaffRoleOnAccept'
  };

  if (
    toggleMap[value]
  ) {
    const path =
      toggleMap[value];

    const current =
      getNested(
        config,
        path
      );

    setNested(
      config,
      path,
      !current
    );

    saveConfig(
      interaction.guild.id,
      config
    );

    await interaction.update({
      flags:
        MessageFlags.IsComponentsV2,
      components: [
        buildConfigCategory(
          config,
          category
        )
      ]
    });

    return;
  }

  // --------------------------------------------------------------------------
  // APPLICATION QUESTIONS
  // --------------------------------------------------------------------------

  if (
    value === 'app_questions'
  ) {
    const text =
      config.applications.questions
        .map(
          (question, index) =>
            `**${index + 1}.** ${question}`
        )
        .join('\n');

    return interaction.update({
      flags:
        MessageFlags.IsComponentsV2,
      components: [
        container({
          title:
            'Questions de candidature',
          description:
            text ||
            'Aucune question.',
          accent:
            config.appearance.accentColor
        })
      ]
    });
  }

  if (
    value === 'app_add'
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          'config_add_question'
        )
        .setTitle(
          'Ajouter une question'
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          'question'
        )
        .setLabel(
          'Question'
        )
        .setStyle(
          TextInputStyle.Paragraph
        )
        .setRequired(true)
        .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(
          input
        )
    );

    return interaction.showModal(
      modal
    );
  }

  if (
    value === 'app_remove'
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          'config_remove_question'
        )
        .setTitle(
          'Supprimer une question'
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          'index'
        )
        .setLabel(
          'Numéro de la question'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(true)
        .setPlaceholder(
          'Ex: 3'
        );

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(
          input
        )
    );

    return interaction.showModal(
      modal
    );
  }

  // --------------------------------------------------------------------------
  // TICKET PREFIX
  // --------------------------------------------------------------------------

  if (
    value === 'ticket_prefix'
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          'config_ticket_prefix'
        )
        .setTitle(
          'Préfixe des tickets'
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          'prefix'
        )
        .setLabel(
          'Préfixe'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(true)
        .setMaxLength(20);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(
          input
        )
    );

    return interaction.showModal(
      modal
    );
  }

  // --------------------------------------------------------------------------
  // APPEARANCE
  // --------------------------------------------------------------------------

  if (
    value === 'appearance_accent'
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          'config_accent'
        )
        .setTitle(
          'Couleur principale'
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          'hex'
        )
        .setLabel(
          'Couleur HEX'
        )
        .setPlaceholder(
          '#5865F2'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(
          input
        )
    );

    return interaction.showModal(
      modal
    );
  }

  // --------------------------------------------------------------------------
  // BYPASS
  // --------------------------------------------------------------------------

  if (
    value === 'security_bypass_add'
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          'config_bypass'
        )
        .setTitle(
          'Ajouter un rôle bypass'
        );

    const system =
      new TextInputBuilder()
        .setCustomId(
          'system'
        )
        .setLabel(
          'Système'
        )
        .setPlaceholder(
          'badWords / antiSpam / antiRaid / etc.'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(true);

    const role =
      new TextInputBuilder()
        .setCustomId(
          'role'
        )
        .setLabel(
          'ID du rôle'
        )
        .setPlaceholder(
          '123456789012345678'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(
          system
        ),
      new ActionRowBuilder()
        .addComponents(
          role
        )
    );

    return interaction.showModal(
      modal
    );
  }

  return interaction.update({
    flags:
      MessageFlags.IsComponentsV2,
    components: [
      buildConfigCategory(
        config,
        category
      )
    ]
  });
}

// ============================================================================
// CONFIG MODALS
// ============================================================================

client.on(
  Events.InteractionCreate,
  async interaction => {
    if (
      !interaction.isModalSubmit()
    ) {
      return;
    }

    try {
      const config =
        getConfig(
          interaction.guild.id
        );

      // ----------------------------------------------------------------------
      // CHANNEL
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'config_channel_modal:'
        )
      ) {
        const path =
          interaction.customId
            .split(':')[1];

        const value =
          interaction.fields
            .getTextInputValue(
              'channel_id'
            )
            .trim();

        setNested(
          config,
          path,
          value || null
        );

        saveConfig(
          interaction.guild.id,
          config
        );

        await interaction.reply({
          content:
            '✅ Salon enregistré. Les panneaux seront synchronisés automatiquement.',
          flags:
            MessageFlags.Ephemeral
        });

        await syncAllPanels(
          interaction.guild
        );

        return;
      }

      // ----------------------------------------------------------------------
      // ROLE
      // ----------------------------------------------------------------------

      if (
        interaction.customId.startsWith(
          'config_role_modal:'
        )
      ) {
        const path =
          interaction.customId
            .split(':')[1];

        const value =
          interaction.fields
            .getTextInputValue(
              'role_id'
            )
            .trim();

        setNested(
          config,
          path,
          value || null
        );

        saveConfig(
          interaction.guild.id,
          config
        );

        return interaction.reply({
          content:
            '✅ Rôle enregistré.',
          flags:
            MessageFlags.Ephemeral
        });
      }

      // ----------------------------------------------------------------------
      // QUESTION ADD
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'config_add_question'
      ) {
        const question =
          interaction.fields
            .getTextInputValue(
              'question'
            )
            .trim();

        config.applications.questions.push(
          question
        );

        saveConfig(
          interaction.guild.id,
          config
        );

        return interaction.reply({
          content:
            '✅ Question ajoutée.',
          flags:
            MessageFlags.Ephemeral
        });
      }

      // ----------------------------------------------------------------------
      // QUESTION REMOVE
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'config_remove_question'
      ) {
        const index =
          Number(
            interaction.fields
              .getTextInputValue(
                'index'
              )
          ) - 1;

        if (
          !Number.isInteger(index) ||
          !config.applications.questions[index]
        ) {
          return interaction.reply({
            content:
              '❌ Numéro de question invalide.',
            flags:
              MessageFlags.Ephemeral
          });
        }

        config.applications.questions.splice(
          index,
          1
        );

        saveConfig(
          interaction.guild.id,
          config
        );

        return interaction.reply({
          content:
            '✅ Question supprimée.',
          flags:
            MessageFlags.Ephemeral
        });
      }

      // ----------------------------------------------------------------------
      // TICKET PREFIX
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'config_ticket_prefix'
      ) {
        const prefix =
          interaction.fields
            .getTextInputValue(
              'prefix'
            )
            .trim();

        config.tickets.prefix =
          prefix || 'ticket';

        saveConfig(
          interaction.guild.id,
          config
        );

        return interaction.reply({
          content:
            `✅ Préfixe changé en \`${config.tickets.prefix}\`.`,
          flags:
            MessageFlags.Ephemeral
        });
      }

      // ----------------------------------------------------------------------
      // ACCENT
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'config_accent'
      ) {
        const hex =
          interaction.fields
            .getTextInputValue(
              'hex'
            )
            .trim()
            .replace(
              '#',
              ''
            );

        if (
          !/^[0-9a-fA-F]{6}$/.test(
            hex
          )
        ) {
          return interaction.reply({
            content:
              '❌ Couleur invalide. Exemple : `#5865F2`.',
            flags:
              MessageFlags.Ephemeral
          });
        }

        config.appearance.accentColor =
          parseInt(
            hex,
            16
          );

        saveConfig(
          interaction.guild.id,
          config
        );

        return interaction.reply({
          content:
            `✅ Couleur principale définie sur \`#${hex.toUpperCase()}\`.`,
          flags:
            MessageFlags.Ephemeral
        });
      }

      // ----------------------------------------------------------------------
      // BYPASS
      // ----------------------------------------------------------------------

      if (
        interaction.customId ===
        'config_bypass'
      ) {
        const system =
          interaction.fields
            .getTextInputValue(
              'system'
            )
            .trim();

        const role =
          interaction.fields
            .getTextInputValue(
              'role'
            )
            .trim();

        const validSystems = [
          'badWords',
          'antiSpam',
          'antiRaid',
          'antiMassMention',
          'antiMassDelete',
          'tickets',
          'applications',
          'giveaways',
          'sessions'
        ];

        if (
          !validSystems.includes(
            system
          )
        ) {
          return interaction.reply({
            content:
              '❌ Système invalide.',
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          !config.bypassRoles[system]
        ) {
          config.bypassRoles[system] =
            [];
        }

        if (
          !config.bypassRoles[system]
            .includes(role)
        ) {
          config.bypassRoles[system]
            .push(role);
        }

        saveConfig(
          interaction.guild.id,
          config
        );

        return interaction.reply({
          content:
            `✅ Le rôle \`${role}\` peut maintenant bypass \`${system}\`.`,
          flags:
            MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      console.error(
        'Config modal error:',
        error
      );
    }
  }
);

// ============================================================================
// ERROR HANDLERS
// ============================================================================

client.on(
  Events.Error,
  error => {
    console.error(
      'Discord client error:',
      error
    );
  }
);

process.on(
  'unhandledRejection',
  error => {
    console.error(
      'Unhandled rejection:',
      error
    );
  }
);

process.on(
  'uncaughtException',
  error => {
    console.error(
      'Uncaught exception:',
      error
    );
  }
);

// ============================================================================
// LOGIN
// ============================================================================

client.login(
  TOKEN
);
