'use strict';

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ActivityType,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  AuditLogEvent
} = require('discord.js');

const Database = require('better-sqlite3');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN ou CLIENT_ID manquant.');
  process.exit(1);
}

const db = new Database('./bretagne-rp.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS configs (
  guild_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS panels (
  guild_id TEXT NOT NULL,
  panel_key TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  PRIMARY KEY (guild_id,panel_key)
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
  winners_count INTEGER NOT NULL DEFAULT 1,
  required_role_id TEXT,
  end_at INTEGER NOT NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  current_winner_id TEXT,
  claim_deadline INTEGER,
  claim_round INTEGER NOT NULL DEFAULT 0,
  expired_winners TEXT NOT NULL DEFAULT '[]',
  announcement_message_id TEXT,
  claim_ticket_channel_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'support',
  giveaway_id INTEGER,
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

CREATE TABLE IF NOT EXISTS sanctions (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  day_key TEXT NOT NULL,
  strikes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(guild_id,user_id)
);
`);

function hasColumn(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some(x => x.name === column);
}

function ensureColumn(table, column, def) {
  if (!hasColumn(table, column)) {
    db.exec(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${def}`
    );
  }
}

ensureColumn(
  'giveaways',
  'status',
  "TEXT NOT NULL DEFAULT 'active'"
);

ensureColumn(
  'giveaways',
  'current_winner_id',
  'TEXT'
);

ensureColumn(
  'giveaways',
  'claim_deadline',
  'INTEGER'
);

ensureColumn(
  'giveaways',
  'claim_round',
  'INTEGER NOT NULL DEFAULT 0'
);

ensureColumn(
  'giveaways',
  'expired_winners',
  "TEXT NOT NULL DEFAULT '[]'"
);

ensureColumn(
  'giveaways',
  'announcement_message_id',
  'TEXT'
);

ensureColumn(
  'giveaways',
  'claim_ticket_channel_id',
  'TEXT'
);

ensureColumn(
  'giveaways',
  'claim_ticket_opened_at',
  'INTEGER'
);

ensureColumn(
  'tickets',
  'type',
  "TEXT NOT NULL DEFAULT 'support'"
);

ensureColumn(
  'tickets',
  'giveaway_id',
  'INTEGER'
);

const DEFAULT_CONFIG = {
  serverName: 'Bretagne RP',

  /*
   * TEST MODE
   *
   * true:
   * config roles are saved but not enforced.
   *
   * false:
   * role restrictions are enforced.
   */
  testMode: true,

  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    danger: 0xED4245,
    warning: 0xFEE75C,
    neutral: 0x5865F2
  },

  channels: {
    welcome: '1548280111890042891',
    rules: '1548280076377006220',
    applicationLogs: '1548280161622040687',
    suggestions: '1548280159948251190',

    sessions: null,
    logs: null,
    ticketPanel: null,

    ticketCategorySupport: null,
    ticketCategoryClaim: null
  },

  roles: {
    verified: '1548280026842005594',

    staff: null,

    config: '1548279987453296643',

    giveaways: '1548279987453296643',

    ticketSupport: '1548279987453296643'
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

  applications: {
    questions: [
      'Quel âge avez-vous ?',
      'Depuis combien de temps êtes-vous sur Bretagne RP ?',
      'Pourquoi souhaitez-vous rejoindre le Staff ?',
      'Avez-vous déjà eu une expérience en modération ?',
      'Quelles sont vos qualités pour ce poste ?',
      'Pourquoi devrions-nous vous accepter ?'
    ],

    giveStaffRoleOnAccept: true
  },

  tickets: {
    prefix: 'ticket',

    deleteAfterClose: true,

    support: {
      label: 'Ouvrir un ticket',

      description:
        'Besoin d’aide ou d’assistance ?',

      emoji: '🎫',

      viewRoleIds: [
        '1548279987453296643'
      ],

      pingRoleIds: [
        '1548279987453296643'
      ]
    },

    claim: {
      label: 'Giveaway • Réclamation',

      description:
        'Réclamer un giveaway gagné.',

      emoji: '🏆',

      viewRoleIds: [
        '1548279987453296643'
      ],

      pingRoleIds: [
        '1548279987453296643'
      ]
    }
  },

  giveaways: {
    claimHours: 24,
    minimumDurationSeconds: 10
  },

  sessions: {
    pingEveryone: true,
    clearOnShutdown: true
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
    }
  },

  bypassRoles: {
    antiRaid: [],
    antiSpam: [],
    antiMassMention: [],
    antiMassDelete: [],
    badWords: []
  },

  customBadWords: []
};

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function merge(base, extra) {
  const output = clone(base);

  for (
    const [key, value] of Object.entries(
      extra || {}
    )
  ) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] =
        merge(
          output[key],
          value
        );
    } else {
      output[key] = value;
    }
  }

  return output;
}

function getConfig(guildId) {
  const row =
    db
      .prepare(
        'SELECT data FROM configs WHERE guild_id = ?'
      )
      .get(guildId);

  if (!row) {
    const config =
      clone(DEFAULT_CONFIG);

    saveConfig(
      guildId,
      config
    );

    return config;
  }

  try {
    return merge(
      DEFAULT_CONFIG,
      JSON.parse(
        row.data
      )
    );
  } catch {
    return clone(
      DEFAULT_CONFIG
    );
  }
}

function saveConfig(
  guildId,
  config
) {
  db.prepare(`
    INSERT INTO configs (
      guild_id,
      data
    )
    VALUES (?, ?)

    ON CONFLICT(guild_id)
    DO UPDATE SET
      data = excluded.data
  `).run(
    guildId,
    JSON.stringify(config)
  );
}

function getNested(
  object,
  path
) {
  return path
    .split('.')
    .reduce(
      (acc, key) =>
        acc?.[key],
      object
    );
}

function setNested(
  object,
  path,
  value
) {
  const parts =
    path.split('.');

  let current =
    object;

  for (
    let i = 0;
    i < parts.length - 1;
    i++
  ) {
    if (
      !current[parts[i]]
    ) {
      current[parts[i]] = {};
    }

    current =
      current[parts[i]];
  }

  current[
    parts[parts.length - 1]
  ] = value;
}

const client =
  new Client({
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

const spamMap =
  new Map();

const raidMap =
  new Map();

const BAD_WORDS =
  new Set([
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
    'stronzo',
    'stronza',
    'puttana',
    'bastardo',
    'vaffanculo',

    // Portuguese
    'caralho',
    'porra',
    'puta',
    'puto',

    // Dutch
    'klootzak',
    'hoer',
    'godverdomme',

    // Polish
    'kurwa',
    'chuj',
    'cipa',

    // Turkish
    'siktir',
    'orospu',
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
    'huora',

    // Czech
    'kurva',
    'kokot',
    'jebat',

    // Hungarian
    'kurva',
    'fasz',
    'geci',

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
    'شرموطة'
  ]);

function normalizeText(
  text
) {
  return String(text)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .replace(
      /[4@]/g,
      'a'
    )
    .replace(
      /3/g,
      'e'
    )
    .replace(
      /[1!]/g,
      'i'
    )
    .replace(
      /0/g,
      'o'
    )
    .replace(
      /[$5]/g,
      's'
    )
    .replace(
      /7/g,
      't'
    )
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function findBadWord(
  content,
  config
) {
  const words =
    new Set(
      normalizeText(
        content
      )
        .split(/\s+/)
        .filter(Boolean)
    );

  for (
    const word of BAD_WORDS
  ) {
    if (
      words.has(
        normalizeText(
          word
        )
      )
    ) {
      return word;
    }
  }

  for (
    const word of config.customBadWords ||
    []
  ) {
    if (
      words.has(
        normalizeText(
          word
        )
      )
    ) {
      return word;
    }
  }

  return null;
}

function parseDuration(
  input
) {
  const text =
    String(input)
      .toLowerCase()
      .replace(
        /\s+/g,
        ''
      );

  const regex =
    /(\d+)(s|m|h|d|w)/g;

  let total =
    0;

  let found =
    false;

  let match;

  while (
    (match =
      regex.exec(text))
  ) {
    found =
      true;

    const amount =
      Number(
        match[1]
      );

    const map = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
      w: 604800000
    };

    total +=
      amount *
      map[match[2]];
  }

  return found
    ? total
    : null;
}

function formatDuration(
  seconds
) {
  if (
    seconds < 60
  ) {
    return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
  }

  if (
    seconds < 3600
  ) {
    const minutes =
      Math.floor(
        seconds / 60
      );

    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  if (
    seconds < 86400
  ) {
    const hours =
      Math.floor(
        seconds / 3600
      );

    return `${hours} heure${hours > 1 ? 's' : ''}`;
  }

  const days =
    Math.floor(
      seconds / 86400
    );

  return `${days} jour${days > 1 ? 's' : ''}`;
}

function todayKey() {
  const date =
    new Date();

  return [
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ].join('-');
}

function bool(
  value
) {
  return value
    ? '🟢 Activé'
    : '🔴 Désactivé';
}

function roleList(
  roleIds
) {
  if (
    !roleIds ||
    !roleIds.length
  ) {
    return 'Aucun';
  }

  return roleIds
    .map(
      id =>
        `<@&${id}>`
    )
    .join(', ');
}

function makeContainer(
  title,
  description,
  accent,
  rows = [],
  footer = null
) {
  const container =
    new ContainerBuilder()
      .setAccentColor(
        accent
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `# ${title}`
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            description
          )
      );

  for (
    const row of rows
  ) {
    container.addActionRowComponents(
      row
    );
  }

  if (
    footer
  ) {
    container
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

  return container;
}

function v2(
  component,
  ephemeral = false
) {
  let flags =
    MessageFlags.IsComponentsV2;

  if (
    ephemeral
  ) {
    flags |=
      MessageFlags.Ephemeral;
  }

  return {
    flags,
    components: [
      component
    ]
  };
}

function replyText(
  interaction,
  text
) {
  return interaction.reply({
    content:
      text,
    flags:
      MessageFlags.Ephemeral
  });
}

async function fetchTextChannel(
  guild,
  channelId
) {
  if (
    !channelId
  ) {
    return null;
  }

  try {
    const channel =
      await guild.channels.fetch(
        channelId
      );

    return channel?.isTextBased()
      ? channel
      : null;
  } catch {
    return null;
  }
}

function hasBypass(
  member,
  config,
  key
) {
  return (
    config.bypassRoles[key] || []
  ).some(
    roleId =>
      member.roles.cache.has(
        roleId
      )
  );
}

function allowedByRole(
  interaction,
  roleId
) {
  const config =
    getConfig(
      interaction.guild.id
    );

  if (
    config.testMode
  ) {
    return true;
  }

  if (
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return true;
  }

  return Boolean(
    roleId &&
    interaction.member?.roles?.cache?.has(
      roleId
    )
  );
}

// ============================================================================
// PANEL STORAGE
// ============================================================================

function getPanel(
  guildId,
  key
) {
  return db
    .prepare(
      'SELECT * FROM panels WHERE guild_id=? AND panel_key=?'
    )
    .get(
      guildId,
      key
    );
}

function savePanel(
  guildId,
  key,
  channelId,
  messageId
) {
  db.prepare(`
    INSERT INTO panels (
      guild_id,
      panel_key,
      channel_id,
      message_id
    )
    VALUES (?, ?, ?, ?)

    ON CONFLICT(
      guild_id,
      panel_key
    )
    DO UPDATE SET
      channel_id = excluded.channel_id,
      message_id = excluded.message_id
  `).run(
    guildId,
    key,
    channelId,
    messageId
  );
}

function hasCustomId(
  value,
  target
) {
  if (
    Array.isArray(value)
  ) {
    return value.some(
      item =>
        hasCustomId(
          item,
          target
        )
    );
  }

  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false;
  }

  if (
    value.custom_id ===
      target ||
    value.customId ===
      target
  ) {
    return true;
  }

  return Object.values(
    value
  ).some(
    item =>
      hasCustomId(
        item,
        target
      )
  );
}

async function findExistingPanel(
  channel,
  customId
) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 100
      });

    return (
      messages.find(
        message =>
          hasCustomId(
            message.components,
            customId
          )
      ) || null
    );
  } catch {
    return null;
  }
}

async function upsertPanel(
  guild,
  key,
  channel,
  customId,
  builder
) {
  if (
    !channel
  ) {
    return;
  }

  let message =
    null;

  const stored =
    getPanel(
      guild.id,
      key
    );

  if (
    stored
  ) {
    try {
      const oldChannel =
        await fetchTextChannel(
          guild,
          stored.channel_id
        );

      if (
        oldChannel
      ) {
        message =
          await oldChannel.messages.fetch(
            stored.message_id
          );
      }
    } catch {}
  }

  if (
    !message
  ) {
    message =
      await findExistingPanel(
        channel,
        customId
      );
  }

  if (
    message
  ) {
    try {
      await message.edit(
        v2(
          builder()
        )
      );
    } catch {
      message =
        null;
    }
  }

  if (
    !message
  ) {
    message =
      await channel.send(
        v2(
          builder()
        )
      );
  }

  savePanel(
    guild.id,
    key,
    channel.id,
    message.id
  );
}

// ============================================================================
// RULES
// ============================================================================

function buildRulesPanel(
  config
) {
  const accept =
    new ButtonBuilder()
      .setCustomId(
        'rules_accept'
      )
      .setLabel(
        'J’accepte le règlement'
      )
      .setEmoji(
        '✅'
      )
      .setStyle(
        ButtonStyle.Success
      );

  const text = [
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
    '**Clique sur le bouton ci-dessous pour confirmer que tu as lu et accepté le règlement.**'
  ].join('\n');

  return makeContainer(
    'Règlement RP France',
    text,
    config.colors.success,
    [
      new ActionRowBuilder()
        .addComponents(
          accept
        )
    ],
    `${config.serverName} • Règlement`
  );
}

// ============================================================================
// APPLICATION PANEL
// ============================================================================

function buildApplicationPanel(
  config
) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        'application_menu'
      )
      .setPlaceholder(
        config.systems.applications
          ? 'Sélectionnez une option...'
          : 'Les candidatures sont fermées'
      )
      .setDisabled(
        !config.systems.applications
      )
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Candidature Staff'
          )
          .setDescription(
            config.systems.applications
              ? 'Commencer une candidature Staff'
              : 'Les candidatures sont actuellement fermées'
          )
          .setEmoji(
            '📋'
          )
          .setValue(
            'staff'
          )
      );

  const description =
    config.systems.applications
      ? [
          '## Rejoindre le Staff',
          '',
          `Tu souhaites rejoindre **${config.serverName}** ?`,
          '',
          'La candidature se déroule directement en DM avec le bot.',
          '',
          'Les questions sont envoyées une par une et chaque réponse est enregistrée.',
          '',
          'Choisis **Candidature Staff** pour commencer.'
        ].join('\n')
      : [
          '## Recrutement fermé',
          '',
          'Les candidatures Staff sont actuellement fermées.',
          '',
          'Le Staff peut les rouvrir depuis /config.'
        ].join('\n');

  return makeContainer(
    config.systems.applications
      ? 'Candidatures Staff'
      : 'Candidatures Staff • Fermées',

    description,

    config.systems.applications
      ? config.colors.primary
      : config.colors.danger,

    [
      new ActionRowBuilder()
        .addComponents(
          menu
        )
    ],

    `${config.serverName} • Recrutement`
  );
}

// ============================================================================
// TICKET PANEL
// ============================================================================

function buildTicketPanel(
  config
) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        'ticket_menu'
      )
      .setPlaceholder(
        config.systems.tickets
          ? 'Choisir le type de ticket...'
          : 'Tickets désactivés'
      )
      .setDisabled(
        !config.systems.tickets
      )
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(
            config.tickets.support.label
          )
          .setDescription(
            config.tickets.support.description
          )
          .setEmoji(
            config.tickets.support.emoji
          )
          .setValue(
            'support'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            config.tickets.claim.label
          )
          .setDescription(
            config.tickets.claim.description
          )
          .setEmoji(
            config.tickets.claim.emoji
          )
          .setValue(
            'claim'
          )
      );

  return makeContainer(
    config.systems.tickets
      ? 'Centre de support'
      : 'Centre de support • Fermé',

    config.systems.tickets
      ? [
          '## Assistance & réclamations',
          '',
          '**🎫 Support**',
          'Pour une question, un problème ou une demande générale.',
          '',
          '**🏆 Giveaway • Réclamation**',
          'Pour réclamer un giveaway gagné pendant sa période de réclamation.',
          '',
          'Les rôles visibles et les pings sont configurables.'
        ].join('\n')
      : '## Tickets fermés\n\nLe système de tickets est actuellement désactivé.',

    config.systems.tickets
      ? config.colors.primary
      : config.colors.danger,

    [
      new ActionRowBuilder()
        .addComponents(
          menu
        )
    ],

    `${config.serverName} • Support`
  );
}

// ============================================================================
// SUGGESTION PANEL
// ============================================================================

function buildSuggestionPanel(
  config
) {
  const button =
    new ButtonBuilder()
      .setCustomId(
        'suggestion_create'
      )
      .setLabel(
        'Créer une suggestion'
      )
      .setEmoji(
        '💡'
      )
      .setStyle(
        ButtonStyle.Primary
      )
      .setDisabled(
        !config.systems.suggestions
      );

  return makeContainer(
    'Suggestions',

    [
      '## Une idée pour Bretagne RP ?',
      '',
      'Propose une amélioration, une nouvelle fonctionnalité ou une idée RP.',
      '',
      'La communauté pourra ensuite voter pour ta proposition.',
      '',
      config.systems.suggestions
        ? 'Clique sur **Créer une suggestion** pour commencer.'
        : 'Les suggestions sont actuellement désactivées.'
    ].join('\n'),

    config.systems.suggestions
      ? config.colors.warning
      : config.colors.danger,

    [
      new ActionRowBuilder()
        .addComponents(
          button
        )
    ],

    `${config.serverName} • Suggestions`
  );
}

// ============================================================================
// AUTO PANEL SYNC
// ============================================================================

async function syncAllPanels(
  guild
) {
  const config =
    getConfig(
      guild.id
    );

  if (
    config.channels.rules
  ) {
    const channel =
      await fetchTextChannel(
        guild,
        config.channels.rules
      );

    if (
      channel
    ) {
      await upsertPanel(
        guild,
        'rules',
        channel,
        'rules_accept',
        () =>
          buildRulesPanel(
            config
          )
      );
    }
  }

  if (
    config.channels.applicationLogs
  ) {
    const channel =
      await fetchTextChannel(
        guild,
        config.channels.applicationLogs
      );

    if (
      channel
    ) {
      await upsertPanel(
        guild,
        'applications',
        channel,
        'application_menu',
        () =>
          buildApplicationPanel(
            config
          )
      );
    }
  }

  if (
    config.channels.suggestions
  ) {
    const channel =
      await fetchTextChannel(
        guild,
        config.channels.suggestions
      );

    if (
      channel
    ) {
      await upsertPanel(
        guild,
        'suggestions',
        channel,
        'suggestion_create',
        () =>
          buildSuggestionPanel(
            config
          )
      );
    }
  }

  let ticketChannel =
    await fetchTextChannel(
      guild,
      config.channels.ticketPanel
    );

  if (
    !ticketChannel
  ) {
    const saved =
      getPanel(
        guild.id,
        'tickets'
      );

    if (
      saved
    ) {
      ticketChannel =
        await fetchTextChannel(
          guild,
          saved.channel_id
        );
    }
  }

  if (
    !ticketChannel
  ) {
    ticketChannel =
      await fetchFallback(
        guild
      );
  }

  if (
    ticketChannel
  ) {
    await upsertPanel(
      guild,
      'tickets',
      ticketChannel,
      'ticket_menu',
      () =>
        buildTicketPanel(
          config
        )
    );
  }
}

async function fetchFallback(
  guild
) {
  const config =
    getConfig(
      guild.id
    );

  const channels = [
    guild.systemChannel,

    await fetchTextChannel(
      guild,
      config.channels.welcome
    ),

    await fetchTextChannel(
      guild,
      config.channels.suggestions
    )
  ];

  for (
    const channel of channels
  ) {
    if (
      channel?.isTextBased() &&
      channel
        .permissionsFor(
          guild.members.me
        )
        ?.has(
          PermissionFlagsBits.SendMessages
        )
    ) {
      return channel;
    }
  }

  return (
    guild.channels.cache.find(
      channel =>
        channel.type ===
          ChannelType.GuildText &&
        channel
          .permissionsFor(
            guild.members.me
          )
          ?.has(
            PermissionFlagsBits.SendMessages
          )
    ) || null
  );
}

// ============================================================================
// WELCOME
// ============================================================================

async function welcome(
  member
) {
  const config =
    getConfig(
      member.guild.id
    );

  if (
    !config.systems.welcome
  ) {
    return;
  }

  const channel =
    await fetchTextChannel(
      member.guild,
      config.channels.welcome
    );

  if (
    channel
  ) {
    await channel
      .send(
        v2(
          makeContainer(
            config.welcome?.title ||
              'Bienvenue sur Bretagne RP',

            `${member}\n\n${
              config.welcome?.message ||
              'Bienvenue sur Bretagne RP !'
            }`,

            config.colors.primary,

            [],

            `${config.serverName} • Nouveau membre`
          )
        )
      )
      .catch(
        () => {}
      );
  }

  await member.user
    .send(
      v2(
        makeContainer(
          'Bienvenue sur Bretagne RP',

          `Bienvenue sur **${config.serverName}** !\n\n` +
            'Rends-toi dans le salon du règlement et clique sur **J’accepte le règlement** pour obtenir ton accès.',

          config.colors.primary
        )
      )
    )
    .catch(
      () => {}
    );
}

// ============================================================================
// PROGRESSIVE SANCTIONS
// ============================================================================

const SANCTIONS = [
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

function strikes(
  guildId,
  userId
) {
  const row =
    db
      .prepare(
        'SELECT * FROM sanctions WHERE guild_id=? AND user_id=?'
      )
      .get(
        guildId,
        userId
      );

  if (
    !row
  ) {
    return 0;
  }

  return row.day_key ===
    todayKey()
    ? row.strikes
    : 0;
}

function addStrike(
  guildId,
  userId
) {
  const next =
    Math.min(
      strikes(
        guildId,
        userId
      ) + 1,
      SANCTIONS.length
    );

  db.prepare(`
    INSERT INTO sanctions (
      guild_id,
      user_id,
      day_key,
      strikes
    )
    VALUES (?, ?, ?, ?)

    ON CONFLICT(
      guild_id,
      user_id
    )
    DO UPDATE SET
      day_key = excluded.day_key,
      strikes = excluded.strikes
  `).run(
    guildId,
    userId,
    todayKey(),
    next
  );

  return next;
}

async function moderate(
  member,
  reason
) {
  if (
    !member?.moderatable
  ) {
    return null;
  }

  const strike =
    addStrike(
      member.guild.id,
      member.id
    );

  const seconds =
    SANCTIONS[
      strike - 1
    ];

  await member
    .timeout(
      seconds * 1000,
      reason
    )
    .catch(
      () => {}
    );

  await member.user
    .send(
      v2(
        makeContainer(
          'Sanction automatique',

          `Ton message a été supprimé automatiquement.\n\n` +
            `**Raison :** ${reason}\n\n` +
            `**Timeout :** ${formatDuration(seconds)}\n` +
            `**Niveau :** ${strike}\n\n` +
            'Le compteur de sanctions est réinitialisé à la fin de la journée.',

          0xED4245,

          [],

          `${member.guild.name} • Modération`
        )
      )
    )
    .catch(
      () => {}
    );

  return {
    strike,
    seconds
  };
}

// ============================================================================
// APPLICATIONS
// ============================================================================

async function startApplication(
  user,
  guildId
) {
  const config =
    getConfig(
      guildId
    );

  if (
    !config.systems.applications
  ) {
    throw new Error(
      'CLOSED'
    );
  }

  const existing =
    db
      .prepare(`
        SELECT *
        FROM applications
        WHERE guild_id=?
          AND user_id=?
          AND status='collecting'
        LIMIT 1
      `)
      .get(
        guildId,
        user.id
      );

  if (
    existing
  ) {
    await user
      .send(
        v2(
          makeContainer(
            'Candidature déjà en cours',

            'Tu as déjà une candidature en cours. Termine celle-ci avant d’en commencer une nouvelle.',

            config.colors.warning
          )
        )
      )
      .catch(
        () => {}
      );

    return;
  }

  const result =
    db
      .prepare(`
        INSERT INTO applications (
          guild_id,
          user_id,
          answers,
          question_index,
          status,
          created_at
        )
        VALUES (?, ?, ?, 0, 'collecting', ?)
      `)
      .run(
        guildId,
        user.id,
        '[]',
        Date.now()
      );

  const start =
    new ButtonBuilder()
      .setCustomId(
        `application_start:${result.lastInsertRowid}`
      )
      .setLabel(
        'Commencer'
      )
      .setEmoji(
        '▶️'
      )
      .setStyle(
        ButtonStyle.Primary
      );

  await user.send(
    v2(
      makeContainer(
        'Candidature Staff',

        [
          'Bienvenue dans le système de candidature de **Bretagne RP**.',
          '',
          'Le bot va te poser plusieurs questions, une par une.',
          '',
          'Réponds directement à chaque question.',
          '',
          'Lorsque tu es prêt, clique sur **Commencer**.'
        ].join('\n'),

        config.colors.primary,

        [
          new ActionRowBuilder()
            .addComponents(
              start
            )
        ],

        `Candidature #${result.lastInsertRowid}`
      )
    )
  );
}

async function askApplication(
  application
) {
  const config =
    getConfig(
      application.guild_id
    );

  const questions =
    config.applications.questions;

  if (
    application.question_index >=
    questions.length
  ) {
    return;
  }

  const user =
    await client.users.fetch(
      application.user_id
    );

  await user.send(
    v2(
      makeContainer(
        `Question ${
          application.question_index + 1
        }/${questions.length}`,

        `${
          questions[
            application.question_index
          ]
        }\n\nRéponds directement dans ce DM.`,

        config.colors.primary,

        [],

        `${config.serverName} • Candidature`
      )
    )
  );
}

async function finalizeApplication(
  application
) {
  const config =
    getConfig(
      application.guild_id
    );

  const guild =
    client.guilds.cache.get(
      application.guild_id
    );

  if (
    !guild
  ) {
    return;
  }

  const channel =
    await fetchTextChannel(
      guild,
      config.channels.applicationLogs
    );

  if (
    !channel
  ) {
    return;
  }

  const answers =
    JSON.parse(
      application.answers ||
        '[]'
    );

  const body =
    answers
      .map(
        (answer, index) =>
          `### ${
            index + 1
          }. ${
            config.applications.questions[
              index
            ] || 'Question'
          }\n${answer}`
      )
      .join(
        '\n\n'
      );

  const accept =
    new ButtonBuilder()
      .setCustomId(
        `application_accept:${application.id}`
      )
      .setLabel(
        'Accepter'
      )
      .setEmoji(
        '✅'
      )
      .setStyle(
        ButtonStyle.Success
      );

  const refuse =
    new ButtonBuilder()
      .setCustomId(
        `application_refuse:${application.id}`
      )
      .setLabel(
        'Refuser'
      )
      .setEmoji(
        '❌'
      )
      .setStyle(
        ButtonStyle.Danger
      );

  const message =
    await channel.send(
      v2(
        makeContainer(
          `Candidature Staff #${application.id}`,

          `**Candidat :** <@${application.user_id}>\n` +
            `**Créée :** <t:${Math.floor(
              application.created_at /
                1000
            )}:F>\n\n` +
            body,

          config.colors.primary,

          [
            new ActionRowBuilder()
              .addComponents(
                accept,
                refuse
              )
          ],

          'Utilisez les boutons pour prendre une décision.'
        )
      )
    );

  db.prepare(`
    UPDATE applications
    SET
      status='pending',
      log_channel_id=?,
      log_message_id=?
    WHERE id=?
  `).run(
    channel.id,
    message.id,
    application.id
  );

  await client.users
    .fetch(
      application.user_id
    )
    .then(
      user =>
        user.send(
          v2(
            makeContainer(
              'Candidature envoyée',

              'Ta candidature a été transmise au Staff. Tu recevras un DM lorsque la décision sera prise.',

              config.colors.primary
            )
          )
        )
    )
    .catch(
      () => {}
    );
}

// ============================================================================
// GIVEAWAY
// ============================================================================

function giveawayParticipants(
  giveaway
) {
  try {
    return JSON.parse(
      giveaway.participants ||
        '[]'
    );
  } catch {
    return [];
  }
}

function expiredWinners(
  giveaway
) {
  try {
    return JSON.parse(
      giveaway.expired_winners ||
        '[]'
    );
  } catch {
    return [];
  }
}

function buildGiveaway(
  giveaway,
  config
) {
  const participants =
    giveawayParticipants(
      giveaway
    );

  const closed =
    giveaway.status !==
    'active';

  const join =
    new ButtonBuilder()
      .setCustomId(
        `giveaway_join:${giveaway.id}`
      )
      .setLabel(
        'Participer'
      )
      .setEmoji(
        '🎉'
      )
      .setStyle(
        ButtonStyle.Primary
      )
      .setDisabled(
        closed
      );

  const leave =
    new ButtonBuilder()
      .setCustomId(
        `giveaway_leave:${giveaway.id}`
      )
      .setLabel(
        'Quitter'
      )
      .setEmoji(
        '🚪'
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        closed
      );

  let title =
    'Giveaway';

  let state =
    `**Temps restant :** <t:${Math.floor(
      giveaway.end_at /
        1000
    )}:R>`;

  if (
    giveaway.status !==
    'active'
  ) {
    title =
      'Fermer';

    if (
      giveaway.status ===
      'awaiting_claim'
    ) {
      state =
        [
          '**État :** 🟡 En attente de réclamation',
          `**Gagnant :** <@${giveaway.current_winner_id}>`,
          `**Réclamation jusqu’au :** <t:${Math.floor(
            giveaway.claim_deadline /
              1000
          )}:F>`
        ].join('\n');
    } else if (
      giveaway.status ===
      'claimed'
    ) {
      state =
        [
          '**État :** 🟢 Réclamation ouverte',
          '**Délai de 24h :** arrêté'
        ].join('\n');
    } else {
      state =
        '**État :** 🔴 Fermé';
    }
  }

  return makeContainer(
    title,

    [
      `## ${giveaway.prize}`,
      '',
      `**Gagnant(s) :** ${giveaway.winners_count}`,
      `**Participants :** ${participants.length}`,

      giveaway.required_role_id
        ? `**Rôle requis :** <@&${giveaway.required_role_id}>`
        : '**Rôle requis :** Aucun',

      '',
      state,
      '',
      closed
        ? 'Le giveaway est fermé.'
        : 'Participe avec les boutons ci-dessous.'
    ].join('\n'),

    closed
      ? config.colors.neutral
      : config.colors.warning,

    [
      new ActionRowBuilder()
        .addComponents(
          join,
          leave
        )
    ],

    `${config.serverName} • Giveaway #${giveaway.id}`
  );
}

async function editGiveaway(
  giveaway
) {
  const guild =
    client.guilds.cache.get(
      giveaway.guild_id
    );

  if (
    !guild
  ) {
    return;
  }

  const channel =
    await fetchTextChannel(
      guild,
      giveaway.channel_id
    );

  if (
    !channel
  ) {
    return;
  }

  try {
    const message =
      await channel.messages.fetch(
        giveaway.message_id
      );

    await message.edit(
      v2(
        buildGiveaway(
          giveaway,
          getConfig(
            giveaway.guild_id
          )
        )
      )
    );
  } catch {}
}

async function announceWinner(
  giveaway,
  isReroll
) {
  const guild =
    client.guilds.cache.get(
      giveaway.guild_id
    );

  if (
    !guild
  ) {
    return null;
  }

  const channel =
    await fetchTextChannel(
      guild,
      giveaway.channel_id
    );

  if (
    !channel
  ) {
    return null;
  }

  const deadline =
    Math.floor(
      giveaway.claim_deadline /
        1000
    );

  const content =
    isReroll
      ? [
          `🔄 **REROLL DU GIVEAWAY #${giveaway.id}**`,
          '',
          'Le gagnant précédent n’a pas réclamé son lot dans les 24 heures.',
          '',
          `🏆 **Nouveau gagnant : <@${giveaway.current_winner_id}>**`,
          `🎁 **Récompense : ${giveaway.prize}**`,
          '⏱️ Tu as **24 heures** pour réclamer ton lot.',
          '🎫 Ouvre le ticket **« Giveaway • Réclamation »**.',
          '',
          `⚠️ Sans réclamation avant **<t:${deadline}:F>**, le giveaway sera automatiquement reroll.`
        ].join('\n')
      : [
          `🎉 **GIVEAWAY TERMINÉ — #${giveaway.id}**`,
          '',
          `🏆 **Félicitations <@${giveaway.current_winner_id}> ! Tu as gagné le giveaway !**`,
          `🎁 **Récompense : ${giveaway.prize}**`,
          '⏱️ Tu as **24 heures** pour réclamer ton lot.',
          '🎫 Ouvre le ticket **« Giveaway • Réclamation »**.',
          '',
          `⚠️ Sans réclamation avant **<t:${deadline}:F>**, ton gain sera automatiquement reroll.`
        ].join('\n');

  return channel.send({
    content,

    reply: {
      messageReference:
        giveaway.message_id
    }
  });
}

async function startClaimRound(
  giveawayId,
  isReroll
) {
  const giveaway =
    db
      .prepare(
        'SELECT * FROM giveaways WHERE id=?'
      )
      .get(
        giveawayId
      );

  if (
    !giveaway
  ) {
    return;
  }

  const participants =
    giveawayParticipants(
      giveaway
    );

  let expired =
    expiredWinners(
      giveaway
    );

  if (
    isReroll &&
    giveaway.current_winner_id &&
    !expired.includes(
      giveaway.current_winner_id
    )
  ) {
    expired.push(
      giveaway.current_winner_id
    );
  }

  const pool =
    participants.filter(
      userId =>
        !expired.includes(
          userId
        )
    );

  if (
    !pool.length
  ) {
    db.prepare(`
      UPDATE giveaways
      SET
        status='closed',
        current_winner_id=NULL,
        claim_deadline=NULL,
        expired_winners=?
      WHERE id=?
    `).run(
      JSON.stringify(
        expired
      ),
      giveaway.id
    );

    const updated =
      db
        .prepare(
          'SELECT * FROM giveaways WHERE id=?'
        )
        .get(
          giveaway.id
        );

    await editGiveaway(
      updated
    );

    const guild =
      client.guilds.cache.get(
        giveaway.guild_id
      );

    const channel =
      guild
        ? await fetchTextChannel(
            guild,
            giveaway.channel_id
          )
        : null;

    if (
      channel
    ) {
      await channel.send({
        content:
          `⚠️ **GIVEAWAY #${giveaway.id} FERMÉ**\n\n` +
          'Il n’y a plus de participant éligible après les rerolls.\n' +
          `La récompense **${giveaway.prize}** n’a pas pu être attribuée.`
      });
    }

    return;
  }

  const winner =
    pool[
      Math.floor(
        Math.random() *
          pool.length
      )
    ];

  const config =
    getConfig(
      giveaway.guild_id
    );

  const deadline =
    Date.now() +
    config.giveaways.claimHours *
      3600000;

  db.prepare(`
    UPDATE giveaways
    SET
      status='awaiting_claim',
      current_winner_id=?,
      claim_deadline=?,
      claim_round=?,
      expired_winners=?
    WHERE id=?
  `).run(
    winner,
    deadline,
    giveaway.claim_round + 1,
    JSON.stringify(
      expired
    ),
    giveaway.id
  );

  const updated =
    db
      .prepare(
        'SELECT * FROM giveaways WHERE id=?'
      )
      .get(
        giveaway.id
      );

  await editGiveaway(
    updated
  );

  const announcement =
    await announceWinner(
      updated,
      isReroll
    );

  if (
    announcement
  ) {
    db.prepare(`
      UPDATE giveaways
      SET announcement_message_id=?
      WHERE id=?
    `).run(
      announcement.id,
      giveaway.id
    );
  }
}

async function processGiveaways() {
  const now =
    Date.now();

  const active =
    db
      .prepare(`
        SELECT id
        FROM giveaways
        WHERE status='active'
          AND end_at<=?
      `)
      .all(
        now
      );

  for (
    const giveaway of active
  ) {
    await startClaimRound(
      giveaway.id,
      false
    );
  }

  const expired =
    db
      .prepare(`
        SELECT id
        FROM giveaways
        WHERE status='awaiting_claim'
          AND claim_deadline<=?
      `)
      .all(
        now
      );

  for (
    const giveaway of expired
  ) {
    await startClaimRound(
      giveaway.id,
      true
    );
  }
}

// ============================================================================
// TICKETS
// ============================================================================

async function createTicket(
  interaction,
  type
) {
  const guild =
    interaction.guild;

  const config =
    getConfig(
      guild.id
    );

  if (
    !config.systems.tickets
  ) {
    return replyText(
      interaction,
      '❌ Les tickets sont actuellement désactivés.'
    );
  }

  let giveaway =
    null;

  if (
    type === 'claim'
  ) {
    giveaway =
      db
        .prepare(`
          SELECT *
          FROM giveaways
          WHERE guild_id=?
            AND status='awaiting_claim'
            AND current_winner_id=?
            AND claim_deadline>?
        `)
        .get(
          guild.id,
          interaction.user.id,
          Date.now()
        );

    if (
      !giveaway
    ) {
      return replyText(
        interaction,
        '❌ Tu n’as actuellement aucun giveaway à réclamer.'
      );
    }
  }

  const existing =
    db
      .prepare(`
        SELECT *
        FROM tickets
        WHERE guild_id=?
          AND user_id=?
          AND type=?
          AND closed_at IS NULL
      `)
      .get(
        guild.id,
        interaction.user.id,
        type
      );

  if (
    existing
  ) {
    return replyText(
      interaction,
      `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`
    );
  }

  const ticketConfig =
    type === 'claim'
      ? config.tickets.claim
      : config.tickets.support;

  const parentId =
    type === 'claim'
      ? config.channels
          .ticketCategoryClaim
      : config.channels
          .ticketCategorySupport;

  const parent =
    parentId
      ? guild.channels.cache.get(
          parentId
        )
      : null;

  const permissionOverwrites = [
    {
      id:
        guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        interaction.user.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    }
  ];

  for (
    const roleId of
    ticketConfig.viewRoleIds
  ) {
    if (
      guild.roles.cache.has(
        roleId
      )
    ) {
      permissionOverwrites.push({
        id:
          roleId,

        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      });
    }
  }

  const channel =
    await guild.channels.create({
      name:
        `${config.tickets.prefix}-${
          type === 'claim'
            ? 'claim'
            : 'support'
        }-${interaction.user.username}`
          .toLowerCase()
          .replace(
            /[^a-z0-9-]/g,
            '-'
          )
          .slice(
            0,
            90
          ),

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
      type,
      giveaway_id,
      opened_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    guild.id,
    channel.id,
    interaction.user.id,
    type,
    giveaway?.id ||
      null,
    Date.now()
  );

  if (
    giveaway
  ) {
    db.prepare(`
      UPDATE giveaways
      SET
        status='claimed',
        claim_deadline=NULL,
        claim_ticket_channel_id=?,
        claim_ticket_opened_at=?
      WHERE id=?
    `).run(
      channel.id,
      Date.now(),
      giveaway.id
    );
  }

  const close =
    new ButtonBuilder()
      .setCustomId(
        'ticket_close'
      )
      .setLabel(
        'Fermer le ticket'
      )
      .setEmoji(
        '🔒'
      )
      .setStyle(
        ButtonStyle.Danger
      );

  const ping =
    ticketConfig.pingRoleIds
      .map(
        roleId =>
          `<@&${roleId}>`
      )
      .join(' ');

  const description =
    type === 'claim'
      ? [
          `## Réclamation du giveaway #${giveaway.id}`,
          `${interaction.user}`,
          `**Récompense :** ${giveaway.prize}`,
          '',
          'Le délai de réclamation de 24 heures est maintenant **arrêté**.',
          '',
          ping
        ].join('\n')
      : [
          '## Support',
          `${interaction.user}`,
          '',
          'Explique clairement ta demande afin que le Staff puisse t’aider.',
          '',
          ping
        ].join('\n');

  await channel.send(
    v2(
      makeContainer(
        type === 'claim'
          ? 'Giveaway • Réclamation'
          : 'Ticket Support',

        description,

        type === 'claim'
          ? config.colors.warning
          : config.colors.primary,

        [
          new ActionRowBuilder()
            .addComponents(
              close
            )
        ],

        `${guild.name} • ${
          type === 'claim'
            ? 'Réclamation'
            : 'Support'
        }`
      )
    )
  );

  if (
    giveaway?.announcement_message_id
  ) {
    try {
      const giveawayChannel =
        await fetchTextChannel(
          guild,
          giveaway.channel_id
        );

      const announcement =
        await giveawayChannel.messages.fetch(
          giveaway.announcement_message_id
        );

      await announcement.reply({
        content:
          `✅ <@${interaction.user.id}> a ouvert son ticket de réclamation. ` +
          `Le compte à rebours de 24 heures est maintenant **arrêté**. ` +
          `<#${channel.id}>`
      });
    } catch {}
  }

  return replyText(
    interaction,
    `✅ Ticket créé : <#${channel.id}>`
  );
}

async function closeTicket(
  interaction
) {
  const ticket =
    db
      .prepare(`
        SELECT *
        FROM tickets
        WHERE channel_id=?
          AND closed_at IS NULL
      `)
      .get(
        interaction.channel.id
      );

  if (
    !ticket
  ) {
    return replyText(
      interaction,
      '❌ Ce salon n’est pas un ticket actif.'
    );
  }

  const config =
    getConfig(
      interaction.guild.id
    );

  const ticketConfig =
    ticket.type ===
      'claim'
      ? config.tickets.claim
      : config.tickets.support;

  const allowed =
    ticket.user_id ===
      interaction.user.id ||
    interaction.member.permissions.has(
      PermissionFlagsBits.ManageChannels
    ) ||
    ticketConfig.viewRoleIds.some(
      roleId =>
        interaction.member.roles.cache.has(
          roleId
        )
    );

  if (
    !allowed
  ) {
    return replyText(
      interaction,
      '❌ Tu ne peux pas fermer ce ticket.'
    );
  }

  db.prepare(`
    UPDATE tickets
    SET closed_at=?
    WHERE channel_id=?
  `).run(
    Date.now(),
    interaction.channel.id
  );

  await replyText(
    interaction,
    '🔒 Ticket fermé.'
  );

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
}

// ============================================================================
// CONFIG HOME
// ============================================================================

function configHome(
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
          .setLabel(
            'Salons'
          )
          .setEmoji(
            '📁'
          )
          .setDescription(
            'Configurer les salons'
          )
          .setValue(
            'channels'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Rôles'
          )
          .setEmoji(
            '👥'
          )
          .setDescription(
            'Configurer les rôles'
          )
          .setValue(
            'roles'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Sécurité'
          )
          .setEmoji(
            '🛡️'
          )
          .setDescription(
            'Configurer les protections'
          )
          .setValue(
            'security'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Candidatures'
          )
          .setEmoji(
            '📋'
          )
          .setDescription(
            'Recrutement Staff'
          )
          .setValue(
            'applications'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Tickets'
          )
          .setEmoji(
            '🎫'
          )
          .setDescription(
            'Visibilité, pings et catégories'
          )
          .setValue(
            'tickets'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Giveaways'
          )
          .setEmoji(
            '🎉'
          )
          .setDescription(
            'Réclamations et permissions'
          )
          .setValue(
            'giveaways'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Sessions RP'
          )
          .setEmoji(
            '🟢'
          )
          .setDescription(
            'Configurer les sessions'
          )
          .setValue(
            'sessions'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Systèmes'
          )
          .setEmoji(
            '⚙️'
          )
          .setDescription(
            'Activer ou désactiver les systèmes'
          )
          .setValue(
            'systems'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Apparence'
          )
          .setEmoji(
            '🎨'
          )
          .setDescription(
            'Modifier la couleur'
          )
          .setValue(
            'appearance'
          )
      );

  const refresh =
    new ButtonBuilder()
      .setCustomId(
        'config_refresh'
      )
      .setLabel(
        'Actualiser'
      )
      .setEmoji(
        '↻'
      )
      .setStyle(
        ButtonStyle.Secondary
      );

  return makeContainer(
    'Configuration de Bretagne RP',

    [
      '## Centre de configuration',
      '',
      'Tout est regroupé dans ce panneau.',
      '',
      `**Mode test :** ${
        config.testMode
          ? '🟢 Activé'
          : '🔴 Désactivé'
      }`,
      '',
      `**Candidatures :** ${
        config.systems.applications
          ? '🟢 Ouvertes'
          : '🔴 Fermées'
      }`,
      `**Tickets :** ${
        config.systems.tickets
          ? '🟢 Actifs'
          : '🔴 Désactivés'
      }`,
      `**Sécurité :** ${
        config.systems.security
          ? '🟢 Active'
          : '🔴 Désactivée'
      }`,
      '',
      'Sélectionne une catégorie pour continuer.'
    ].join('\n'),

    config.colors.primary,

    [
      new ActionRowBuilder()
        .addComponents(
          menu
        ),

      new ActionRowBuilder()
        .addComponents(
          refresh
        )
    ],

    `${config.serverName} • Configuration`
  );
}

function configCategory(
  config,
  category
) {
  const back =
    new ButtonBuilder()
      .setCustomId(
        'config_back'
      )
      .setLabel(
        'Retour'
      )
      .setEmoji(
        '←'
      )
      .setStyle(
        ButtonStyle.Secondary
      );

  let menu =
    null;

  let description =
    '';

  if (
    category ===
    'channels'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_channel_target'
        )
        .setPlaceholder(
          'Quel salon modifier ?'
        )
        .addOptions(
          ...[
            ['Bienvenue', 'welcome'],
            ['Règlement', 'rules'],
            ['Candidatures', 'applicationLogs'],
            ['Suggestions', 'suggestions'],
            ['Sessions', 'sessions'],
            ['Logs', 'logs'],
            ['Panneau tickets', 'ticketPanel'],
            ['Catégorie support', 'ticketCategorySupport'],
            ['Catégorie réclamations', 'ticketCategoryClaim']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    description = [
      'Choisis un paramètre puis un salon.',
      '',
      `Bienvenue : ${
        config.channels.welcome
          ? `<#${config.channels.welcome}>`
          : 'Non configuré'
      }`,
      `Règlement : ${
        config.channels.rules
          ? `<#${config.channels.rules}>`
          : 'Non configuré'
      }`,
      `Candidatures : ${
        config.channels.applicationLogs
          ? `<#${config.channels.applicationLogs}>`
          : 'Non configuré'
      }`,
      `Suggestions : ${
        config.channels.suggestions
          ? `<#${config.channels.suggestions}>`
          : 'Non configuré'
      }`
    ].join('\n');
  }

  else if (
    category ===
    'roles'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_role_target'
        )
        .setPlaceholder(
          'Quel rôle modifier ?'
        )
        .addOptions(
          ...[
            ['Vérifié', 'verified'],
            ['Staff', 'staff'],
            ['Configuration', 'config'],
            ['Giveaways', 'giveaways'],
            ['Support', 'ticketSupport']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    description = [
      `Vérifié : ${
        config.roles.verified
          ? `<@&${config.roles.verified}>`
          : 'Aucun'
      }`,
      `Staff : ${
        config.roles.staff
          ? `<@&${config.roles.staff}>`
          : 'Aucun'
      }`,
      `Configuration : ${
        config.roles.config
          ? `<@&${config.roles.config}>`
          : 'Aucun'
      }`,
      `Giveaways : ${
        config.roles.giveaways
          ? `<@&${config.roles.giveaways}>`
          : 'Aucun'
      }`,
      `Support : ${
        config.roles.ticketSupport
          ? `<@&${config.roles.ticketSupport}>`
          : 'Aucun'
      }`
    ].join('\n');
  }

  else if (
    category ===
    'security'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_security_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          ...[
            ['Anti-raid', 'antiRaid'],
            ['Anti-spam', 'antiSpam'],
            ['Mass mention', 'antiMassMention'],
            ['Suppression massive', 'antiMassDelete'],
            ['Mots interdits', 'badWords'],
            ['Rôles bypass', 'bypass']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    description = [
      `Anti-raid : ${bool(
        config.systems.antiRaid
      )}`,
      `Anti-spam : ${bool(
        config.systems.antiSpam
      )}`,
      `Mass mention : ${bool(
        config.systems.antiMassMention
      )}`,
      `Suppression massive : ${bool(
        config.systems.antiMassDelete
      )}`,
      `Mots interdits : ${bool(
        config.systems.badWords
      )}`,
      '',
      'Sanctions : 30s → 1m → 5m → 10m → 30m → 1h → 6h → 12h → 24h'
    ].join('\n');
  }

  else if (
    category ===
    'applications'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_app_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          ...[
            ['Ouvrir / fermer', 'toggle'],
            ['Voir les questions', 'questions'],
            ['Ajouter une question', 'add'],
            ['Supprimer une question', 'remove'],
            ['Rôle après acceptation', 'staffRole']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    description = [
      `**État :** ${
        config.systems.applications
          ? '🟢 Ouvertes'
          : '🔴 Fermées'
      }`,
      `**Questions :** ${
        config.applications.questions.length
      }`,
      '',
      'Fermer les candidatures désactive leur menu sans supprimer le panneau.'
    ].join('\n');
  }

  else if (
    category ===
    'tickets'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_ticket_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          ...[
            ['Support • Voir', 'support_view'],
            ['Support • Ping', 'support_ping'],
            ['Claim • Voir', 'claim_view'],
            ['Claim • Ping', 'claim_ping'],
            ['Support • Catégorie', 'support_category'],
            ['Claim • Catégorie', 'claim_category'],
            ['Supprimer après fermeture', 'delete']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    description = [
      `Support • Voir : ${roleList(
        config.tickets.support.viewRoleIds
      )}`,
      `Support • Ping : ${roleList(
        config.tickets.support.pingRoleIds
      )}`,
      `Claim • Voir : ${roleList(
        config.tickets.claim.viewRoleIds
      )}`,
      `Claim • Ping : ${roleList(
        config.tickets.claim.pingRoleIds
      )}`,
      `Suppression après fermeture : ${bool(
        config.tickets.deleteAfterClose
      )}`
    ].join('\n');
  }

  else if (
    category ===
    'giveaways'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_gw_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(
              'Durée de réclamation'
            )
            .setValue(
              'hours'
            ),

          new StringSelectMenuOptionBuilder()
            .setLabel(
              'Rôle de gestion'
            )
            .setValue(
              'role'
            )
        );

    description = [
      `**Rôle de gestion :** ${
        config.roles.giveaways
          ? `<@&${config.roles.giveaways}>`
          : 'Aucun'
      }`,
      `**Délai :** ${config.giveaways.claimHours}h`,
      '',
      'À la fin : le panneau devient **Fermer**, le bot annonce le gagnant en message normal et le gagnant dispose du délai pour réclamer.'
    ].join('\n');
  }

  else if (
    category ===
    'sessions'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_session_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(
              '@everyone à l’ouverture'
            )
            .setValue(
              'ping'
            ),

          new StringSelectMenuOptionBuilder()
            .setLabel(
              'Nettoyer à la fermeture'
            )
            .setValue(
              'clear'
            )
        );

    description = [
      `Ping : ${bool(
        config.sessions.pingEveryone
      )}`,
      `Nettoyage : ${bool(
        config.sessions.clearOnShutdown
      )}`,
      '',
      'Le message d’ouverture n’a volontairement aucun bouton.'
    ].join('\n');
  }

  else if (
    category ===
    'systems'
  ) {
    menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'cfg_system_target'
        )
        .setPlaceholder(
          'Choisir un système...'
        )
        .addOptions(
          ...[
            ['Bienvenue', 'welcome'],
            ['Règlement', 'rules'],
            ['Candidatures', 'applications'],
            ['Giveaways', 'giveaways'],
            ['Tickets', 'tickets'],
            ['Suggestions', 'suggestions'],
            ['Sessions', 'sessions'],
            ['Sécurité', 'security'],
            ['Anti-raid', 'antiRaid'],
            ['Anti-spam', 'antiSpam'],
            ['Mass mention', 'antiMassMention'],
            ['Mass delete', 'antiMassDelete'],
            ['Mots interdits', 'badWords']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    description =
      Object.entries(
        config.systems
      )
        .map(
          ([key, value]) =>
            `**${key} :** ${bool(
              value
            )}`
        )
        .join('\n');
  }

  else if (
    category ===
    'appearance'
  ) {
    const colorButton =
      new ButtonBuilder()
        .setCustomId(
          'cfg_color'
        )
        .setLabel(
          'Changer la couleur'
        )
        .setEmoji(
          '🎨'
        )
        .setStyle(
          ButtonStyle.Primary
        );

    return makeContainer(
      'Configuration • Apparence',

      `**Couleur actuelle :** #${config.colors.primary
        .toString(16)
        .padStart(
          6,
          '0'
        )
        .toUpperCase()}\n\n` +
        'Cette couleur est utilisée sur les panneaux Components V2.',

      config.colors.primary,

      [
        new ActionRowBuilder()
          .addComponents(
            colorButton
          ),

        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      `${config.serverName} • Apparence`
    );
  }

  return makeContainer(
    `Configuration • ${category}`,
    description ||
      'Sélectionne une option.',
    config.colors.primary,
    [
      new ActionRowBuilder()
        .addComponents(
          menu
        ),

      new ActionRowBuilder()
        .addComponents(
          back
        )
    ],
    `${config.serverName} • Configuration`
  );
}

// ============================================================================
// SLASH COMMANDS
// ============================================================================

const commands = [
  new SlashCommandBuilder()
    .setName(
      'config'
    )
    .setDescription(
      'Ouvrir la configuration de Bretagne RP'
    ),

  new SlashCommandBuilder()
    .setName(
      'suggestion'
    )
    .setDescription(
      'Envoyer une suggestion'
    ),

  new SlashCommandBuilder()
    .setName(
      'giveaway'
    )
    .setDescription(
      'Gérer les giveaways'
    )
    .addSubcommand(
      sub =>
        sub
          .setName(
            'create'
          )
          .setDescription(
            'Créer un giveaway'
          )
          .addStringOption(
            option =>
              option
                .setName(
                  'duration'
                )
                .setDescription(
                  'Ex: 30m, 2h, 1d'
                )
                .setRequired(
                  true
                )
          )
          .addStringOption(
            option =>
              option
                .setName(
                  'prize'
                )
                .setDescription(
                  'Récompense'
                )
                .setRequired(
                  true
                )
                .setMaxLength(
                  300
                )
          )
          .addIntegerOption(
            option =>
              option
                .setName(
                  'winners'
                )
                .setDescription(
                  'Nombre de gagnants'
                )
                .setMinValue(
                  1
                )
                .setMaxValue(
                  100
                )
                .setRequired(
                  true
                )
          )
          .addRoleOption(
            option =>
              option
                .setName(
                  'role'
                )
                .setDescription(
                  'Rôle requis pour participer'
                )
          )
    )
    .addSubcommand(
      sub =>
        sub
          .setName(
            'end'
          )
          .setDescription(
            'Terminer un giveaway'
          )
          .addIntegerOption(
            option =>
              option
                .setName(
                  'id'
                )
                .setDescription(
                  'ID du giveaway'
                )
                .setRequired(
                  true
                )
          )
    )
    .addSubcommand(
      sub =>
        sub
          .setName(
            'reroll'
          )
          .setDescription(
            'Forcer un reroll'
          )
          .addIntegerOption(
            option =>
              option
                .setName(
                  'id'
                )
                .setDescription(
                  'ID du giveaway'
                )
                .setRequired(
                  true
                )
          )
    ),

  new SlashCommandBuilder()
    .setName(
      'session'
    )
    .setDescription(
      'Gérer les sessions RP'
    )
    .addSubcommand(
      sub =>
        sub
          .setName(
            'open'
          )
          .setDescription(
            'Ouvrir une session'
          )
          .addStringOption(
            option =>
              option
                .setName(
                  'server-code'
                )
                .setDescription(
                  'Code serveur'
                )
                .setRequired(
                  true
                )
          )
    )
    .addSubcommand(
      sub =>
        sub
          .setName(
            'shutdown'
          )
          .setDescription(
            'Fermer une session'
          )
    )
];

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

  if (
    GUILD_ID
  ) {
    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      {
        body
      }
    );

    return;
  }

  await rest.put(
    Routes.applicationCommands(
      CLIENT_ID
    ),
    {
      body
    }
  );
}

// ============================================================================
// CHANNEL CLEAR
// ============================================================================

async function clearChannel(
  channel
) {
  for (
    let i = 0;
    i < 100;
    i++
  ) {
    const messages =
      await channel.messages.fetch({
        limit: 100
      });

    if (
      !messages.size
    ) {
      break;
    }

    const recent =
      messages.filter(
        message =>
          Date.now() -
            message.createdTimestamp <
          14 *
            24 *
            60 *
            60 *
            1000
      );

    const old =
      messages.filter(
        message =>
          Date.now() -
            message.createdTimestamp >=
          14 *
            24 *
            60 *
            60 *
            1000
      );

    if (
      recent.size
    ) {
      try {
        await channel.bulkDelete(
          recent,
          true
        );
      } catch {
        for (
          const message of
          recent.values()
        ) {
          await message
            .delete()
            .catch(
              () => {}
            );
        }
      }
    }

    for (
      const message of
      old.values()
    ) {
      await message
        .delete()
        .catch(
          () => {}
        );
    }

    if (
      messages.size <
      100
    ) {
      break;
    }
  }
}

// ============================================================================
// READY
// ============================================================================

client.once(
  Events.ClientReady,
  async ready => {
    console.log(
      `✅ ${ready.user.tag} est connecté`
    );

    /*
     * Discord's Custom activity supports a state string.
     * This makes the presence show:
     * Developped by Nexora
     */
    ready.user.setPresence({
      activities: [
        {
          name:
            'Developped by Nexora',

          state:
            'Developped by Nexora',

          type:
            ActivityType.Custom
        }
      ],

      status:
        'online'
    });

    try {
      await registerCommands();

      console.log(
        '✅ Commandes enregistrées'
      );
    } catch (
      error
    ) {
      console.error(
        '❌ Erreur commandes:',
        error
      );
    }

    for (
      const guild of
      ready.guilds.cache.values()
    ) {
      try {
        await syncAllPanels(
          guild
        );

        console.log(
          `✅ Panels vérifiés : ${guild.name}`
        );
      } catch (
        error
      ) {
        console.error(
          `❌ Panel error (${guild.name}):`,
          error.message
        );
      }
    }

    setInterval(
      () =>
        processGiveaways().catch(
          error =>
            console.error(
              '❌ Giveaway loop:',
              error
            )
        ),
      5000
    );
  }
);

// ============================================================================
// MEMBER JOIN
// ============================================================================

client.on(
  Events.GuildMemberAdd,
  async member => {
    await welcome(
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

    const list =
      raidMap.get(
        key
      ) || [];

    const now =
      Date.now();

    list.push(
      now
    );

    while (
      list.length &&
      now - list[0] >
        config.security
          .antiRaid
          .windowSeconds *
          1000
    ) {
      list.shift();
    }

    raidMap.set(
      key,
      list
    );

    if (
      list.length >=
      config.security
        .antiRaid
        .joinThreshold
    ) {
      await moderate(
        member,
        'Détection anti-raid'
      );
    }
  }
);

// ============================================================================
// MESSAGE SECURITY
// ============================================================================

client.on(
  Events.MessageCreate,
  async message => {
    if (
      !message.guild
    ) {
      return;
    }

    if (
      message.author.bot
    ) {
      return;
    }

    const member =
      message.member;

    const config =
      getConfig(
        message.guild.id
      );

    if (
      !config.systems.security
    ) {
      return;
    }

    // BAD WORDS
    if (
      config.systems.badWords &&
      !hasBypass(
        member,
        config,
        'badWords'
      )
    ) {
      const bad =
        findBadWord(
          message.content,
          config
        );

      if (
        bad
      ) {
        await message
          .delete()
          .catch(
            () => {}
          );

        await moderate(
          member,
          `Mot interdit détecté : ${bad}`
        );

        return;
      }
    }

    // MASS MENTION
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

      if (
        message.mentions.everyone
      ) {
        count =
          Math.max(
            count,
            config.security
              .antiMassMention
              .threshold
          );
      }

      if (
        count >=
        config.security
          .antiMassMention
          .threshold
      ) {
        await message
          .delete()
          .catch(
            () => {}
          );

        await moderate(
          member,
          'Mass mention détectée'
        );

        return;
      }
    }

    // ANTI SPAM
    if (
      config.systems.antiSpam &&
      !hasBypass(
        member,
        config,
        'antiSpam'
      )
    ) {
      const key =
        `${message.guild.id}:${member.id}`;

      const list =
        spamMap.get(
          key
        ) || [];

      const now =
        Date.now();

      list.push(
        now
      );

      while (
        list.length &&
        now - list[0] >
          config.security
            .antiSpam
            .windowSeconds *
            1000
      ) {
        list.shift();
      }

      spamMap.set(
        key,
        list
      );

      if (
        list.length >=
        config.security
          .antiSpam
          .messageThreshold
      ) {
        await message
          .delete()
          .catch(
            () => {}
          );

        spamMap.set(
          key,
          []
        );

        await moderate(
          member,
          'Spam détecté'
        );
      }
    }
  }
);

// ============================================================================
// DM APPLICATIONS
// ============================================================================

client.on(
  Events.MessageCreate,
  async message => {
    if (
      message.guild
    ) {
      return;
    }

    if (
      message.author.bot
    ) {
      return;
    }

    const application =
      db
        .prepare(`
          SELECT *
          FROM applications
          WHERE user_id=?
            AND status='collecting'
          ORDER BY id DESC
          LIMIT 1
        `)
        .get(
          message.author.id
        );

    if (
      !application
    ) {
      return;
    }

    const config =
      getConfig(
        application.guild_id
      );

    if (
      !config.systems.applications
    ) {
      return;
    }

    if (
      message.content.length >
      1000
    ) {
      await message.author
        .send(
          v2(
            makeContainer(
              'Réponse trop longue',

              'Ta réponse dépasse la limite de 1000 caractères.',

              config.colors.danger
            )
          )
        )
        .catch(
          () => {}
        );

      return;
    }

    const answers =
      JSON.parse(
        application.answers ||
          '[]'
      );

    answers.push(
      message.content
    );

    const nextIndex =
      application.question_index +
      1;

    if (
      nextIndex >=
      config.applications.questions.length
    ) {
      db.prepare(`
        UPDATE applications
        SET
          answers=?,
          question_index=?,
          status='pending'
        WHERE id=?
      `).run(
        JSON.stringify(
          answers
        ),
        nextIndex,
        application.id
      );

      await message.author
        .send(
          v2(
            makeContainer(
              'Candidature terminée',

              'Merci pour tes réponses. Ta candidature est maintenant envoyée au Staff.',

              config.colors.success
            )
          )
        )
        .catch(
          () => {}
        );

      await finalizeApplication(
        db
          .prepare(
            'SELECT * FROM applications WHERE id=?'
          )
          .get(
            application.id
          )
      );

      return;
    }

    db.prepare(`
      UPDATE applications
      SET
        answers=?,
        question_index=?
      WHERE id=?
    `).run(
      JSON.stringify(
        answers
      ),
      nextIndex,
      application.id
    );

    await askApplication(
      db
        .prepare(
          'SELECT * FROM applications WHERE id=?'
        )
        .get(
          application.id
        )
    );
  }
);

// ============================================================================
// AUDIT LOG MASS DELETE
// ============================================================================

client.on(
  Events.GuildAuditLogEntryCreate,
  async entry => {
    if (
      entry.action !==
      AuditLogEvent.MessageBulkDelete
    ) {
      return;
    }

    const guild =
      client.guilds.cache.get(
        entry.guild.id
      );

    if (
      !guild
    ) {
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

    const count =
      Number(
        entry.extra?.count ||
          0
      );

    if (
      count <
      config.security
        .antiMassDelete
        .threshold
    ) {
      return;
    }

    if (
      !entry.executorId
    ) {
      return;
    }

    const member =
      await guild.members
        .fetch(
          entry.executorId
        )
        .catch(
          () => null
        );

    if (
      !member
    ) {
      return;
    }

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

    await moderate(
      member,
      'Suppression massive de messages'
    );
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
      // SLASH COMMANDS
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
          if (
            !allowedByRole(
              interaction,
              getConfig(
                interaction.guild.id
              ).roles.config
            )
          ) {
            return replyText(
              interaction,
              '❌ Tu n’as pas accès à la configuration.'
            );
          }

          return interaction.reply(
            v2(
              configHome(
                getConfig(
                  interaction.guild.id
                )
              )
            )
          );
        }

        // --------------------------------------------------------------------
        // SUGGESTION
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'suggestion'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            !config.systems.suggestions
          ) {
            return replyText(
              interaction,
              '❌ Les suggestions sont désactivées.'
            );
          }

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
                'text'
              )
              .setLabel(
                'Ta suggestion'
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setRequired(
                true
              )
              .setMaxLength(
                2000
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

        // --------------------------------------------------------------------
        // GIVEAWAYS
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'giveaway'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            !config.systems.giveaways
          ) {
            return replyText(
              interaction,
              '❌ Les giveaways sont désactivés.'
            );
          }

          if (
            !allowedByRole(
              interaction,
              config.roles.giveaways
            )
          ) {
            return replyText(
              interaction,
              '❌ Tu n’as pas accès à la gestion des giveaways.'
            );
          }

          const subcommand =
            interaction.options
              .getSubcommand();

          if (
            subcommand ===
            'create'
          ) {
            const duration =
              interaction.options
                .getString(
                  'duration'
                );

            const durationMs =
              parseDuration(
                duration
              );

            if (
              !durationMs ||
              durationMs <
                config.giveaways
                  .minimumDurationSeconds *
                  1000
            ) {
              return replyText(
                interaction,
                '❌ Durée invalide. Exemple : `30m`, `2h`, `1d`.'
              );
            }

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

            const endAt =
              Date.now() +
              durationMs;

            const result =
              db
                .prepare(`
                  INSERT INTO giveaways (
                    guild_id,
                    channel_id,
                    message_id,
                    prize,
                    winners_count,
                    required_role_id,
                    end_at,
                    participants,
                    status,
                    created_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'active', ?)
                `)
                .run(
                  interaction.guild.id,
                  interaction.channel.id,
                  'pending',
                  prize,
                  winners,
                  role?.id ||
                    null,
                  endAt,
                  Date.now()
                );

            let giveaway =
              db
                .prepare(
                  'SELECT * FROM giveaways WHERE id=?'
                )
                .get(
                  result.lastInsertRowid
                );

            const message =
              await interaction.channel.send(
                v2(
                  buildGiveaway(
                    giveaway,
                    config
                  )
                )
              );

            db.prepare(`
              UPDATE giveaways
              SET message_id=?
              WHERE id=?
            `).run(
              message.id,
              giveaway.id
            );

            giveaway =
              db
                .prepare(
                  'SELECT * FROM giveaways WHERE id=?'
                )
                .get(
                  giveaway.id
                );

            return replyText(
              interaction,
              `✅ Giveaway #${giveaway.id} créé. Fin <t:${Math.floor(
                endAt / 1000
              )}:R>.`
            );
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
              db
                .prepare(`
                  SELECT *
                  FROM giveaways
                  WHERE id=?
                    AND guild_id=?
                `)
                .get(
                  id,
                  interaction.guild.id
                );

            if (
              !giveaway
            ) {
              return replyText(
                interaction,
                '❌ Giveaway introuvable.'
              );
            }

            if (
              giveaway.status !==
              'active'
            ) {
              return replyText(
                interaction,
                '❌ Ce giveaway est déjà fermé.'
              );
            }

            db.prepare(`
              UPDATE giveaways
              SET end_at=?
              WHERE id=?
            `).run(
              Date.now(),
              id
            );

            await startClaimRound(
              id,
              false
            );

            return replyText(
              interaction,
              `✅ Giveaway #${id} terminé.`
            );
          }

          if (
            subcommand ===
            'reroll'
          ) {
            const id =
              interaction.options
                .getInteger(
                  'id'
                );

            const giveaway =
              db
                .prepare(`
                  SELECT *
                  FROM giveaways
                  WHERE id=?
                    AND guild_id=?
                `)
                .get(
                  id,
                  interaction.guild.id
                );

            if (
              !giveaway
            ) {
              return replyText(
                interaction,
                '❌ Giveaway introuvable.'
              );
            }

            if (
              giveaway.status ===
              'active'
            ) {
              return replyText(
                interaction,
                '❌ Ce giveaway n’est pas encore terminé.'
              );
            }

            await startClaimRound(
              id,
              true
            );

            return replyText(
              interaction,
              `✅ Reroll du giveaway #${id} effectué.`
            );
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

          if (
            !config.systems.sessions
          ) {
            return replyText(
              interaction,
              '❌ Les sessions sont désactivées.'
            );
          }

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
              db
                .prepare(`
                  SELECT *
                  FROM sessions
                  WHERE guild_id=?
                    AND active=1
                `)
                .get(
                  interaction.guild.id
                );

            if (
              existing
            ) {
              return replyText(
                interaction,
                '❌ Une session est déjà ouverte.'
              );
            }

            const channel =
              await fetchTextChannel(
                interaction.guild,
                config.channels.sessions
              ) ||
              interaction.channel;

            /*
             * Components V2 cannot contain normal content in the same message.
             * Therefore @everyone is sent immediately before the V2 message.
             */
            if (
              config.sessions
                .pingEveryone
            ) {
              await channel.send({
                content:
                  '@everyone',

                allowedMentions: {
                  parse: [
                    'everyone'
                  ]
                }
              });
            }

            await channel.send(
              v2(
                makeContainer(
                  'Session RP ouverte',

                  [
                    '## État du serveur',
                    '',
                    '**Statut :** 🟢 Ouvert',
                    '',
                    `**Code serveur :** \`${serverCode}\``,
                    '',
                    'La session RP est officiellement ouverte.'
                  ].join('\n'),

                  config.colors.success,

                  [],

                  `${config.serverName} • Session RP`
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

            return replyText(
              interaction,
              '✅ Session RP ouverte.'
            );
          }

          if (
            subcommand ===
            'shutdown'
          ) {
            const session =
              db
                .prepare(`
                  SELECT *
                  FROM sessions
                  WHERE guild_id=?
                    AND active=1
                `)
                .get(
                  interaction.guild.id
                );

            if (
              !session
            ) {
              return replyText(
                interaction,
                '❌ Aucune session active.'
              );
            }

            const channel =
              await fetchTextChannel(
                interaction.guild,
                session.channel_id
              );

            if (
              !channel
            ) {
              return replyText(
                interaction,
                '❌ Salon de session introuvable.'
              );
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
              v2(
                makeContainer(
                  'Session RP fermée',

                  [
                    '## État du serveur',
                    '',
                    '**Statut :** 🔴 Fermé',
                    '',
                    'La session RP est maintenant terminée.',
                    '',
                    'Aucun ping n’est envoyé lors de la fermeture.'
                  ].join('\n'),

                  config.colors.danger,

                  [],

                  `${config.serverName} • Session RP`
                )
              )
            );

            db.prepare(`
              UPDATE sessions
              SET active=0
              WHERE guild_id=?
            `).run(
              interaction.guild.id
            );

            return replyText(
              interaction,
              '✅ Session RP fermée.'
            );
          }
        }
      }

      // ======================================================================
      // STRING SELECT MENUS
      // ======================================================================

      if (
        interaction.isStringSelectMenu()
      ) {
        // APPLICATIONS
        if (
          interaction.customId ===
          'application_menu'
        ) {
          if (
            interaction.values[0] !==
            'staff'
          ) {
            return;
          }

          try {
            await startApplication(
              interaction.user,
              interaction.guild.id
            );

            return replyText(
              interaction,
              '✅ Je viens de t’envoyer un DM pour commencer ta candidature.'
            );
          } catch {
            return replyText(
              interaction,
              '❌ Je ne peux pas t’envoyer de DM. Vérifie tes messages privés.'
            );
          }
        }

        // TICKETS
        if (
          interaction.customId ===
          'ticket_menu'
        ) {
          return createTicket(
            interaction,
            interaction.values[0]
          );
        }

        // CONFIG CATEGORY
        if (
          interaction.customId ===
          'config_category'
        ) {
          if (
            !allowedByRole(
              interaction,
              getConfig(
                interaction.guild.id
              ).roles.config
            )
          ) {
            return replyText(
              interaction,
              '❌ Tu n’as plus accès à la configuration.'
            );
          }

          return interaction.update(
            v2(
              configCategory(
                getConfig(
                  interaction.guild.id
                ),
                interaction.values[0]
              )
            )
          );
        }

        // CONFIG CHANNEL TARGET
        if (
          interaction.customId ===
          'cfg_channel_target'
        ) {
          const target =
            interaction.values[0];

          const picker =
            new ChannelSelectMenuBuilder()
              .setCustomId(
                `cfg_channel_value:${target}`
              )
              .setPlaceholder(
                'Choisir un salon...'
              )
              .setMinValues(
                1
              )
              .setMaxValues(
                1
              )
              .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
                ChannelType.GuildCategory
              );

          return interaction.update(
            v2(
              makeContainer(
                'Choisir un salon',
                `Paramètre : **${target}**\n\nSélectionne le salon à utiliser.`,
                0x5865F2,
                [
                  new ActionRowBuilder()
                    .addComponents(
                      picker
                    )
                ]
              )
            )
          );
        }

        // CONFIG ROLE TARGET
        if (
          interaction.customId ===
          'cfg_role_target'
        ) {
          const target =
            interaction.values[0];

          const picker =
            new RoleSelectMenuBuilder()
              .setCustomId(
                `cfg_role_value:${target}`
              )
              .setPlaceholder(
                'Choisir un rôle...'
              )
              .setMinValues(
                1
              )
              .setMaxValues(
                1
              );

          return interaction.update(
            v2(
              makeContainer(
                'Choisir un rôle',
                `Paramètre : **${target}**\n\nSélectionne le rôle à utiliser.`,
                0x5865F2,
                [
                  new ActionRowBuilder()
                    .addComponents(
                      picker
                    )
                ]
              )
            )
          );
        }

        // CONFIG SECURITY
        if (
          interaction.customId ===
          'cfg_security_target'
        ) {
          const target =
            interaction.values[0];

          if (
            target ===
            'bypass'
          ) {
            const menu =
              new StringSelectMenuBuilder()
                .setCustomId(
                  'cfg_bypass_system'
                )
                .setPlaceholder(
                  'Choisir le système...'
                )
                .addOptions(
                  new StringSelectMenuOptionBuilder()
                    .setLabel(
                      'Anti-raid'
                    )
                    .setValue(
                      'antiRaid'
                    ),

                  new StringSelectMenuOptionBuilder()
                    .setLabel(
                      'Anti-spam'
                    )
                    .setValue(
                      'antiSpam'
                    ),

                  new StringSelectMenuOptionBuilder()
                    .setLabel(
                      'Mass mention'
                    )
                    .setValue(
                      'antiMassMention'
                    ),

                  new StringSelectMenuOptionBuilder()
                    .setLabel(
                      'Suppression massive'
                    )
                    .setValue(
                      'antiMassDelete'
                    ),

                  new StringSelectMenuOptionBuilder()
                    .setLabel(
                      'Mots interdits'
                    )
                    .setValue(
                      'badWords'
                    )
                );

            return interaction.update(
              v2(
                makeContainer(
                  'Rôles bypass',

                  'Choisis d’abord le système auquel les rôles pourront être exemptés.',

                  config.colors.danger,

                  [
                    new ActionRowBuilder()
                      .addComponents(
                        menu
                      )
                  ]
                )
              )
            );
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          const paths = {
            antiRaid:
              'systems.antiRaid',

            antiSpam:
              'systems.antiSpam',

            antiMassMention:
              'systems.antiMassMention',

            antiMassDelete:
              'systems.antiMassDelete',

            badWords:
              'systems.badWords'
          };

          const path =
            paths[target];

          setNested(
            config,
            path,
            !getNested(
              config,
              path
            )
          );

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'security'
              )
            )
          );
        }

        // CONFIG BYPASS SYSTEM
        if (
          interaction.customId ===
          'cfg_bypass_system'
        ) {
          const system =
            interaction.values[0];

          const picker =
            new RoleSelectMenuBuilder()
              .setCustomId(
                `cfg_bypass_roles:${system}`
              )
              .setPlaceholder(
                'Choisir les rôles bypass...'
              )
              .setMinValues(
                1
              )
              .setMaxValues(
                10
              );

          return interaction.update(
            v2(
              makeContainer(
                'Choisir les rôles bypass',

                `Système : **${system}**\n\nSélectionne les rôles qui seront exemptés.`,

                configCategoryColor(
                  interaction.guild.id
                ),

                [
                  new ActionRowBuilder()
                    .addComponents(
                      picker
                    )
                ]
              )
            )
          );
        }

        // CONFIG APPLICATIONS
        if (
          interaction.customId ===
          'cfg_app_target'
        ) {
          const target =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            target ===
            'toggle'
          ) {
            config.systems
              .applications =
              !config.systems
                .applications;

            saveConfig(
              interaction.guild.id,
              config
            );

            await interaction.update(
              v2(
                configCategory(
                  config,
                  'applications'
                )
              )
            );

            await syncAllPanels(
              interaction.guild
            );

            return;
          }

          if (
            target ===
            'questions'
          ) {
            return interaction.update(
              v2(
                makeContainer(
                  'Questions de candidature',

                  config.applications.questions
                    .map(
                      (
                        question,
                        index
                      ) =>
                        `**${
                          index + 1
                        }.** ${question}`
                    )
                    .join(
                      '\n\n'
                    ) ||
                    'Aucune question.',

                  config.colors.primary
                )
              )
            );
          }

          if (
            target ===
            'add'
          ) {
            const modal =
              new ModalBuilder()
                .setCustomId(
                  'cfg_add_question'
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
                .setRequired(
                  true
                )
                .setMaxLength(
                  1000
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

          if (
            target ===
            'remove'
          ) {
            const modal =
              new ModalBuilder()
                .setCustomId(
                  'cfg_remove_question'
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
                  'Numéro de question'
                )
                .setStyle(
                  TextInputStyle.Short
                )
                .setRequired(
                  true
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

          if (
            target ===
            'staffRole'
          ) {
            const picker =
              new RoleSelectMenuBuilder()
                .setCustomId(
                  'cfg_staff_role'
                )
                .setPlaceholder(
                  'Choisir le rôle Staff...'
                )
                .setMinValues(
                  1
                )
                .setMaxValues(
                  1
                );

            return interaction.update(
              v2(
                makeContainer(
                  'Rôle Staff après acceptation',

                  'Sélectionne le rôle qui sera automatiquement attribué lorsqu’une candidature est acceptée.',

                  config.colors.primary,

                  [
                    new ActionRowBuilder()
                      .addComponents(
                        picker
                      )
                  ]
                )
              )
            );
          }
        }

        // CONFIG TICKETS
        if (
          interaction.customId ===
          'cfg_ticket_target'
        ) {
          const target =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            target ===
            'delete'
          ) {
            config.tickets
              .deleteAfterClose =
              !config.tickets
                .deleteAfterClose;

            saveConfig(
              interaction.guild.id,
              config
            );

            return interaction.update(
              v2(
                configCategory(
                  config,
                  'tickets'
                )
              )
            );
          }

          if (
            target ===
              'support_category' ||
            target ===
              'claim_category'
          ) {
            const key =
              target ===
              'support_category'
                ? 'ticketCategorySupport'
                : 'ticketCategoryClaim';

            const picker =
              new ChannelSelectMenuBuilder()
                .setCustomId(
                  `cfg_ticket_category:${key}`
                )
                .setPlaceholder(
                  'Choisir une catégorie...'
                )
                .setMinValues(
                  1
                )
                .setMaxValues(
                  1
                )
                .setChannelTypes(
                  ChannelType.GuildCategory
                );

            return interaction.update(
              v2(
                makeContainer(
                  'Catégorie de tickets',

                  `Paramètre : **${target}**`,

                  config.colors.primary,

                  [
                    new ActionRowBuilder()
                      .addComponents(
                        picker
                      )
                  ]
                )
              )
            );
          }

          const picker =
            new RoleSelectMenuBuilder()
              .setCustomId(
                `cfg_ticket_roles:${target}`
              )
              .setPlaceholder(
                target.endsWith(
                  '_view'
                )
                  ? 'Rôles qui peuvent voir...'
                  : 'Rôles qui recevront le ping...'
              )
              .setMinValues(
                1
              )
              .setMaxValues(
                10
              );

          return interaction.update(
            v2(
              makeContainer(
                'Rôles des tickets',

                target.includes(
                  'view'
                )
                  ? 'Les rôles sélectionnés pourront voir ce type de ticket.'
                  : 'Les rôles sélectionnés seront ping lors de la création.',

                config.colors.primary,

                [
                  new ActionRowBuilder()
                    .addComponents(
                      picker
                    )
                ]
              )
            )
          );
        }

        // CONFIG GIVEAWAYS
        if (
          interaction.customId ===
          'cfg_gw_target'
        ) {
          const target =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            target ===
            'hours'
          ) {
            const modal =
              new ModalBuilder()
                .setCustomId(
                  'cfg_claim_hours'
                )
                .setTitle(
                  'Délai de réclamation'
                );

            const input =
              new TextInputBuilder()
                .setCustomId(
                  'hours'
                )
                .setLabel(
                  'Heures'
                )
                .setStyle(
                  TextInputStyle.Short
                )
                .setPlaceholder(
                  '24'
                )
                .setRequired(
                  true
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

          const picker =
            new RoleSelectMenuBuilder()
              .setCustomId(
                'cfg_giveaway_role'
              )
              .setPlaceholder(
                'Choisir le rôle...'
              )
              .setMinValues(
                1
              )
              .setMaxValues(
                1
              );

          return interaction.update(
            v2(
              makeContainer(
                'Rôle Giveaways',

                'Sélectionne le rôle qui pourra gérer les giveaways lorsque le mode test sera désactivé.',

                config.colors.warning,

                [
                  new ActionRowBuilder()
                    .addComponents(
                      picker
                    )
                ]
              )
            )
          );
        }

        // CONFIG SESSIONS
        if (
          interaction.customId ===
          'cfg_session_target'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            interaction.values[0] ===
            'ping'
          ) {
            config.sessions
              .pingEveryone =
              !config.sessions
                .pingEveryone;
          } else {
            config.sessions
              .clearOnShutdown =
              !config.sessions
                .clearOnShutdown;
          }

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'sessions'
              )
            )
          );
        }

        // CONFIG SYSTEMS
        if (
          interaction.customId ===
          'cfg_system_target'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          const system =
            interaction.values[0];

          config.systems[
            system
          ] =
            !config.systems[
              system
            ];

          saveConfig(
            interaction.guild.id,
            config
          );

          await interaction.update(
            v2(
              configCategory(
                config,
                'systems'
              )
            )
          );

          await syncAllPanels(
            interaction.guild
          );

          return;
        }
      }

      // ======================================================================
      // CHANNEL SELECTS
      // ======================================================================

      if (
        interaction.isChannelSelectMenu()
      ) {
        if (
          interaction.customId.startsWith(
            'cfg_channel_value:'
          )
        ) {
          const key =
            interaction.customId.split(
              ':'
            )[1];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.channels[
            key
          ] =
            interaction.values[0];

          saveConfig(
            interaction.guild.id,
            config
          );

          await interaction.update(
            v2(
              configCategory(
                config,
                'channels'
              )
            )
          );

          await syncAllPanels(
            interaction.guild
          );

          return;
        }

        if (
          interaction.customId.startsWith(
            'cfg_ticket_category:'
          )
        ) {
          const key =
            interaction.customId.split(
              ':'
            )[1];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.channels[
            key
          ] =
            interaction.values[0];

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'tickets'
              )
            )
          );
        }
      }

      // ======================================================================
      // ROLE SELECTS
      // ======================================================================

      if (
        interaction.isRoleSelectMenu()
      ) {
        if (
          interaction.customId.startsWith(
            'cfg_role_value:'
          )
        ) {
          const key =
            interaction.customId.split(
              ':'
            )[1];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.roles[
            key
          ] =
            interaction.values[0];

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'roles'
              )
            )
          );
        }

        if (
          interaction.customId.startsWith(
            'cfg_bypass_roles:'
          )
        ) {
          const system =
            interaction.customId.split(
              ':'
            )[1];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.bypassRoles[
            system
          ] =
            [
              ...interaction.values
            ];

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'security'
              )
            )
          );
        }

        if (
          interaction.customId.startsWith(
            'cfg_ticket_roles:'
          )
        ) {
          const target =
            interaction.customId.split(
              ':'
            )[1];

          const config =
            getConfig(
              interaction.guild.id
            );

          const claim =
            target.startsWith(
              'claim'
            );

          const view =
            target.endsWith(
              '_view'
            );

          const section =
            claim
              ? config.tickets.claim
              : config.tickets.support;

          if (
            view
          ) {
            section.viewRoleIds =
              [
                ...interaction.values
              ];
          } else {
            section.pingRoleIds =
              [
                ...interaction.values
              ];
          }

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'tickets'
              )
            )
          );
        }

        if (
          interaction.customId ===
          'cfg_staff_role'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          config.roles.staff =
            interaction.values[0];

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'applications'
              )
            )
          );
        }

        if (
          interaction.customId ===
          'cfg_giveaway_role'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          config.roles.giveaways =
            interaction.values[0];

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update(
            v2(
              configCategory(
                config,
                'giveaways'
              )
            )
          );
        }

        if (
          interaction.customId ===
          'rules_accept'
        ) {
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
        // CONFIG
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_back'
        ) {
          return interaction.update(
            v2(
              configHome(
                getConfig(
                  interaction.guild.id
                )
              )
            )
          );
        }

        if (
          interaction.customId ===
          'config_refresh'
        ) {
          return interaction.update(
            v2(
              configHome(
                getConfig(
                  interaction.guild.id
                )
              )
            )
          );
        }

        if (
          interaction.customId ===
          'cfg_color'
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                'cfg_color_modal'
              )
              .setTitle(
                'Changer la couleur'
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
              .setRequired(
                true
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

        // --------------------------------------------------------------------
        // RULES
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'rules_accept'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          const role =
            await interaction.guild.roles
              .fetch(
                config.roles.verified
              )
              .catch(
                () => null
              );

          if (
            !role
          ) {
            return replyText(
              interaction,
              '❌ Le rôle de validation est introuvable.'
            );
          }

          await interaction.member.roles
            .add(
              role,
              'Acceptation du règlement'
            )
            .catch(
              () => {}
            );

          return replyText(
            interaction,
            `✅ Règlement accepté. Tu as reçu ${role}.`
          );
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
              interaction.customId.split(
                ':'
              )[1]
            );

          const application =
            db
              .prepare(`
                SELECT *
                FROM applications
                WHERE id=?
                  AND user_id=?
                  AND status='collecting'
              `)
              .get(
                id,
                interaction.user.id
              );

          if (
            !application
          ) {
            return replyText(
              interaction,
              '❌ Cette candidature n’est plus disponible.'
            );
          }

          await interaction.update(
            v2(
              makeContainer(
                'Candidature démarrée',
                'Réponds à chaque question directement dans ce DM.',
                0x57F287
              )
            )
          );

          return askApplication(
            application
          );
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

          const applicationId =
            Number(
              interaction.customId.split(
                ':'
              )[1]
            );

          const modal =
            new ModalBuilder()
              .setCustomId(
                `application_decision:${
                  accepted
                    ? 'accept'
                    : 'refuse'
                }:${applicationId}`
              )
              .setTitle(
                accepted
                  ? 'Accepter la candidature'
                  : 'Refuser la candidature'
              );

          const reason =
            new TextInputBuilder()
              .setCustomId(
                'reason'
              )
              .setLabel(
                'Pourquoi ?'
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setRequired(
                true
              )
              .setMaxLength(
                1000
              );

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
              interaction.customId.split(
                ':'
              )[1]
            );

          const giveaway =
            db
              .prepare(
                'SELECT * FROM giveaways WHERE id=?'
              )
              .get(
                id
              );

          if (
            !giveaway ||
            giveaway.status !==
              'active'
          ) {
            return replyText(
              interaction,
              '❌ Ce giveaway est fermé.'
            );
          }

          if (
            giveaway.end_at <=
            Date.now()
          ) {
            await startClaimRound(
              id,
              false
            );

            return replyText(
              interaction,
              '❌ Ce giveaway vient de se terminer.'
            );
          }

          if (
            giveaway.required_role_id &&
            !interaction.member.roles.cache.has(
              giveaway.required_role_id
            )
          ) {
            return replyText(
              interaction,
              `❌ Tu dois avoir <@&${giveaway.required_role_id}> pour participer.`
            );
          }

          const participants =
            giveawayParticipants(
              giveaway
            );

          if (
            participants.includes(
              interaction.user.id
            )
          ) {
            return replyText(
              interaction,
              '⚠️ Tu participes déjà à ce giveaway.'
            );
          }

          participants.push(
            interaction.user.id
          );

          db.prepare(`
            UPDATE giveaways
            SET participants=?
            WHERE id=?
          `).run(
            JSON.stringify(
              participants
            ),
            id
          );

          await editGiveaway(
            db
              .prepare(
                'SELECT * FROM giveaways WHERE id=?'
              )
              .get(
                id
              )
          );

          return replyText(
            interaction,
            '🎉 Tu participes maintenant au giveaway !'
          );
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
              interaction.customId.split(
                ':'
              )[1]
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

          return interaction.reply(
            v2(
              makeContainer(
                'Quitter le giveaway ?',

                'Tu participes actuellement à ce giveaway.\n\nVeux-tu vraiment retirer ta participation ?',

                0xED4245,

                [
                  new ActionRowBuilder()
                    .addComponents(
                      confirm
                    )
                ],

                'Confirmation visible uniquement par toi.'
              ),
              true
            )
          );
        }

        if (
          interaction.customId.startsWith(
            'giveaway_confirm_leave:'
          )
        ) {
          const id =
            Number(
              interaction.customId.split(
                ':'
              )[1]
            );

          const giveaway =
            db
              .prepare(
                'SELECT * FROM giveaways WHERE id=?'
              )
              .get(
                id
              );

          if (
            !giveaway
          ) {
            return interaction.update(
              v2(
                makeContainer(
                  'Giveaway introuvable',
                  'Ce giveaway n’existe plus.',
                  0xED4245
                ),
                true
              )
            );
          }

          const participants =
            giveawayParticipants(
              giveaway
            ).filter(
              userId =>
                userId !==
                interaction.user.id
            );

          db.prepare(`
            UPDATE giveaways
            SET participants=?
            WHERE id=?
          `).run(
            JSON.stringify(
              participants
            ),
            id
          );

          await editGiveaway(
            db
              .prepare(
                'SELECT * FROM giveaways WHERE id=?'
              )
              .get(
                id
              )
          );

          return interaction.update(
            v2(
              makeContainer(
                'Participation retirée',
                'Tu as quitté le giveaway avec succès.',
                0x57F287
              ),
              true
            )
          );
        }

        // --------------------------------------------------------------------
        // TICKET CLOSE
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'ticket_close'
        ) {
          return closeTicket(
            interaction
          );
        }

        // --------------------------------------------------------------------
        // SUGGESTION CREATE
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
                'text'
              )
              .setLabel(
                'Ta suggestion'
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setRequired(
                true
              )
              .setMaxLength(
                2000
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

        // --------------------------------------------------------------------
        // SUGGESTION VOTES
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'suggestion_up:'
          ) ||
          interaction.customId.startsWith(
            'suggestion_down:'
          )
        ) {
          const up =
            interaction.customId.startsWith(
              'suggestion_up:'
            );

          const id =
            Number(
              interaction.customId.split(
                ':'
              )[1]
            );

          const suggestion =
            db
              .prepare(
                'SELECT * FROM suggestions WHERE id=?'
              )
              .get(
                id
              );

          if (
            !suggestion
          ) {
            return replyText(
              interaction,
              '❌ Suggestion introuvable.'
            );
          }

          let upvotes =
            JSON.parse(
              suggestion.upvotes ||
                '[]'
            );

          let downvotes =
            JSON.parse(
              suggestion.downvotes ||
                '[]'
            );

          if (
            up
          ) {
            downvotes =
              downvotes.filter(
                userId =>
                  userId !==
                  interaction.user.id
              );

            if (
              upvotes.includes(
                interaction.user.id
              )
            ) {
              upvotes =
                upvotes.filter(
                  userId =>
                    userId !==
                    interaction.user.id
                );
            } else {
              upvotes.push(
                interaction.user.id
              );
            }
          } else {
            upvotes =
              upvotes.filter(
                userId =>
                  userId !==
                  interaction.user.id
              );

            if (
              downvotes.includes(
                interaction.user.id
              )
            ) {
              downvotes =
                downvotes.filter(
                  userId =>
                    userId !==
                    interaction.user.id
                );
            } else {
              downvotes.push(
                interaction.user.id
              );
            }
          }

          db.prepare(`
            UPDATE suggestions
            SET
              upvotes=?,
              downvotes=?
            WHERE id=?
          `).run(
            JSON.stringify(
              upvotes
            ),
            JSON.stringify(
              downvotes
            ),
            id
          );

          const channel =
            await fetchTextChannel(
              interaction.guild,
              suggestion.channel_id
            );

          if (
            channel
          ) {
            try {
              const message =
                await channel.messages.fetch(
                  suggestion.message_id
                );

              const config =
                getConfig(
                  interaction.guild.id
                );

              const upButton =
                new ButtonBuilder()
                  .setCustomId(
                    `suggestion_up:${id}`
                  )
                  .setLabel(
                    `Pour ${upvotes.length}`
                  )
                  .setEmoji(
                    '👍'
                  )
                  .setStyle(
                    ButtonStyle.Success
                  );

              const downButton =
                new ButtonBuilder()
                  .setCustomId(
                    `suggestion_down:${id}`
                  )
                  .setLabel(
                    `Contre ${downvotes.length}`
                  )
                  .setEmoji(
                    '👎'
                  )
                  .setStyle(
                    ButtonStyle.Danger
                  );

              await message.edit(
                v2(
                  makeContainer(
                    `Suggestion #${id}`,

                    `**Auteur :** <@${suggestion.user_id}>\n\n` +
                      `${suggestion.text}\n\n` +
                      '**Statut :** 🕐 En attente',

                    config.colors.warning,

                    [
                      new ActionRowBuilder()
                        .addComponents(
                          upButton,
                          downButton
                        )
                    ],

                    `${config.serverName} • Suggestions`
                  )
                )
              );
            } catch {}
          }

          return replyText(
            interaction,
            '✅ Ton vote a été enregistré.'
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
            interaction.customId.split(
              ':'
            );

          const action =
            parts[1];

          const id =
            Number(
              parts[2]
            );

          const application =
            db
              .prepare(`
                SELECT *
                FROM applications
                WHERE id=?
                  AND guild_id=?
              `)
              .get(
                id,
                interaction.guild.id
              );

          if (
            !application ||
            application.status !==
              'pending'
          ) {
            return replyText(
              interaction,
              '❌ Cette candidature est déjà traitée.'
            );
          }

          const reason =
            interaction.fields.getTextInputValue(
              'reason'
            );

          const accepted =
            action ===
            'accept';

          db.prepare(`
            UPDATE applications
            SET
              status=?,
              decided_at=?,
              decided_by=?,
              reason=?
            WHERE id=?
          `).run(
            accepted
              ? 'accepted'
              : 'refused',
            Date.now(),
            interaction.user.id,
            reason,
            id
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

            if (
              member
            ) {
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
                await fetchTextChannel(
                  interaction.guild,
                  application.log_channel_id
                );

              const message =
                await channel.messages.fetch(
                  application.log_message_id
                );

              await message.edit(
                v2(
                  makeContainer(
                    accepted
                      ? `Candidature #${id} acceptée`
                      : `Candidature #${id} refusée`,

                    [
                      `**Candidat :** <@${application.user_id}>`,
                      `**Traité par :** ${interaction.user}`,
                      '',
                      `**Raison :** ${reason}`,
                      '',
                      accepted
                        ? '✅ Acceptée'
                        : '❌ Refusée'
                    ].join('\n'),

                    accepted
                      ? config.colors.success
                      : config.colors.danger,

                    [],

                    `${config.serverName} • Candidature traitée`
                  )
                )
              );
            } catch {}
          }

          const user =
            await client.users
              .fetch(
                application.user_id
              )
              .catch(
                () => null
              );

          if (
            user
          ) {
            await user
              .send(
                v2(
                  makeContainer(
                    accepted
                      ? 'Candidature acceptée'
                      : 'Candidature refusée',

                    [
                      accepted
                        ? `Félicitations ! Ta candidature Staff sur **${config.serverName}** a été acceptée.`
                        : `Ta candidature Staff sur **${config.serverName}** a été refusée.`,
                      '',
                      `**Raison :** ${reason}`
                    ].join('\n'),

                    accepted
                      ? config.colors.success
                      : config.colors.danger
                  )
                )
              )
              .catch(
                () => {}
              );
          }

          return replyText(
            interaction,
            accepted
              ? '✅ Candidature acceptée et candidat averti.'
              : '✅ Candidature refusée et candidat averti.'
          );
        }

        // --------------------------------------------------------------------
        // SUGGESTION MODAL
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'suggestion_modal'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          const channel =
            await fetchTextChannel(
              interaction.guild,
              config.channels.suggestions
            );

          if (
            !channel
          ) {
            return replyText(
              interaction,
              '❌ Le salon des suggestions est introuvable.'
            );
          }

          const text =
            interaction.fields.getTextInputValue(
              'text'
            );

          const result =
            db
              .prepare(`
                INSERT INTO suggestions (
                  guild_id,
                  channel_id,
                  message_id,
                  user_id,
                  text,
                  created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
              `)
              .run(
                interaction.guild.id,
                channel.id,
                'pending',
                interaction.user.id,
                text,
                Date.now()
              );

          const upButton =
            new ButtonBuilder()
              .setCustomId(
                `suggestion_up:${result.lastInsertRowid}`
              )
              .setLabel(
                'Pour 0'
              )
              .setEmoji(
                '👍'
              )
              .setStyle(
                ButtonStyle.Success
              );

          const downButton =
            new ButtonBuilder()
              .setCustomId(
                `suggestion_down:${result.lastInsertRowid}`
              )
              .setLabel(
                'Contre 0'
              )
              .setEmoji(
                '👎'
              )
              .setStyle(
                ButtonStyle.Danger
              );

          const message =
            await channel.send(
              v2(
                makeContainer(
                  `Suggestion #${result.lastInsertRowid}`,

                  [
                    `**Auteur :** <@${interaction.user.id}>`,
                    '',
                    text,
                    '',
                    '**Statut :** 🕐 En attente'
                  ].join('\n'),

                  config.colors.warning,

                  [
                    new ActionRowBuilder()
                      .addComponents(
                        upButton,
                        downButton
                      )
                  ],

                  `${config.serverName} • Suggestions`
                )
              )
            );

          db.prepare(`
            UPDATE suggestions
            SET message_id=?
            WHERE id=?
          `).run(
            message.id,
            result.lastInsertRowid
          );

          return replyText(
            interaction,
            `✅ Suggestion envoyée dans ${channel}.`
          );
        }

        // --------------------------------------------------------------------
        // CONFIG ADD QUESTION
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'cfg_add_question'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          config.applications
            .questions
            .push(
              interaction.fields.getTextInputValue(
                'question'
              )
            );

          saveConfig(
            interaction.guild.id,
            config
          );

          await syncAllPanels(
            interaction.guild
          );

          return replyText(
            interaction,
            '✅ Question ajoutée.'
          );
        }

        // --------------------------------------------------------------------
        // CONFIG REMOVE QUESTION
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'cfg_remove_question'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          const index =
            Number(
              interaction.fields.getTextInputValue(
                'index'
              )
            ) - 1;

          if (
            !Number.isInteger(
              index
            ) ||
            !config.applications
              .questions[index]
          ) {
            return replyText(
              interaction,
              '❌ Numéro de question invalide.'
            );
          }

          config.applications
            .questions
            .splice(
              index,
              1
            );

          saveConfig(
            interaction.guild.id,
            config
          );

          await syncAllPanels(
            interaction.guild
          );

          return replyText(
            interaction,
            '✅ Question supprimée.'
          );
        }

        // --------------------------------------------------------------------
        // CONFIG CLAIM HOURS
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'cfg_claim_hours'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          const hours =
            Number(
              interaction.fields.getTextInputValue(
                'hours'
              )
            );

          if (
            !Number.isFinite(
              hours
            ) ||
            hours < 1 ||
            hours > 168
          ) {
            return replyText(
              interaction,
              '❌ Entre une durée comprise entre 1 et 168 heures.'
            );
          }

          config.giveaways
            .claimHours =
            hours;

          saveConfig(
            interaction.guild.id,
            config
          );

          return replyText(
            interaction,
            `✅ Délai défini sur ${hours} heure(s).`
          );
        }

        // --------------------------------------------------------------------
        // CONFIG COLOR
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'cfg_color_modal'
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
            return replyText(
              interaction,
              '❌ Couleur invalide. Exemple : #5865F2'
            );
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          config.colors.primary =
            parseInt(
              hex,
              16
            );

          saveConfig(
            interaction.guild.id,
            config
          );

          await syncAllPanels(
            interaction.guild
          );

          return replyText(
            interaction,
            `✅ Couleur mise à jour : #${hex.toUpperCase()}`
          );
        }
      }
    } catch (
      error
    ) {
      console.error(
        '❌ Interaction error:',
        error
      );

      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          return interaction.followUp({
            content:
              '❌ Une erreur est survenue. Vérifie la console du bot.',
            flags:
              MessageFlags.Ephemeral
          });
        }

        return interaction.reply({
          content:
            '❌ Une erreur est survenue. Vérifie la console du bot.',
          flags:
            MessageFlags.Ephemeral
        });
      } catch {}
    }
  }
);

// ============================================================================
// CONFIG HELPERS
// ============================================================================

function configCategoryColor(
  guildId
) {
  return getConfig(
    guildId
  ).colors.primary;
}

// ============================================================================
// ERRORS
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

client
  .login(
    TOKEN
  )
  .then(
    () =>
      console.log(
        '🔌 Connexion Discord lancée...'
      )
  )
  .catch(
    error => {
      console.error(
        '❌ Connexion Discord impossible:',
        error
      );

      process.exit(1);
    }
  );
