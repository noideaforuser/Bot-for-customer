/*
╔══════════════════════════════════════════════════════════════════════════════╗
║                              BRETAGNE RP                                    ║
║                          Discord Bot • v2.0                                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  BOT                                                                       ║
║  ├─ Welcome + DM                                                           ║
║  ├─ Règlement + validation                                                 ║
║  ├─ Candidatures Staff                                                     ║
║  ├─ Giveaways + réclamation 24h                                            ║
║  ├─ Tickets multi-types                                                    ║
║  ├─ Sessions RP                                                             ║
║  ├─ Suggestions                                                             ║
║  ├─ Anti-raid                                                               ║
║  ├─ Anti-spam                                                               ║
║  ├─ Anti-mass mention                                                       ║
║  ├─ Anti-mass delete                                                        ║
║  ├─ Mots interdits multilingues                                             ║
║  ├─ Sanctions progressives                                                  ║
║  └─ Configuration interactive                                               ║
║                                                                              ║
║  TEST MODE                                                                  ║
║  ────────────────────────────────────────────────────────────────────────  ║
║  Les restrictions de rôle pour /config et /giveaway ne sont PAS forcées    ║
║  pour le moment. Elles sont enregistrées et prêtes à être activées plus    ║
║  tard depuis la configuration.                                             ║
║                                                                              ║
║  INSTALL                                                                    ║
║  npm install discord.js better-sqlite3                                      ║
║                                                                              ║
║  ENV                                                                         ║
║  DISCORD_TOKEN=...                                                           ║
║  CLIENT_ID=...                                                              ║
║  GUILD_ID=...                                                               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
*/

'use strict';

// ============================================================================
// IMPORTS
// ============================================================================

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

  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,

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
// ENVIRONMENT
// ============================================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;

if (!TOKEN || !CLIENT_ID) {
  console.error('');
  console.error('❌ Configuration manquante.');
  console.error('DISCORD_TOKEN ou CLIENT_ID n’est pas défini.');
  console.error('');
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
  ended INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  current_winner_id TEXT,
  claim_deadline INTEGER,
  claim_round INTEGER NOT NULL DEFAULT 0,
  expired_winners TEXT NOT NULL DEFAULT '[]',
  announcement_message_id TEXT,
  claim_ticket_channel_id TEXT,
  claimed_at INTEGER
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

CREATE TABLE IF NOT EXISTS user_sanctions (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  strikes INTEGER NOT NULL DEFAULT 0,
  last_strike_at INTEGER,
  PRIMARY KEY (guild_id, user_id)
);
`);

// ============================================================================
// DATABASE MIGRATIONS
// ============================================================================

function tableHasColumn(tableName, columnName) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all();

  return columns.some(
    column => column.name === columnName
  );
}

function ensureColumn(
  tableName,
  columnName,
  definition
) {
  if (!tableHasColumn(tableName, columnName)) {
    db.exec(`
      ALTER TABLE ${tableName}
      ADD COLUMN ${columnName} ${definition}
    `);

    console.log(
      `🛠️ DB migration: ${tableName}.${columnName}`
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
  'claimed_at',
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

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG = {
  serverName: 'Bretagne RP',

  /*
   * TEST MODE
   * --------------------------------------------------------------------------
   * true = role restrictions are not enforced.
   * false = configured role restrictions become active.
   */
  testMode: true,

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

    /*
     * The panel can be left blank during testing.
     * The bot will reuse its previous panel location or find a usable
     * fallback channel.
     */
    ticketPanel: null,

    ticketCategorySupport: null,
    ticketCategoryGiveawayClaim: null
  },

  roles: {
    /*
     * Role given after accepting the rules.
     */
    verified: '1548280026842005594',

    staff: null,

    /*
     * Default role requested by the user for:
     * - config access
     * - giveaway management
     * - current ticket pings
     */
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

  /*
   * Each ticket type can have its own:
   * - panel label
   * - category
   * - viewer roles
   * - ping roles
   */
  tickets: {
    panelDescription:
      'Sélectionne le type de ticket correspondant à ta demande.',

    support: {
      label: 'Ouvrir un ticket',
      description:
        'Besoin d’aide ou d’assistance ?',
      emoji: '🎫',

      categoryId: null,

      /*
       * Default viewer + ping role requested by the user.
       */
      viewRoleIds: [
        '1548279987453296643'
      ],

      pingRoleIds: [
        '1548279987453296643'
      ]
    },

    giveawayClaim: {
      label: 'Giveaways • Réclamation',
      description:
        'Réclamer un giveaway que tu viens de gagner.',
      emoji: '🏆',

      categoryId: null,

      viewRoleIds: [
        '1548279987453296643'
      ],

      pingRoleIds: [
        '1548279987453296643'
      ]
    },

    deleteAfterClose: true,
    prefix: 'ticket'
  },

  sessions: {
    autoPingEveryone: true,
    clearOnShutdown: true
  },

  giveaways: {
    minimumDurationSeconds: 10,
    claimHours: 24
  },

  security: {
    antiRaid: {
      joinThreshold: 8,
      windowSeconds: 10,
      timeoutNewMembers: true
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
      enabled: true
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
// CONFIG STORAGE
// ============================================================================

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
  const row = db
    .prepare(`
      SELECT data
      FROM configs
      WHERE guild_id = ?
    `)
    .get(guildId);

  if (!row) {
    const config =
      clone(DEFAULT_CONFIG);

    db.prepare(`
      INSERT INTO configs (
        guild_id,
        data
      )
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
      (acc, key) => acc?.[key],
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
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }

    current =
      current[parts[i]];
  }

  current[
    parts[parts.length - 1]
  ] = value;
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
// RUNTIME
// ============================================================================

const spamTracker = new Map();
const raidTracker = new Map();

// ============================================================================
// BAD WORD LIST
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
  'piç',
  'pic',

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

  // Arabic common profanity
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
  const normalized =
    normalizeText(
      content
    );

  const words =
    new Set(
      normalized
        .split(/\s+/)
        .filter(Boolean)
    );

  for (
    const word of DEFAULT_BAD_WORDS
  ) {
    if (
      words.has(
        normalizeText(word)
      )
    ) {
      return word;
    }
  }

  for (
    const word of config.customBadWords
  ) {
    if (
      words.has(
        normalizeText(word)
      )
    ) {
      return word;
    }
  }

  return null;
}

// ============================================================================
// SANCTIONS
// ============================================================================

/*
30 seconds
1 minute
5 minutes
10 minutes
30 minutes
1 hour
6 hours
12 hours
24 hours
*/
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

function currentDayKey() {
  const now =
    new Date();

  return [
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ].join('-');
}

function getStrikeCount(
  guildId,
  userId
) {
  const row =
    db.prepare(`
      SELECT *
      FROM user_sanctions
      WHERE guild_id = ?
        AND user_id = ?
    `).get(
      guildId,
      userId
    );

  if (!row) {
    return 0;
  }

  if (
    !row.last_strike_at
  ) {
    return row.strikes;
  }

  const date =
    new Date(
      row.last_strike_at
    );

  const storedDay = [
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ].join('-');

  if (
    storedDay !==
    currentDayKey()
  ) {
    return 0;
  }

  return row.strikes;
}

function addStrike(
  guildId,
  userId
) {
  const current =
    getStrikeCount(
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
    ON CONFLICT(
      guild_id,
      user_id
    )
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

function timeoutSecondsForStrike(
  strike
) {
  return SANCTION_STEPS[
    Math.min(
      Math.max(
        strike - 1,
        0
      ),
      SANCTION_STEPS.length - 1
    )
  ];
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

  return '24 heures';
}

async function applyProgressiveTimeout(
  member,
  reason
) {
  if (
    !member ||
    !member.moderatable
  ) {
    return null;
  }

  const strike =
    addStrike(
      member.guild.id,
      member.id
    );

  const seconds =
    timeoutSecondsForStrike(
      strike
    );

  try {
    await member.timeout(
      seconds * 1000,
      reason
    );
  } catch {
    return null;
  }

  try {
    await member.user.send(
      v2Message(
        container({
          title:
            'Sanction automatique',
          description:
            `Ton message a été supprimé automatiquement.\n\n` +
            `**Raison :** ${reason}\n\n` +
            `**Sanction :** timeout de ${formatDuration(seconds)}\n` +
            `**Niveau :** ${strike}\n\n` +
            `Les sanctions augmentent progressivement et le compteur est réinitialisé à la fin de la journée.`,
          accent:
            0xED4245,
          footer:
            'Bretagne RP • Modération automatique'
        })
      )
    );
  } catch {
    // DM fermé.
  }

  return {
    strike,
    seconds
  };
}

// ============================================================================
// V2 BUILDERS
// ============================================================================

function container({
  title,
  description,
  accent = 0x5865F2,
  footer = null,
  rows = []
}) {
  const result =
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
    const item of rows
  ) {
    result.addActionRowComponents(
      item
    );
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

function v2Message(
  component
) {
  return {
    flags:
      MessageFlags.IsComponentsV2,
    components: [
      component
    ]
  };
}

function v2Reply(
  interaction,
  component,
  ephemeral = false
) {
  let flags =
    MessageFlags.IsComponentsV2;

  if (ephemeral) {
    flags |=
      MessageFlags.Ephemeral;
  }

  return interaction.reply({
    flags,
    components: [
      component
    ]
  });
}

function textReply(
  interaction,
  content,
  ephemeral = true
) {
  return interaction.reply({
    content,
    ...(ephemeral
      ? {
          flags:
            MessageFlags.Ephemeral
        }
      : {})
  });
}

// ============================================================================
// PERMISSIONS
// ============================================================================

function isStaffMember(
  member
) {
  if (!member) {
    return false;
  }

  return (
    member.permissions.has(
      PermissionFlagsBits.Administrator
    ) ||
    member.permissions.has(
      PermissionFlagsBits.ManageGuild
    )
  );
}

function roleRestrictionPasses(
  member,
  config,
  roleId
) {
  if (
    config.testMode
  ) {
    return true;
  }

  if (
    isStaffMember(member)
  ) {
    return true;
  }

  if (
    !roleId
  ) {
    return false;
  }

  return member.roles.cache.has(
    roleId
  );
}

function hasBypass(
  member,
  config,
  system
) {
  if (
    !member?.roles?.cache
  ) {
    return false;
  }

  const roles =
    config.bypassRoles[
      system
    ] || [];

  return roles.some(
    roleId =>
      member.roles.cache.has(
        roleId
      )
  );
}

// ============================================================================
// CHANNEL / ROLE HELPERS
// ============================================================================

async function getTextChannel(
  guild,
  channelId
) {
  if (!channelId) {
    return null;
  }

  let channel =
    guild.channels.cache.get(
      channelId
    );

  if (
    channel &&
    channel.isTextBased()
  ) {
    return channel;
  }

  try {
    channel =
      await guild.channels.fetch(
        channelId
      );

    if (
      channel &&
      channel.isTextBased()
    ) {
      return channel;
    }
  } catch {}

  return null;
}

async function getRole(
  guild,
  roleId
) {
  if (!roleId) {
    return null;
  }

  let role =
    guild.roles.cache.get(
      roleId
    );

  if (role) {
    return role;
  }

  try {
    role =
      await guild.roles.fetch(
        roleId
      );

    return role;
  } catch {
    return null;
  }
}

async function findFallbackChannel(
  guild
) {
  const preferred = [
    guild.systemChannel,
    await getTextChannel(
      guild,
      getConfig(
        guild.id
      ).channels.welcome
    ),
    await getTextChannel(
      guild,
      getConfig(
        guild.id
      ).channels.suggestions
    )
  ];

  for (
    const channel of preferred
  ) {
    if (
      channel?.isTextBased()
    ) {
      const me =
        guild.members.me;

      if (
        me &&
        channel
          .permissionsFor(me)
          ?.has(
            PermissionFlagsBits.SendMessages
          )
      ) {
        return channel;
      }
    }
  }

  return guild.channels.cache.find(
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
  ) || null;
}

// ============================================================================
// PANEL STORAGE
// ============================================================================

function getStoredPanel(
  guildId,
  panelKey
) {
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
    ON CONFLICT(
      guild_id,
      panel_key
    )
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
// AUTO PANEL ENGINE
// ============================================================================

async function syncPanel(
  guild,
  key,
  channel,
  builder
) {
  if (
    !channel ||
    !channel.isTextBased()
  ) {
    return;
  }

  const stored =
    getStoredPanel(
      guild.id,
      key
    );

  if (stored) {
    try {
      const oldChannel =
        await getTextChannel(
          guild,
          stored.channel_id
        );

      if (
        oldChannel
      ) {
        const message =
          await oldChannel.messages.fetch(
            stored.message_id
          );

        if (
          message
        ) {
          await message.edit(
            v2Message(
              builder()
            )
          );

          savePanel(
            guild.id,
            key,
            oldChannel.id,
            message.id
          );

          return;
        }
      }
    } catch {
      // Old panel gone.
      // We recreate it below.
    }
  }

  const message =
    await channel.send(
      v2Message(
        builder()
      )
    );

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
      .setEmoji('✅')
      .setStyle(
        ButtonStyle.Success
      );

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

  return container({
    title:
      'Règlement RP France',
    description:
      rulesText,
    accent:
      config.appearance.successColor,
    rows: [
      new ActionRowBuilder()
        .addComponents(
          accept
        )
    ],
    footer:
      `${config.serverName} • Merci de respecter les règles`
  });
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
          .setEmoji('📋')
          .setValue('staff')
      );

  return container({
    title:
      config.systems.applications
        ? 'Candidatures Staff'
        : 'Candidatures Staff • Fermées',

    description:
      config.systems.applications
        ? [
            '## Rejoindre le Staff',
            '',
            'Tu souhaites rejoindre **Bretagne RP** ?',
            '',
            'La candidature se déroule directement en **DM** avec le bot.',
            '',
            'Les questions arrivent une par une et chaque réponse est enregistrée automatiquement.',
            '',
            'Choisis **Candidature Staff** pour commencer.'
          ].join('\n')
        : [
            '## Recrutement fermé',
            '',
            'Les candidatures Staff sont actuellement fermées.',
            '',
            'Le Staff pourra les rouvrir directement depuis `/config`.'
          ].join('\n'),

    accent:
      config.systems.applications
        ? config.appearance.accentColor
        : config.appearance.dangerColor,

    rows: [
      new ActionRowBuilder()
        .addComponents(
          menu
        )
    ],

    footer:
      `${config.serverName} • Recrutement`
  });
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
            config.tickets
              .giveawayClaim
              .label
          )
          .setDescription(
            config.tickets
              .giveawayClaim
              .description
          )
          .setEmoji(
            config.tickets
              .giveawayClaim
              .emoji
          )
          .setValue(
            'giveawayClaim'
          )
      );

  return container({
    title:
      config.systems.tickets
        ? 'Centre de support'
        : 'Centre de support • Fermé',

    description:
      config.systems.tickets
        ? [
            '## Ouvrir un ticket',
            '',
            config.tickets.panelDescription,
            '',
            '### 🎫 Support',
            'Pour une demande générale, une question ou un problème.',
            '',
            '### 🏆 Giveaway • Réclamation',
            'Uniquement pour les gagnants d’un giveaway actuellement en attente de réclamation.',
            '',
            'Les tickets sont privés et les rôles autorisés sont configurables.'
          ].join('\n')
        : [
            '## Tickets temporairement fermés',
            '',
            'Le système de tickets est actuellement désactivé.'
          ].join('\n'),

    accent:
      config.systems.tickets
        ? config.appearance.accentColor
        : config.appearance.dangerColor,

    rows: [
      new ActionRowBuilder()
        .addComponents(
          menu
        )
    ],

    footer:
      `${config.serverName} • Support`
  });
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
      .setEmoji('💡')
      .setStyle(
        ButtonStyle.Primary
      );

  return container({
    title:
      'Suggestions',
    description:
      [
        '## Une idée pour Bretagne RP ?',
        '',
        'Les suggestions permettent de proposer des améliorations pour le serveur.',
        '',
        'Explique ton idée clairement. Les membres pourront ensuite voter.',
        '',
        config.systems.suggestions
          ? 'Clique sur **Créer une suggestion** pour commencer.'
          : 'Le système de suggestions est actuellement désactivé.'
      ].join('\n'),

    accent:
      config.systems.suggestions
        ? config.appearance.warningColor
        : config.appearance.dangerColor,

    rows: [
      new ActionRowBuilder()
        .addComponents(
          button.setDisabled(
            !config.systems.suggestions
          )
        )
    ],

    footer:
      `${config.serverName} • Tes idées comptent`
  });
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

  // Rules
  if (
    config.channels.rules
  ) {
    const channel =
      await getTextChannel(
        guild,
        config.channels.rules
      );

    if (
      channel
    ) {
      await syncPanel(
        guild,
        'rules',
        channel,
        () =>
          buildRulesPanel(
            config
          )
      );
    }
  }

  // Applications
  if (
    config.channels.applicationLogs
  ) {
    const channel =
      await getTextChannel(
        guild,
        config.channels.applicationLogs
      );

    if (
      channel
    ) {
      await syncPanel(
        guild,
        'applications',
        channel,
        () =>
          buildApplicationPanel(
            config
          )
      );
    }
  }

  // Ticket panel
  let ticketPanelChannel =
    await getTextChannel(
      guild,
      config.channels.ticketPanel
    );

  if (
    !ticketPanelChannel
  ) {
    const stored =
      getStoredPanel(
        guild.id,
        'tickets'
      );

    if (
      stored
    ) {
      ticketPanelChannel =
        await getTextChannel(
          guild,
          stored.channel_id
        );
    }
  }

  if (
    !ticketPanelChannel
  ) {
    ticketPanelChannel =
      await findFallbackChannel(
        guild
      );
  }

  if (
    ticketPanelChannel
  ) {
    await syncPanel(
      guild,
      'tickets',
      ticketPanelChannel,
      () =>
        buildTicketPanel(
          config
        )
    );
  }

  // Suggestions panel
  if (
    config.channels.suggestions
  ) {
    const channel =
      await getTextChannel(
        guild,
        config.channels.suggestions
      );

    if (
      channel
    ) {
      await syncPanel(
        guild,
        'suggestions',
        channel,
        () =>
          buildSuggestionPanel(
            config
          )
      );
    }
  }
}

// ============================================================================
// WELCOME
// ============================================================================

async function sendWelcome(
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
    await getTextChannel(
      member.guild,
      config.channels.welcome
    );

  if (
    channel
  ) {
    try {
      await channel.send(
        v2Message(
          container({
            title:
              config.welcome.title,
            description:
              [
                `${member}`,
                '',
                config.welcome.message,
                '',
                'Bienvenue dans la communauté.'
              ].join('\n'),
            accent:
              config.appearance.accentColor,
            footer:
              `${config.serverName} • Nouveau membre`
          })
        )
      );
    } catch {}
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
  } catch {}
}

// ============================================================================
// APPLICATION SYSTEM
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
      'APPLICATIONS_CLOSED'
    );
  }

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

  if (
    existing
  ) {
    await user.send(
      v2Message(
        container({
          title:
            'Candidature déjà en cours',
          description:
            'Tu as déjà une candidature en cours.\n\n' +
            'Termine celle-ci avant d’en commencer une nouvelle.',
          accent:
            config.appearance.warningColor
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
      .setLabel(
        'Commencer'
      )
      .setEmoji('▶️')
      .setStyle(
        ButtonStyle.Primary
      );

  await user.send(
    v2Message(
      container({
        title:
          'Candidature Staff',
        description:
          [
            'Bienvenue dans le système de candidature de **Bretagne RP**.',
            '',
            'Le bot va te poser plusieurs questions, une par une.',
            '',
            'Réponds directement à chaque question.',
            '',
            'Lorsque tu es prêt, clique sur **Commencer**.'
          ].join('\n'),
        accent:
          config.appearance.accentColor,
        rows: [
          new ActionRowBuilder()
            .addComponents(
              start
            )
        ],
        footer:
          `Candidature #${result.lastInsertRowid}`
      })
    )
  );
}

async function askApplicationQuestion(
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
          [
            question,
            '',
            'Réponds directement dans ce DM.'
          ].join('\n'),
        accent:
          config.appearance.accentColor,
        footer:
          'Une réponse à la fois • Bretagne RP'
      })
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
    await getTextChannel(
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
      application.answers || '[]'
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
      .setLabel(
        'Accepter'
      )
      .setEmoji('✅')
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
      .setEmoji('❌')
      .setStyle(
        ButtonStyle.Danger
      );

  const message =
    await channel.send(
      v2Message(
        container({
          title:
            `Candidature Staff #${application.id}`,
          description:
            [
              `**Candidat :** <@${application.user_id}>`,
              `**Créée :** <t:${Math.floor(application.created_at / 1000)}:F>`,
              '',
              formatted
            ].join('\n'),
          accent:
            config.appearance.accentColor,
          rows: [
            new ActionRowBuilder()
              .addComponents(
                accept,
                refuse
              )
          ],
          footer:
            'Utilisez les boutons pour prendre une décision.'
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
            [
              'Merci !',
              '',
              'Ta candidature a été envoyée au Staff.',
              '',
              'Tu recevras un message privé lorsque la décision aura été prise.'
            ].join('\n'),
          accent:
            config.appearance.accentColor
        })
      )
    );
  } catch {}
}

// ============================================================================
// TICKET TYPE HELPERS
// ============================================================================

function ticketTypeConfig(
  config,
  type
) {
  if (
    type === 'giveawayClaim'
  ) {
    return config.tickets.giveawayClaim;
  }

  return config.tickets.support;
}

function ticketTypeName(
  type
) {
  return type === 'giveawayClaim'
    ? 'Giveaway • Réclamation'
    : 'Support';
}

function ticketPingMentions(
  type,
  config
) {
  const ticket =
    ticketTypeConfig(
      config,
      type
    );

  return ticket
    .pingRoleIds
    .map(
      roleId =>
        `<@&${roleId}>`
    )
    .join(' ');
}

// ============================================================================
// GIVEAWAY CLAIM CHECK
// ============================================================================

function getActiveClaimForUser(
  guildId,
  userId
) {
  return db.prepare(`
    SELECT *
    FROM giveaways
    WHERE guild_id = ?
      AND status = 'awaiting_claim'
      AND current_winner_id = ?
      AND claim_deadline > ?
    ORDER BY id DESC
    LIMIT 1
  `).get(
    guildId,
    userId,
    Date.now()
  );
}

// ============================================================================
// CREATE TICKET
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
    return textReply(
      interaction,
      '❌ Le système de tickets est actuellement désactivé.'
    );
  }

  // --------------------------------------------------------------------------
  // Giveaway claim validation
  // --------------------------------------------------------------------------

  let giveaway = null;

  if (
    type === 'giveawayClaim'
  ) {
    giveaway =
      getActiveClaimForUser(
        guild.id,
        interaction.user.id
      );

    if (
      !giveaway
    ) {
      return textReply(
        interaction,
        '❌ Tu n’as actuellement aucun giveaway à réclamer. Cette option est uniquement disponible pour le gagnant pendant sa période de 24 heures.'
      );
    }
  }

  // --------------------------------------------------------------------------
  // One open ticket of same/general type
  // --------------------------------------------------------------------------

  const existing =
    db.prepare(`
      SELECT *
      FROM tickets
      WHERE guild_id = ?
        AND user_id = ?
        AND type = ?
        AND closed_at IS NULL
      ORDER BY id DESC
      LIMIT 1
    `).get(
      guild.id,
      interaction.user.id,
      type
    );

  if (
    existing
  ) {
    return textReply(
      interaction,
      `❌ Tu as déjà un ticket ${ticketTypeName(type)} ouvert : <#${existing.channel_id}>`
    );
  }

  const ticketConfig =
    ticketTypeConfig(
      config,
      type
    );

  let categoryId =
    ticketConfig.categoryId;

  if (
    type === 'support' &&
    config.channels.ticketCategorySupport
  ) {
    categoryId =
      config.channels.ticketCategorySupport;
  }

  if (
    type === 'giveawayClaim' &&
    config.channels.ticketCategoryGiveawayClaim
  ) {
    categoryId =
      config.channels.ticketCategoryGiveawayClaim;
  }

  let parent = null;

  if (
    categoryId
  ) {
    const candidate =
      guild.channels.cache.get(
        categoryId
      );

    if (
      candidate?.type ===
      ChannelType.GuildCategory
    ) {
      parent =
        candidate;
    }
  }

  const overwrites = [
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

  /*
   * Viewer roles.
   */
  for (
    const roleId of
    ticketConfig.viewRoleIds
  ) {
    if (
      guild.roles.cache.has(
        roleId
      )
    ) {
      overwrites.push({
        id: roleId,
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
        `${config.tickets.prefix}-${type === 'giveawayClaim' ? 'claim' : 'support'}-${interaction.user.username}`
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

      permissionOverwrites:
        overwrites
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
    giveaway?.id || null,
    Date.now()
  );

  // --------------------------------------------------------------------------
  // Stop giveaway timer immediately
  // --------------------------------------------------------------------------

  if (
    giveaway
  ) {
    db.prepare(`
      UPDATE giveaways
      SET
        status = 'claimed',
        claim_deadline = NULL,
        claim_ticket_channel_id = ?,
        claimed_at = ?
      WHERE id = ?
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
      .setEmoji('🔒')
      .setStyle(
        ButtonStyle.Danger
      );

  const pingText =
    ticketPingMentions(
      type,
      config
    );

  const ticketDescription =
    type === 'giveawayClaim'
      ? [
          '## Réclamation Giveaway',
          '',
          `${interaction.user}, ton ticket de réclamation est ouvert.`,
          '',
          `**Giveaway :** #${giveaway.id}`,
          `**Récompense :** ${giveaway.prize}`,
          '',
          'Le délai de 24 heures est maintenant **arrêté**.',
          '',
          'Le Staff peut maintenant vérifier et traiter ta réclamation.',
          '',
          pingText
        ].join('\n')
      : [
          '## Support',
          '',
          `${interaction.user}, ton ticket est maintenant ouvert.`,
          '',
          'Explique clairement ta demande afin que le Staff puisse t’aider.',
          '',
          pingText
        ].join('\n');

  await channel.send(
    v2Message(
      container({
        title:
          type === 'giveawayClaim'
            ? 'Réclamation Giveaway'
            : 'Ticket Support',

        description:
          ticketDescription,

        accent:
          type === 'giveawayClaim'
            ? config.appearance.warningColor
            : config.appearance.accentColor,

        rows: [
          new ActionRowBuilder()
            .addComponents(
              close
            )
        ],

        footer:
          `${config.serverName} • ${ticketTypeName(type)}`
      })
    )
  );

  /*
   * If this was a giveaway claim, update the original winner announcement.
   */
  if (
    giveaway?.announcement_message_id
  ) {
    try {
      const giveawayChannel =
        await getTextChannel(
          guild,
          giveaway.channel_id
        );

      if (
        giveawayChannel
      ) {
        const announcement =
          await giveawayChannel.messages.fetch(
            giveaway.announcement_message_id
          );

        await announcement.edit({
          content:
            `✅ **RÉCLAMATION OUVERTE** — <@${interaction.user.id}> a ouvert son ticket pour le giveaway **#${giveaway.id}**. Le compte à rebours de 24 heures est maintenant **arrêté**.\n\n` +
            `🎁 **Récompense :** ${giveaway.prize}\n` +
            `🎫 **Ticket :** <#${channel.id}>`
        });
      }
    } catch {}
  }

  return textReply(
    interaction,
    `✅ Ton ticket a été créé : <#${channel.id}>`
  );
}

// ============================================================================
// CLOSE TICKET
// ============================================================================

async function closeTicket(
  interaction
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

  if (
    !ticket
  ) {
    return textReply(
      interaction,
      '❌ Ce salon n’est pas un ticket actif.'
    );
  }

  const config =
    getConfig(
      interaction.guild.id
    );

  const isOwner =
    ticket.user_id ===
    interaction.user.id;

  const isViewer =
    ticketTypeConfig(
      config,
      ticket.type
    ).viewRoleIds
      .some(
        roleId =>
          interaction.member.roles.cache.has(
            roleId
          )
      );

  const canManage =
    interaction.member.permissions.has(
      PermissionFlagsBits.ManageChannels
    );

  if (
    !isOwner &&
    !isViewer &&
    !canManage
  ) {
    return textReply(
      interaction,
      '❌ Tu n’as pas la permission de fermer ce ticket.'
    );
  }

  db.prepare(`
    UPDATE tickets
    SET closed_at = ?
    WHERE channel_id = ?
  `).run(
    Date.now(),
    interaction.channel.id
  );

  await textReply(
    interaction,
    '🔒 Ticket fermé.'
  );

  if (
    config.tickets.deleteAfterClose
  ) {
    setTimeout(
      () =>
        interaction.channel
          .delete(
            'Ticket fermé'
          )
          .catch(() => {}),
      1200
    );
  }
}

// ============================================================================
// GIVEAWAY BUILDERS
// ============================================================================

function getGiveawayParticipants(
  giveaway
) {
  try {
    return JSON.parse(
      giveaway.participants || '[]'
    );
  } catch {
    return [];
  }
}

function getExpiredWinners(
  giveaway
) {
  try {
    return JSON.parse(
      giveaway.expired_winners || '[]'
    );
  } catch {
    return [];
  }
}

function buildGiveawayPanel(
  giveaway,
  config
) {
  const participants =
    getGiveawayParticipants(
      giveaway
    );

  const finished =
    giveaway.status !== 'active';

  const participate =
    new ButtonBuilder()
      .setCustomId(
        `giveaway_join:${giveaway.id}`
      )
      .setLabel(
        'Participer'
      )
      .setEmoji('🎉')
      .setStyle(
        ButtonStyle.Primary
      )
      .setDisabled(
        finished
      );

  const leave =
    new ButtonBuilder()
      .setCustomId(
        `giveaway_leave:${giveaway.id}`
      )
      .setLabel(
        'Quitter'
      )
      .setEmoji('🚪')
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        finished
      );

  let title =
    'Giveaway';

  let statusText =
    `**Temps restant :** <t:${Math.floor(giveaway.end_at / 1000)}:R>`;

  if (
    giveaway.status ===
    'awaiting_claim'
  ) {
    title =
      'Fermer';

    statusText =
      [
        '**État :** 🟡 En attente de réclamation',
        giveaway.current_winner_id
          ? `**Gagnant actuel :** <@${giveaway.current_winner_id}>`
          : '',
        giveaway.claim_deadline
          ? `**Réclamation jusqu’au :** <t:${Math.floor(giveaway.claim_deadline / 1000)}:F>`
          : ''
      ]
        .filter(Boolean)
        .join('\n');
  }

  if (
    giveaway.status ===
    'claimed'
  ) {
    title =
      'Fermer';

    statusText =
      [
        '**État :** 🟢 Réclamation ouverte',
        '**Délai de 24 h :** arrêté'
      ].join('\n');
  }

  if (
    giveaway.status ===
    'ended'
  ) {
    title =
      'Fermer';

    statusText =
      '**État :** 🔴 Fermé';
  }

  if (
    giveaway.status ===
    'no_winner'
  ) {
    title =
      'Fermer';

    statusText =
      '**État :** 🔴 Aucun participant éligible restant';
  }

  const winnerHistory =
    getExpiredWinners(
      giveaway
    );

  const historyText =
    winnerHistory.length
      ? `**Anciens gagnants reroll :** ${winnerHistory.length}`
      : '';

  return container({
    title,
    description:
      [
        `## ${giveaway.prize}`,
        '',
        `**Gagnant(s) prévu(s) :** ${giveaway.winners}`,
        `**Participants :** ${participants.length}`,
        giveaway.required_role_id
          ? `**Rôle requis :** <@&${giveaway.required_role_id}>`
          : '**Rôle requis :** Aucun',
        '',
        statusText,
        historyText,
        '',
        finished
          ? 'Le giveaway est maintenant fermé.'
          : 'Participe avec le bouton ci-dessous.'
      ]
        .filter(Boolean)
        .join('\n'),

    accent:
      finished
        ? config.appearance.neutralColor
        : config.appearance.warningColor,

    rows: [
      new ActionRowBuilder()
        .addComponents(
          participate,
          leave
        )
    ],

    footer:
      `${config.serverName} • Giveaway #${giveaway.id}`
  });
}

// ============================================================================
// GIVEAWAY MESSAGE UPDATE
// ============================================================================

async function fetchGiveawayMessage(
  giveaway
) {
  try {
    const channel =
      await getTextChannel(
        client.guilds.cache.get(
          giveaway.guild_id
        ),
        giveaway.channel_id
      );

    if (
      !channel
    ) {
      return null;
    }

    return await channel.messages.fetch(
      giveaway.message_id
    );
  } catch {
    return null;
  }
}

async function updateGiveawayMessage(
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

  const config =
    getConfig(
      guild.id
    );

  const message =
    await fetchGiveawayMessage(
      giveaway
    );

  if (
    !message
  ) {
    return;
  }

  try {
    await message.edit(
      v2Message(
        buildGiveawayPanel(
          giveaway,
          config
        )
      )
    );
  } catch (error) {
    console.error(
      'Giveaway edit error:',
      error.message
    );
  }
}

// ============================================================================
// GIVEAWAY ANNOUNCEMENTS
// ============================================================================

async function announceGiveawayWinner(
  giveaway,
  winnerId,
  isReroll = false
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
    await getTextChannel(
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
      giveaway.claim_deadline / 1000
    );

  let content;

  if (
    isReroll
  ) {
    content =
      `🔄 **REROLL DU GIVEAWAY #${giveaway.id}**\n\n` +
      `Le délai du gagnant précédent est arrivé à expiration sans réclamation.\n\n` +
      `🎉 **Nouveau gagnant :** <@${winnerId}>\n` +
      `🎁 **Récompense :** **${giveaway.prize}**\n` +
      `⏱️ **Tu as 24 heures pour réclamer ton lot.**\n` +
      `🎫 Ouvre le ticket **« Giveaways • Réclamation »** dans le panneau des tickets.\n\n` +
      `⚠️ Passé **<t:${deadline}:F>**, le giveaway sera automatiquement **reroll** une nouvelle fois.`;
  } else {
    content =
      `🎉 **GIVEAWAY TERMINÉ — #${giveaway.id}**\n\n` +
      `🏆 **Félicitations <@${winnerId}> ! Tu as gagné le giveaway !**\n\n` +
      `🎁 **Récompense :** **${giveaway.prize}**\n` +
      `⏱️ **Tu as 24 heures pour réclamer ton lot.**\n` +
      `🎫 Ouvre le ticket **« Giveaways • Réclamation »** dans le panneau des tickets.\n\n` +
      `⚠️ Passé **<t:${deadline}:F>**, ton gain sera automatiquement **reroll**.`;
  }

  try {
    const reply =
      await channel.send(
        {
          content
        }
      );

    return reply;
  } catch {
    return null;
  }
}

// ============================================================================
// START GIVEAWAY CLAIM ROUND
// ============================================================================

async function startGiveawayClaimRound(
  giveawayId,
  isReroll = false
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
    !giveaway
  ) {
    return;
  }

  const participants =
    getGiveawayParticipants(
      giveaway
    );

  let expiredWinners =
    getExpiredWinners(
      giveaway
    );

  /*
   * If the previous winner existed and we are rerolling,
   * permanently exclude them from the next draw.
   */
  if (
    isReroll &&
    giveaway.current_winner_id
  ) {
    if (
      !expiredWinners.includes(
        giveaway.current_winner_id
      )
    ) {
      expiredWinners.push(
        giveaway.current_winner_id
      );
    }
  }

  const pool =
    participants.filter(
      userId =>
        !expiredWinners.includes(
          userId
        )
    );

  if (
    !pool.length
  ) {
    db.prepare(`
      UPDATE giveaways
      SET
        status = 'no_winner',
        ended = 1,
        current_winner_id = NULL,
        claim_deadline = NULL,
        expired_winners = ?
      WHERE id = ?
    `).run(
      JSON.stringify(
        expiredWinners
      ),
      giveaway.id
    );

    const updated =
      db.prepare(`
        SELECT *
        FROM giveaways
        WHERE id = ?
      `).get(
        giveaway.id
      );

    await updateGiveawayMessage(
      updated
    );

    const guild =
      client.guilds.cache.get(
        giveaway.guild_id
      );

    if (
      guild
    ) {
      const channel =
        await getTextChannel(
          guild,
          giveaway.channel_id
        );

      if (
        channel
      ) {
        await channel.send({
          content:
            `⚠️ **GIVEAWAY #${giveaway.id}**\n\n` +
            `Il n’y a plus de participant éligible après les rerolls.\n` +
            `La récompense **${giveaway.prize}** n’a donc pas pu être attribuée.`
        });
      }
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
      60 *
      60 *
      1000;

  const nextRound =
    giveaway.claim_round + 1;

  db.prepare(`
    UPDATE giveaways
    SET
      status = 'awaiting_claim',
      ended = 1,
      current_winner_id = ?,
      claim_deadline = ?,
      claim_round = ?,
      expired_winners = ?,
      announcement_message_id = NULL,
      claim_ticket_channel_id = NULL,
      claimed_at = NULL
    WHERE id = ?
  `).run(
    winner,
    deadline,
    nextRound,
    JSON.stringify(
      expiredWinners
    ),
    giveaway.id
  );

  const updated =
    db.prepare(`
      SELECT *
      FROM giveaways
      WHERE id = ?
    `).get(
      giveaway.id
    );

  /*
   * Original giveaway message:
   * same visual structure, title becomes exactly "Fermer".
   */
  await updateGiveawayMessage(
    updated
  );

  /*
   * Plain message reply / announcement.
   */
  const announcement =
    await announceGiveawayWinner(
      updated,
      winner,
      isReroll
    );

  if (
    announcement
  ) {
    db.prepare(`
      UPDATE giveaways
      SET announcement_message_id = ?
      WHERE id = ?
    `).run(
      announcement.id,
      giveaway.id
    );
  }

  console.log(
    `${isReroll ? '🔄' : '🏆'} Giveaway #${giveaway.id} winner: ${winner}`
  );
}

// ============================================================================
// GIVEAWAY PROCESSOR
// ============================================================================

async function processGiveaways() {
  const now =
    Date.now();

  // --------------------------------------------------------------------------
  // Active giveaways
  // --------------------------------------------------------------------------

  const ending =
    db.prepare(`
      SELECT *
      FROM giveaways
      WHERE ended = 0
        AND status = 'active'
        AND end_at <= ?
    `).all(
      now
    );

  for (
    const giveaway of ending
  ) {
    await startGiveawayClaimRound(
      giveaway.id,
      false
    );
  }

  // --------------------------------------------------------------------------
  // Waiting for claim
  // --------------------------------------------------------------------------

  const expiredClaims =
    db.prepare(`
      SELECT *
      FROM giveaways
      WHERE status = 'awaiting_claim'
        AND claim_deadline IS NOT NULL
        AND claim_deadline <= ?
    `).all(
      now
    );

  for (
    const giveaway of expiredClaims
  ) {
    await startGiveawayClaimRound(
      giveaway.id,
      true
    );
  }
}

// ============================================================================
// MEMBER JOIN / ANTI RAID
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

    const joins =
      raidTracker.get(
        key
      );

    const now =
      Date.now();

    joins.push(
      now
    );

    while (
      joins.length &&
      now - joins[0] >
        config.security.antiRaid.windowSeconds * 1000
    ) {
      joins.shift();
    }

    if (
      joins.length >=
      config.security.antiRaid.joinThreshold
    ) {
      if (
        config.security.antiRaid
          .timeoutNewMembers
      ) {
        const result =
          await applyProgressiveTimeout(
            member,
            'Détection anti-raid'
          );

        await logEvent(
          member.guild,
          'Détection anti-raid',
          `${member} a rejoint pendant une activité de raid détectée.\n\n` +
          `**Entrées détectées :** ${joins.length}\n` +
          `**Sanction :** ${
            result
              ? formatDuration(
                  result.seconds
                )
              : 'aucune'
          }`,
          0xED4245
        );
      }
    }
  }
);

// ============================================================================
// MESSAGE LOG EVENT
// ============================================================================

async function logEvent(
  guild,
  title,
  description,
  accent = 0x5865F2
) {
  const config =
    getConfig(
      guild.id
    );

  if (
    !config.channels.logs
  ) {
    return;
  }

  const channel =
    await getTextChannel(
      guild,
      config.channels.logs
    );

  if (
    !channel
  ) {
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
// MESSAGE SECURITY + APPLICATION DM
// ============================================================================

client.on(
  Events.MessageCreate,
  async message => {
    // ------------------------------------------------------------------------
    // DM APPLICATION FLOW
    // ------------------------------------------------------------------------

    if (
      !message.guild
    ) {
      await handleApplicationDM(
        message
      );

      return;
    }

    if (
      message.author.bot
    ) {
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

      if (
        found
      ) {
        try {
          await message.delete();
        } catch {}

        const result =
          await applyProgressiveTimeout(
            member,
            `Mot interdit détecté : ${found}`
          );

        if (
          result
        ) {
          await logEvent(
            guild,
            'Mot interdit détecté',
            `${member} a déclenché la modération automatique.\n\n` +
            `**Niveau :** ${result.strike}\n` +
            `**Timeout :** ${formatDuration(result.seconds)}`,
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
      let mentions =
        message.mentions.users.size +
        message.mentions.roles.size;

      if (
        message.mentions.everyone
      ) {
        mentions =
          Math.max(
            mentions,
            config.security
              .antiMassMention
              .threshold
          );
      }

      if (
        mentions >=
        config.security
          .antiMassMention
          .threshold
      ) {
        try {
          await message.delete();
        } catch {}

        const result =
          await applyProgressiveTimeout(
            member,
            'Mass mention détectée'
          );

        if (
          result
        ) {
          await logEvent(
            guild,
            'Mass mention bloquée',
            `${member} a utilisé trop de mentions.\n\n` +
            `**Timeout :** ${formatDuration(result.seconds)}`,
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
        spamTracker.get(
          key
        );

      const now =
        Date.now();

      timestamps.push(
        now
      );

      while (
        timestamps.length &&
        now - timestamps[0] >
          config.security
            .antiSpam
            .windowSeconds *
            1000
      ) {
        timestamps.shift();
      }

      if (
        timestamps.length >=
        config.security
          .antiSpam
          .messageThreshold
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

        if (
          result
        ) {
          await logEvent(
            guild,
            'Anti-spam déclenché',
            `${member} a été sanctionné automatiquement.\n\n` +
            `**Timeout :** ${formatDuration(result.seconds)}`,
            0xED4245
          );
        }

        return;
      }
    }
  }
);

// ============================================================================
// APPLICATION DM HANDLER
// ============================================================================

async function handleApplicationDM(
  message
) {
  if (
    message.author.bot
  ) {
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

  const questions =
    config.applications.questions;

  if (
    !questions.length
  ) {
    return;
  }

  if (
    message.content.length >
    1000
  ) {
    await message.author.send(
      v2Message(
        container({
          title:
            'Réponse trop longue',
          description:
            'Ta réponse dépasse la limite de **1000 caractères**.\n\n' +
            'Envoie une réponse plus courte.',
          accent:
            0xED4245
        })
      )
    );

    return;
  }

  const answers =
    JSON.parse(
      application.answers || '[]'
    );

  answers.push(
    message.content
  );

  const nextIndex =
    application.question_index + 1;

  if (
    nextIndex >=
    questions.length
  ) {
    db.prepare(`
      UPDATE applications
      SET
        answers = ?,
        question_index = ?,
        status = 'pending'
      WHERE id = ?
    `).run(
      JSON.stringify(
        answers
      ),
      nextIndex,
      application.id
    );

    await message.author.send(
      v2Message(
        container({
          title:
            'Candidature terminée',
          description:
            [
              'Merci pour tes réponses.',
              '',
              'Ta candidature est maintenant envoyée au Staff.',
              '',
              'Tu seras contacté lorsque la décision sera prise.'
            ].join('\n'),
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
    JSON.stringify(
      answers
    ),
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

  await askApplicationQuestion(
    updated
  );
}

// ============================================================================
// AUDIT LOG — MASS DELETE
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
        entry.extra?.count || 0
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

    try {
      const member =
        await guild.members.fetch(
          entry.executorId
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

      if (
        result
      ) {
        await logEvent(
          guild,
          'Suppression massive détectée',
          `${member} a supprimé massivement des messages.\n\n` +
          `**Nombre détecté :** ${count}\n` +
          `**Timeout :** ${formatDuration(result.seconds)}`,
          0xED4245
        );
      }
    } catch {}
  }
);

// ============================================================================
// COMMANDS
// ============================================================================

const commands = [
  // --------------------------------------------------------------------------
  // /config
  // --------------------------------------------------------------------------

  new SlashCommandBuilder()
    .setName('config')
    .setDescription(
      'Ouvrir la configuration interactive de Bretagne RP'
    ),

  // --------------------------------------------------------------------------
  // /suggestion
  // --------------------------------------------------------------------------

  new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription(
      'Envoyer une suggestion'
    ),

  // --------------------------------------------------------------------------
  // /giveaway
  // --------------------------------------------------------------------------

  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription(
      'Gestion des giveaways'
    )
    .addSubcommand(
      sub =>
        sub
          .setName('create')
          .setDescription(
            'Créer un giveaway'
          )
          .addStringOption(
            option =>
              option
                .setName('duration')
                .setDescription(
                  'Ex: 30m, 2h, 1d'
                )
                .setRequired(true)
          )
          .addStringOption(
            option =>
              option
                .setName('prize')
                .setDescription(
                  'Récompense'
                )
                .setRequired(true)
                .setMaxLength(300)
          )
          .addIntegerOption(
            option =>
              option
                .setName('winners')
                .setDescription(
                  'Nombre de gagnants'
                )
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
          )
          .addRoleOption(
            option =>
              option
                .setName('role')
                .setDescription(
                  'Rôle requis pour participer'
                )
          )
    )
    .addSubcommand(
      sub =>
        sub
          .setName('end')
          .setDescription(
            'Terminer immédiatement un giveaway'
          )
          .addIntegerOption(
            option =>
              option
                .setName('id')
                .setDescription(
                  'ID du giveaway'
                )
                .setRequired(true)
          )
    )
    .addSubcommand(
      sub =>
        sub
          .setName('reroll')
          .setDescription(
            'Forcer un reroll'
          )
          .addIntegerOption(
            option =>
              option
                .setName('id')
                .setDescription(
                  'ID du giveaway'
                )
                .setRequired(true)
          )
    ),

  // --------------------------------------------------------------------------
  // /session
  // --------------------------------------------------------------------------

  new SlashCommandBuilder()
    .setName('session')
    .setDescription(
      'Gestion des sessions RP'
    )
    .addSubcommand(
      sub =>
        sub
          .setName('open')
          .setDescription(
            'Ouvrir une session RP'
          )
          .addStringOption(
            option =>
              option
                .setName('server-code')
                .setDescription(
                  'Code du serveur'
                )
                .setRequired(true)
          )
    )
    .addSubcommand(
      sub =>
        sub
          .setName('shutdown')
          .setDescription(
            'Fermer une session RP'
          )
    )
];

// ============================================================================
// /CONFIG HOME
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
          .setLabel(
            'Salons'
          )
          .setEmoji('📁')
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
          .setEmoji('👥')
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
          .setEmoji('🛡️')
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
          .setEmoji('📋')
          .setDescription(
            'Configurer le recrutement'
          )
          .setValue(
            'applications'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Tickets'
          )
          .setEmoji('🎫')
          .setDescription(
            'Visibilité et pings par type'
          )
          .setValue(
            'tickets'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Giveaways'
          )
          .setEmoji('🎉')
          .setDescription(
            'Configurer les giveaways'
          )
          .setValue(
            'giveaways'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Sessions RP'
          )
          .setEmoji('🟢')
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
          .setEmoji('⚙️')
          .setDescription(
            'Activer ou fermer des systèmes'
          )
          .setValue(
            'systems'
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Apparence'
          )
          .setEmoji('🎨')
          .setDescription(
            'Couleurs et identité'
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
      .setEmoji('↻')
      .setStyle(
        ButtonStyle.Secondary
      );

  return container({
    title:
      'Configuration de Bretagne RP',

    description:
      [
        '## Centre de configuration',
        '',
        'Tout est regroupé ici afin d’éviter une dizaine de commandes différentes.',
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
        'Choisis une catégorie dans le menu pour modifier le bot.'
      ].join('\n'),

    accent:
      config.appearance.accentColor,

    rows: [
      new ActionRowBuilder()
        .addComponents(
          menu
        ),
      new ActionRowBuilder()
        .addComponents(
          refresh
        )
    ],

    footer:
      `${config.serverName} • Configuration`
  });
}

// ============================================================================
// CONFIG CATEGORY
// ============================================================================

function configCategoryView(
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
      .setEmoji('←')
      .setStyle(
        ButtonStyle.Secondary
      );

  // --------------------------------------------------------------------------
  // CHANNELS
  // --------------------------------------------------------------------------

  if (
    category === 'channels'
  ) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_channel_target'
        )
        .setPlaceholder(
          'Choisir quel salon modifier...'
        )
        .addOptions(
          [
            ['Bienvenue', 'welcome'],
            ['Règlement', 'rules'],
            ['Candidatures', 'applicationLogs'],
            ['Suggestions', 'suggestions'],
            ['Sessions', 'sessions'],
            ['Logs', 'logs'],
            ['Panneau tickets', 'ticketPanel'],
            ['Catégorie tickets support', 'ticketCategorySupport'],
            ['Catégorie réclamations', 'ticketCategoryGiveawayClaim']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Salons',

      description:
        [
          'Choisis un paramètre puis sélectionne le salon directement.',
          '',
          `**Bienvenue :** ${
            config.channels.welcome
              ? `<#${config.channels.welcome}>`
              : 'Non configuré'
          }`,
          `**Règlement :** ${
            config.channels.rules
              ? `<#${config.channels.rules}>`
              : 'Non configuré'
          }`,
          `**Candidatures :** ${
            config.channels.applicationLogs
              ? `<#${config.channels.applicationLogs}>`
              : 'Non configuré'
          }`,
          `**Suggestions :** ${
            config.channels.suggestions
              ? `<#${config.channels.suggestions}>`
              : 'Non configuré'
          }`,
          `**Sessions :** ${
            config.channels.sessions
              ? `<#${config.channels.sessions}>`
              : 'Même salon que la commande'
          }`
        ].join('\n'),

      accent:
        config.appearance.accentColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        'Clique sur un paramètre puis choisis le salon.'
    });
  }

  // --------------------------------------------------------------------------
  // ROLES
  // --------------------------------------------------------------------------

  if (
    category === 'roles'
  ) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_role_target'
        )
        .setPlaceholder(
          'Choisir quel rôle modifier...'
        )
        .addOptions(
          [
            ['Rôle vérifié', 'verified'],
            ['Rôle Staff', 'staff'],
            ['Rôle Configuration', 'config'],
            ['Rôle Giveaways', 'giveaways'],
            ['Rôle Support', 'ticketSupport']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Rôles',

      description:
        [
          'Choisis le paramètre puis sélectionne le rôle.',
          '',
          `**Vérifié :** ${
            config.roles.verified
              ? `<@&${config.roles.verified}>`
              : 'Non configuré'
          }`,
          `**Staff :** ${
            config.roles.staff
              ? `<@&${config.roles.staff}>`
              : 'Non configuré'
          }`,
          `**Configuration :** ${
            config.roles.config
              ? `<@&${config.roles.config}>`
              : 'Non configuré'
          }`,
          `**Giveaways :** ${
            config.roles.giveaways
              ? `<@&${config.roles.giveaways}>`
              : 'Non configuré'
          }`,
          `**Support :** ${
            config.roles.ticketSupport
              ? `<@&${config.roles.ticketSupport}>`
              : 'Non configuré'
          }`
        ].join('\n'),

      accent:
        config.appearance.accentColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        'Sélection de rôle native Discord.'
    });
  }

  // --------------------------------------------------------------------------
  // SECURITY
  // --------------------------------------------------------------------------

  if (
    category === 'security'
  ) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_security_target'
        )
        .setPlaceholder(
          'Choisir une fonction...'
        )
        .addOptions(
          [
            ['Anti-raid', 'antiRaid'],
            ['Anti-spam', 'antiSpam'],
            ['Mass mention', 'antiMassMention'],
            ['Suppression massive', 'antiMassDelete'],
            ['Mots interdits', 'badWords'],
            ['Ajouter un rôle bypass', 'bypass']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Sécurité',

      description:
        [
          'Configure les systèmes de protection et les rôles pouvant les bypass.',
          '',
          `**Anti-raid :** ${
            config.systems.antiRaid
              ? '🟢'
              : '🔴'
          }`,
          `**Anti-spam :** ${
            config.systems.antiSpam
              ? '🟢'
              : '🔴'
          }`,
          `**Mass mention :** ${
            config.systems.antiMassMention
              ? '🟢'
              : '🔴'
          }`,
          `**Suppression massive :** ${
            config.systems.antiMassDelete
              ? '🟢'
              : '🔴'
          }`,
          `**Mots interdits :** ${
            config.systems.badWords
              ? '🟢'
              : '🔴'
          }`,
          '',
          'Les sanctions augmentent progressivement pendant la journée.'
        ].join('\n'),

      accent:
        config.appearance.dangerColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        `${config.serverName} • Sécurité`
    });
  }

  // --------------------------------------------------------------------------
  // APPLICATIONS
  // --------------------------------------------------------------------------

  if (
    category === 'applications'
  ) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_application_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          [
            ['Ouvrir / fermer les candidatures', 'toggle'],
            ['Voir les questions', 'questions'],
            ['Ajouter une question', 'add'],
            ['Supprimer une question', 'remove'],
            ['Rôle Staff après acceptation', 'staffRole']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Candidatures',

      description:
        [
          `**État :** ${
            config.systems.applications
              ? '🟢 Ouvertes'
              : '🔴 Fermées'
          }`,
          '',
          `**Questions actuelles :** ${config.applications.questions.length}`,
          '',
          'Tu peux fermer temporairement les candidatures sans supprimer le panneau.',
          '',
          'Le panneau se mettra automatiquement à jour.'
        ].join('\n'),

      accent:
        config.systems.applications
          ? config.appearance.accentColor
          : config.appearance.dangerColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        'Recrutement Staff'
    });
  }

  // --------------------------------------------------------------------------
  // TICKETS
  // --------------------------------------------------------------------------

  if (
    category === 'tickets'
  ) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_ticket_target'
        )
        .setPlaceholder(
          'Choisir ce que tu veux configurer...'
        )
        .addOptions(
          [
            ['Support • Voir', 'support_view'],
            ['Support • Ping', 'support_ping'],
            ['Giveaway • Voir', 'claim_view'],
            ['Giveaway • Ping', 'claim_ping'],
            ['Support • Catégorie', 'support_category'],
            ['Giveaway • Catégorie', 'claim_category'],
            ['Suppression après fermeture', 'delete']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Tickets',

      description:
        [
          'Chaque type de ticket peut avoir sa propre visibilité et son propre ping.',
          '',
          '### 🎫 Support',
          `**Voir :** ${formatRoleList(config.tickets.support.viewRoleIds)}`,
          `**Ping :** ${formatRoleList(config.tickets.support.pingRoleIds)}`,
          '',
          '### 🏆 Giveaway • Réclamation',
          `**Voir :** ${formatRoleList(config.tickets.giveawayClaim.viewRoleIds)}`,
          `**Ping :** ${formatRoleList(config.tickets.giveawayClaim.pingRoleIds)}`,
          '',
          `**Suppression automatique :** ${
            config.tickets.deleteAfterClose
              ? '🟢'
              : '🔴'
          }`
        ].join('\n'),

      accent:
        config.appearance.accentColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        'Visibilité et notifications par type'
    });
  }

  // --------------------------------------------------------------------------
  // GIVEAWAYS
  // --------------------------------------------------------------------------

  if (
    category === 'giveaways'
  ) {
    const backButton = back;

    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_giveaway_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          [
            ['Durée de réclamation', 'claim_hours'],
            ['Rôle Giveaway', 'role'],
            ['Voir les options', 'summary']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Giveaways',

      description:
        [
          `**Rôle de gestion :** ${
            config.roles.giveaways
              ? `<@&${config.roles.giveaways}>`
              : 'Non configuré'
          }`,
          '',
          `**Réclamation :** ${config.giveaways.claimHours} heures`,
          '',
          'Lorsqu’un giveaway termine :',
          '→ le message devient **Fermer**',
          '→ le bot annonce le gagnant en message normal',
          '→ le gagnant dispose du délai configuré',
          '→ ouvrir le ticket de réclamation arrête le compteur',
          '→ sinon le bot reroll automatiquement'
        ].join('\n'),

      accent:
        config.appearance.warningColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            backButton
          )
      ],

      footer:
        'Gestion des giveaways'
    });
  }

  // --------------------------------------------------------------------------
  // SESSIONS
  // --------------------------------------------------------------------------

  if (
    category === 'sessions'
  ) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_session_target'
        )
        .setPlaceholder(
          'Choisir un réglage...'
        )
        .addOptions(
          [
            ['Ping @everyone', 'ping'],
            ['Nettoyer à la fermeture', 'clear'],
            ['Voir la configuration', 'summary']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Sessions RP',

      description:
        [
          `**Salon :** ${
            config.channels.sessions
              ? `<#${config.channels.sessions}>`
              : 'Même salon que la commande'
          }`,
          '',
          `**Ping @everyone :** ${
            config.sessions.autoPingEveryone
              ? '🟢'
              : '🔴'
          }`,
          `**Nettoyage shutdown :** ${
            config.sessions.clearOnShutdown
              ? '🟢'
              : '🔴'
          }`,
          '',
          'Le panneau d’ouverture n’a volontairement aucun bouton.'
        ].join('\n'),

      accent:
        config.appearance.successColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        'Sessions RP'
    });
  }

  // --------------------------------------------------------------------------
  // SYSTEMS
  // --------------------------------------------------------------------------

  if (
    category === 'systems'
  ) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          'config_system_target'
        )
        .setPlaceholder(
          'Choisir un système...'
        )
        .addOptions(
          [
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
            ['Suppression massive', 'antiMassDelete'],
            ['Mots interdits', 'badWords']
          ].map(
            ([label, value]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(value)
          )
        );

    return container({
      title:
        'Configuration • Systèmes',

      description:
        [
          'Les systèmes peuvent être ouverts ou fermés individuellement.',
          '',
          `Bienvenue : ${boolState(config.systems.welcome)}`,
          `Règlement : ${boolState(config.systems.rules)}`,
          `Candidatures : ${boolState(config.systems.applications)}`,
          `Giveaways : ${boolState(config.systems.giveaways)}`,
          `Tickets : ${boolState(config.systems.tickets)}`,
          `Suggestions : ${boolState(config.systems.suggestions)}`,
          `Sessions : ${boolState(config.systems.sessions)}`,
          `Sécurité : ${boolState(config.systems.security)}`
        ].join('\n'),

      accent:
        config.appearance.accentColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            menu
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        'Activation / fermeture des systèmes'
    });
  }

  // --------------------------------------------------------------------------
  // APPEARANCE
  // --------------------------------------------------------------------------

  if (
    category === 'appearance'
  ) {
    const button =
      new ButtonBuilder()
        .setCustomId(
          'config_change_color'
        )
        .setLabel(
          'Changer la couleur'
        )
        .setEmoji('🎨')
        .setStyle(
          ButtonStyle.Primary
        );

    return container({
      title:
        'Configuration • Apparence',

      description:
        [
          `**Couleur actuelle :** #${config.appearance.accentColor
            .toString(16)
            .padStart(6, '0')
            .toUpperCase()}`,
          '',
          'Cette couleur est utilisée comme accent principal des panneaux Components V2.'
        ].join('\n'),

      accent:
        config.appearance.accentColor,

      rows: [
        new ActionRowBuilder()
          .addComponents(
            button
          ),
        new ActionRowBuilder()
          .addComponents(
            back
          )
      ],

      footer:
        'Identité visuelle'
    });
  }

  return container({
    title:
      'Configuration',
    description:
      'Catégorie inconnue.',
    accent:
      config.appearance.dangerColor,
    rows: [
      new ActionRowBuilder()
        .addComponents(
          back
        )
    ]
  });
}

function boolState(
  value
) {
  return value
    ? '🟢 Activé'
    : '🔴 Désactivé';
}

function formatRoleList(
  roleIds
) {
  if (
    !roleIds?.length
  ) {
    return 'Aucun rôle configuré';
  }

  return roleIds
    .map(
      roleId =>
        `<@&${roleId}>`
    )
    .join(', ');
}

// ============================================================================
// CONFIG ROLE PICKER
// ============================================================================

function buildRolePicker(
  customId,
  placeholder,
  maxValues = 10
) {
  return new RoleSelectMenuBuilder()
    .setCustomId(
      customId
    )
    .setPlaceholder(
      placeholder
    )
    .setMinValues(
      0
    )
    .setMaxValues(
      maxValues
    );
}

// ============================================================================
// CONFIG CHANNEL PICKER
// ============================================================================

function buildChannelPicker(
  customId,
  placeholder
) {
  return new ChannelSelectMenuBuilder()
    .setCustomId(
      customId
    )
    .setPlaceholder(
      placeholder
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
}

// ============================================================================
// CONFIG INTERACTION ACCESS
// ============================================================================

function configAccessAllowed(
  interaction
) {
  const config =
    getConfig(
      interaction.guild.id
    );

  /*
   * During testing, no role restriction is enforced.
   */
  if (
    config.testMode
  ) {
    return true;
  }

  return roleRestrictionPasses(
    interaction.member,
    config,
    config.roles.config
  );
}

function giveawayAccessAllowed(
  interaction
) {
  const config =
    getConfig(
      interaction.guild.id
    );

  /*
   * During testing, no role restriction is enforced.
   */
  if (
    config.testMode
  ) {
    return true;
  }

  return roleRestrictionPasses(
    interaction.member,
    config,
    config.roles.giveaways
  );
}

// ============================================================================
// READY
// ============================================================================

client.once(
  Events.ClientReady,
  async ready => {
    console.log('');
    console.log(
      '══════════════════════════════════════════════'
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
      '🛡️ Sécurité : actif'
    );
    console.log(
      '🎉 Giveaways : actif'
    );
    console.log(
      '🎫 Tickets multi-types : actif'
    );
    console.log(
      '🇫🇷 Bretagne RP : actif'
    );
    console.log(
      '══════════════════════════════════════════════'
    );
    console.log('');

    try {
      await registerCommands();
    } catch (
      error
    ) {
      console.error(
        '❌ Erreur registration commandes:',
        error
      );
    }

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
      } catch (
        error
      ) {
        console.error(
          `❌ Panel error (${guild.name}):`,
          error.message
        );
      }
    }

    /*
     * Giveaways run every 5 seconds.
     */
    setInterval(
      () =>
        processGiveaways()
          .catch(
            error =>
              console.error(
                'Giveaway loop:',
                error
              )
          ),
      5000
    );
  }
);

// ============================================================================
// COMMAND REGISTRATION
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

    console.log(
      `✅ Commandes enregistrées sur ${GUILD_ID}`
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

  console.log(
    '✅ Commandes globales enregistrées'
  );
}

// ============================================================================
// MAIN INTERACTION HANDLER
// ============================================================================
//
// IMPORTANT:
// This is intentionally ONE handler.
// The previous structure split interaction logic over multiple listeners,
// which made debugging "application did not respond" much harder.
//
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
        // /CONFIG
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'config'
        ) {
          if (
            !configAccessAllowed(
              interaction
            )
          ) {
            return textReply(
              interaction,
              '❌ Tu n’as pas accès à la configuration.'
            );
          }

          /*
           * Immediate response.
           * This is the important part for the old
           * "application did not respond" problem.
           */
          return v2Reply(
            interaction,
            buildConfigHome(
              getConfig(
                interaction.guild.id
              )
            ),
            false
          );
        }

        // --------------------------------------------------------------------
        // /SUGGESTION
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
            return textReply(
              interaction,
              '❌ Le système de suggestions est actuellement désactivé.'
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
        // /GIVEAWAY
        // --------------------------------------------------------------------

        if (
          interaction.commandName ===
          'giveaway'
        ) {
          if (
            !giveawayAccessAllowed(
              interaction
            )
          ) {
            return textReply(
              interaction,
              '❌ Tu n’as pas accès à la gestion des giveaways.'
            );
          }

          const subcommand =
            interaction.options.getSubcommand();

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            !config.systems.giveaways
          ) {
            return textReply(
              interaction,
              '❌ Le système de giveaways est désactivé.'
            );
          }

          // ------------------------------------------------------------------
          // CREATE
          // ------------------------------------------------------------------

          if (
            subcommand ===
            'create'
          ) {
            const durationInput =
              interaction.options.getString(
                'duration'
              );

            const prize =
              interaction.options.getString(
                'prize'
              );

            const winners =
              interaction.options.getInteger(
                'winners'
              );

            const role =
              interaction.options.getRole(
                'role'
              );

            const durationMs =
              parseDuration(
                durationInput
              );

            if (
              !durationMs
            ) {
              return textReply(
                interaction,
                '❌ Durée invalide. Utilise par exemple `30m`, `2h`, `1d`.'
              );
            }

            if (
              durationMs <
              config.giveaways
                .minimumDurationSeconds *
                1000
            ) {
              return textReply(
                interaction,
                `❌ La durée minimum est de ${config.giveaways.minimumDurationSeconds} secondes.`
              );
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
                  participants,
                  ended,
                  status,
                  current_winner_id,
                  claim_deadline,
                  claim_round,
                  expired_winners
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', NULL, NULL, 0, '[]')
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

            let giveaway =
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
                    giveaway,
                    config
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

            giveaway =
              db.prepare(`
                SELECT *
                FROM giveaways
                WHERE id = ?
              `).get(
                giveaway.id
              );

            await textReply(
              interaction,
              `✅ Giveaway #${giveaway.id} créé. Il se terminera <t:${Math.floor(endAt / 1000)}:R>.`
            );

            return;
          }

          // ------------------------------------------------------------------
          // END
          // ------------------------------------------------------------------

          if (
            subcommand ===
            'end'
          ) {
            const id =
              interaction.options.getInteger(
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

            if (
              !giveaway
            ) {
              return textReply(
                interaction,
                '❌ Giveaway introuvable.'
              );
            }

            if (
              giveaway.status !==
              'active'
            ) {
              return textReply(
                interaction,
                '❌ Ce giveaway est déjà fermé.'
              );
            }

            db.prepare(`
              UPDATE giveaways
              SET end_at = ?
              WHERE id = ?
            `).run(
              Date.now(),
              id
            );

            await startGiveawayClaimRound(
              id,
              false
            );

            return textReply(
              interaction,
              `✅ Giveaway #${id} terminé.`
            );
          }

          // ------------------------------------------------------------------
          // FORCE REROLL
          // ------------------------------------------------------------------

          if (
            subcommand ===
            'reroll'
          ) {
            const id =
              interaction.options.getInteger(
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

            if (
              !giveaway
            ) {
              return textReply(
                interaction,
                '❌ Giveaway introuvable.'
              );
            }

            if (
              ![
                'awaiting_claim',
                'claimed',
                'ended'
              ].includes(
                giveaway.status
              )
            ) {
              return textReply(
                interaction,
                '❌ Ce giveaway ne peut pas encore être reroll.'
              );
            }

            await startGiveawayClaimRound(
              id,
              true
            );

            return textReply(
              interaction,
              `✅ Reroll du giveaway #${id} lancé.`
            );
          }
        }

        // --------------------------------------------------------------------
        // /SESSION
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
            return textReply(
              interaction,
              '❌ Le système de sessions est désactivé.'
            );
          }

          const subcommand =
            interaction.options.getSubcommand();

          // --------------------------------------------------------------
          // OPEN
          // --------------------------------------------------------------

          if (
            subcommand ===
            'open'
          ) {
            const serverCode =
              interaction.options.getString(
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

            if (
              existing
            ) {
              return textReply(
                interaction,
                '❌ Une session est déjà ouverte.'
              );
            }

            const channel =
              await getTextChannel(
                interaction.guild,
                config.channels.sessions
              ) ||
              interaction.channel;

            /*
             * Components V2 cannot have content in the same message.
             * Therefore @everyone is sent immediately before the V2 panel.
             */
            if (
              config.sessions.autoPingEveryone
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

            const sessionContainer =
              container({
                title:
                  'Session RP ouverte',
                description:
                  [
                    '## État du serveur',
                    '',
                    '**Statut :** 🟢 Ouvert',
                    '',
                    `**Code serveur :** \`${serverCode}\``,
                    '',
                    'La session RP est officiellement ouverte.',
                    '',
                    'Bienvenue en jeu.'
                  ].join('\n'),
                accent:
                  config.appearance.successColor,
                footer:
                  `${config.serverName} • Session ouverte`
              });

            await channel.send(
              v2Message(
                sessionContainer
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

            return textReply(
              interaction,
              `✅ Session RP ouverte dans ${channel}.`
            );
          }

          // --------------------------------------------------------------
          // SHUTDOWN
          // --------------------------------------------------------------

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

            if (
              !session
            ) {
              return textReply(
                interaction,
                '❌ Aucune session active.'
              );
            }

            const channel =
              await getTextChannel(
                interaction.guild,
                session.channel_id
              );

            if (
              !channel
            ) {
              db.prepare(`
                UPDATE sessions
                SET active = 0
                WHERE guild_id = ?
              `).run(
                interaction.guild.id
              );

              return textReply(
                interaction,
                '⚠️ Le salon de la session n’est plus accessible.'
              );
            }

            if (
              config.sessions.clearOnShutdown
            ) {
              await clearChannel(
                channel
              );
            }

            await channel.send(
              v2Message(
                container({
                  title:
                    'Session RP fermée',
                  description:
                    [
                      '## État du serveur',
                      '',
                      '**Statut :** 🔴 Fermé',
                      '',
                      'La session RP est maintenant terminée.',
                      '',
                      'Aucun ping n’est envoyé lors de la fermeture.'
                    ].join('\n'),
                  accent:
                    config.appearance.dangerColor,
                  footer:
                    `${config.serverName} • Session fermée`
                })
              )
            );

            db.prepare(`
              UPDATE sessions
              SET active = 0
              WHERE guild_id = ?
            `).run(
              interaction.guild.id
            );

            return textReply(
              interaction,
              '✅ Session RP fermée.'
            );
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
            interaction.values[0] !==
            'staff'
          ) {
            return;
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            !config.systems.applications
          ) {
            return textReply(
              interaction,
              '❌ Les candidatures Staff sont actuellement fermées.'
            );
          }

          try {
            await startApplication(
              interaction.user,
              interaction.guild.id
            );

            return textReply(
              interaction,
              '✅ Je viens de t’envoyer un DM pour commencer ta candidature.'
            );
          } catch (
            error
          ) {
            if (
              error.message ===
              'APPLICATIONS_CLOSED'
            ) {
              return textReply(
                interaction,
                '❌ Les candidatures sont actuellement fermées.'
              );
            }

            return textReply(
              interaction,
              '❌ Je ne peux pas t’envoyer de DM. Vérifie que tes messages privés sont ouverts.'
            );
          }
        }

        // --------------------------------------------------------------------
        // TICKET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'ticket_menu'
        ) {
          return createTicket(
            interaction,
            interaction.values[0]
          );
        }

        // --------------------------------------------------------------------
        // CONFIG CATEGORY
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_category'
        ) {
          if (
            !configAccessAllowed(
              interaction
            )
          ) {
            return textReply(
              interaction,
              '❌ Tu n’as plus accès à la configuration.'
            );
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                interaction.values[0]
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG CHANNEL TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_channel_target'
        ) {
          const target =
            interaction.values[0];

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              container({
                title:
                  'Choisir un salon',
                description:
                  [
                    `Paramètre : **${target}**`,
                    '',
                    'Sélectionne maintenant le salon à utiliser.'
                  ].join('\n'),
                accent:
                  0x5865F2,

                rows: [
                  new ActionRowBuilder()
                    .addComponents(
                      buildChannelPicker(
                        `config_channel_value:${target}`,
                        'Choisir un salon...'
                      )
                    )
                ],

                footer:
                  'Le changement est enregistré immédiatement.'
              })
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG CHANNEL VALUE
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'config_channel_value:'
          )
        ) {
          const target =
            interaction.customId
              .split(':')[1];

          const channelId =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.channels[
            target
          ] =
            channelId;

          /*
           * Ticket category aliases map into the nested ticket config too.
           */
          if (
            target ===
            'ticketCategorySupport'
          ) {
            config.tickets.support.categoryId =
              channelId;
          }

          if (
            target ===
            'ticketCategoryGiveawayClaim'
          ) {
            config.tickets.giveawayClaim.categoryId =
              channelId;
          }

          saveConfig(
            interaction.guild.id,
            config
          );

          await interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'channels'
              )
            ]
          });

          await syncAllPanels(
            interaction.guild
          );

          return;
        }

        // --------------------------------------------------------------------
        // CONFIG ROLE TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_role_target'
        ) {
          const target =
            interaction.values[0];

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              container({
                title:
                  'Choisir un rôle',
                description:
                  [
                    `Paramètre : **${target}**`,
                    '',
                    'Sélectionne le rôle à utiliser.'
                  ].join('\n'),

                accent:
                  0x5865F2,

                rows: [
                  new ActionRowBuilder()
                    .addComponents(
                      new RoleSelectMenuBuilder()
                        .setCustomId(
                          `config_role_value:${target}`
                        )
                        .setPlaceholder(
                          'Choisir un rôle...'
                        )
                        .setMinValues(
                          1
                        )
                        .setMaxValues(
                          1
                        )
                    )
                ],

                footer:
                  'Le changement est enregistré immédiatement.'
              })
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG ROLE VALUE
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'config_role_value:'
          )
        ) {
          const target =
            interaction.customId
              .split(':')[1];

          const roleId =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.roles[
            target
          ] =
            roleId;

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'roles'
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG SECURITY TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_security_target'
        ) {
          const target =
            interaction.values[0];

          if (
            target ===
            'bypass'
          ) {
            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                container({
                  title:
                    'Sécurité • Rôle bypass',
                  description:
                    [
                      'Sélectionne les rôles pouvant bypass un système.',
                      '',
                      'Le système concerné est demandé juste après.'
                    ].join('\n'),

                  accent:
                    0xED4245,

                  rows: [
                    new ActionRowBuilder()
                      .addComponents(
                        new StringSelectMenuBuilder()
                          .setCustomId(
                            'config_bypass_system'
                          )
                          .setPlaceholder(
                            'Choisir le système...'
                          )
                          .addOptions(
                            [
                              ['Mots interdits', 'badWords'],
                              ['Anti-spam', 'antiSpam'],
                              ['Anti-raid', 'antiRaid'],
                              ['Mass mention', 'antiMassMention'],
                              ['Suppression massive', 'antiMassDelete']
                            ].map(
                              ([label, value]) =>
                                new StringSelectMenuOptionBuilder()
                                  .setLabel(label)
                                  .setValue(value)
                            )
                          )
                      )
                  ],

                  footer:
                    'Les rôles bypass sont configurables individuellement.'
                })
              ]
            });
          }

          const map = {
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
            map[target];

          const current =
            getNested(
              getConfig(
                interaction.guild.id
              ),
              path
            );

          const config =
            getConfig(
              interaction.guild.id
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

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'security'
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG BYPASS SYSTEM
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_bypass_system'
        ) {
          const system =
            interaction.values[0];

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              container({
                title:
                  `Bypass • ${system}`,

                description:
                  [
                    `Choisis les rôles qui peuvent bypass **${system}**.`,
                    '',
                    'Tu peux sélectionner plusieurs rôles.'
                  ].join('\n'),

                accent:
                  0xED4245,

                rows: [
                  new ActionRowBuilder()
                    .addComponents(
                      buildRolePicker(
                        `config_bypass_roles:${system}`,
                        'Sélectionner les rôles bypass...'
                      )
                    )
                ],

                footer:
                  'Les rôles sélectionnés remplacent l’ancienne liste.'
              })
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG APPLICATION TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_application_target'
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
            config.systems.applications =
              !config.systems.applications;

            saveConfig(
              interaction.guild.id,
              config
            );

            await interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                configCategoryView(
                  config,
                  'applications'
                )
              ]
            });

            await syncAllPanels(
              interaction.guild
            );

            return;
          }

          if (
            target ===
            'questions'
          ) {
            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                container({
                  title:
                    'Questions de candidature',
                  description:
                    config.applications.questions
                      .map(
                        (question, index) =>
                          `**${index + 1}.** ${question}`
                      )
                      .join('\n\n') ||
                    'Aucune question.',

                  accent:
                    config.appearance.accentColor
                })
              ]
            });
          }

          if (
            target ===
            'add'
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
                  'Numéro de question'
                )
                .setStyle(
                  TextInputStyle.Short
                )
                .setRequired(
                  true
                )
                .setPlaceholder(
                  'Exemple : 3'
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
            const role =
              await getRole(
                interaction.guild,
                config.roles.staff
              );

            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                container({
                  title:
                    'Rôle Staff après acceptation',
                  description:
                    [
                      `Rôle actuel : ${
                        role
                          ? `<@&${role.id}>`
                          : 'Aucun'
                      }`,
                      '',
                      'Choisis le rôle qui sera automatiquement attribué lorsqu’une candidature est acceptée.'
                    ].join('\n'),

                  accent:
                    config.appearance.accentColor,

                  rows: [
                    new ActionRowBuilder()
                      .addComponents(
                        new RoleSelectMenuBuilder()
                          .setCustomId(
                            'config_staff_role'
                          )
                          .setPlaceholder(
                            'Choisir le rôle Staff...'
                          )
                          .setMinValues(
                            1
                          )
                          .setMaxValues(
                            1
                          )
                      ]
                  ]
                })
              ]
            });
          }
        }

        // --------------------------------------------------------------------
        // CONFIG TICKET TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_ticket_target'
        ) {
          const target =
            interaction.values[0];

          const names = {
            support_view:
              'Support • Voir',
            support_ping:
              'Support • Ping',
            claim_view:
              'Giveaway • Voir',
            claim_ping:
              'Giveaway • Ping'
          };

          if (
            target ===
            'delete'
          ) {
            const config =
              getConfig(
                interaction.guild.id
              );

            config.tickets.deleteAfterClose =
              !config.tickets.deleteAfterClose;

            saveConfig(
              interaction.guild.id,
              config
            );

            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                configCategoryView(
                  config,
                  'tickets'
                )
              ]
            });
          }

          if (
            target ===
            'support_category' ||
            target ===
            'claim_category'
          ) {
            const realTarget =
              target ===
              'support_category'
                ? 'ticketCategorySupport'
                : 'ticketCategoryGiveawayClaim';

            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                container({
                  title:
                    'Catégorie de tickets',
                  description:
                    [
                      `Paramètre : **${target}**`,
                      '',
                      'Sélectionne la catégorie Discord à utiliser.'
                    ].join('\n'),

                  accent:
                    configCategoryColor(
                      interaction.guild.id
                    ),

                  rows: [
                    new ActionRowBuilder()
                      .addComponents(
                        new ChannelSelectMenuBuilder()
                          .setCustomId(
                            `config_ticket_category_value:${realTarget}`
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
                          )
                      ]
                  ]
                })
              ]
            });
          }

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              container({
                title:
                  `Tickets • ${names[target] || target}`,

                description:
                  [
                    target.includes('view')
                      ? 'Choisis les rôles qui pourront voir ce type de ticket.'
                      : 'Choisis les rôles qui recevront le ping lors de la création de ce type de ticket.',
                    '',
                    target.startsWith(
                      'support'
                    )
                      ? '**Type :** Support'
                      : '**Type :** Giveaway • Réclamation'
                  ].join('\n'),

                accent:
                  configCategoryColor(
                    interaction.guild.id
                  ),

                rows: [
                  new ActionRowBuilder()
                    .addComponents(
                      buildRolePicker(
                        `config_ticket_roles:${target}`,
                        target.includes('view')
                          ? 'Rôles autorisés à voir...'
                          : 'Rôles qui seront ping...'
                      )
                    )
                ]
              })
            ]
          });
        }

        // --------------------------------------------------------------------
        // CONFIG GIVEAWAY TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_giveaway_target'
        ) {
          const target =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            target ===
            'summary'
          ) {
            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                configCategoryView(
                  config,
                  'giveaways'
                )
              ]
            });
          }

          if (
            target ===
            'role'
          ) {
            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                container({
                  title:
                    'Rôle Giveaway',
                  description:
                    [
                      `Rôle actuel : ${
                        config.roles.giveaways
                          ? `<@&${config.roles.giveaways}>`
                          : 'Aucun'
                      }`,
                      '',
                      'Sélectionne le rôle pouvant gérer les giveaways lorsque le mode test sera désactivé.'
                    ].join('\n'),

                  accent:
                    config.appearance.warningColor,

                  rows: [
                    new ActionRowBuilder()
                      .addComponents(
                        new RoleSelectMenuBuilder()
                          .setCustomId(
                            'config_giveaway_role'
                          )
                          .setPlaceholder(
                            'Choisir le rôle...'
                          )
                          .setMinValues(
                            1
                          )
                          .setMaxValues(
                            1
                          )
                      ]
                  ]
                })
              ]
            });
          }

          if (
            target ===
            'claim_hours'
          ) {
            const modal =
              new ModalBuilder()
                .setCustomId(
                  'config_claim_hours'
                )
                .setTitle(
                  'Durée de réclamation'
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
        }

        // --------------------------------------------------------------------
        // CONFIG SESSIONS TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_session_target'
        ) {
          const target =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            target ===
            'ping'
          ) {
            config.sessions.autoPingEveryone =
              !config.sessions.autoPingEveryone;

            saveConfig(
              interaction.guild.id,
              config
            );

            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                configCategoryView(
                  config,
                  'sessions'
                )
              ]
            });
          }

          if (
            target ===
            'clear'
          ) {
            config.sessions.clearOnShutdown =
              !config.sessions.clearOnShutdown;

            saveConfig(
              interaction.guild.id,
              config
            );

            return interaction.update({
              flags:
                MessageFlags.IsComponentsV2,

              components: [
                configCategoryView(
                  config,
                  'sessions'
                )
              ]
            });
          }

          return;
        }

        // --------------------------------------------------------------------
        // CONFIG SYSTEM TARGET
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_system_target'
        ) {
          const target =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.systems[
            target
          ] =
            !config.systems[
              target
            ];

          saveConfig(
            interaction.guild.id,
            config
          );

          await interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'systems'
              )
            ]
          });

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
            'config_ticket_category_value:'
          )
        ) {
          const target =
            interaction.customId
              .split(':')[1];

          const value =
            interaction.values[0];

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            target ===
            'ticketCategorySupport'
          ) {
            config.channels
              .ticketCategorySupport =
              value;

            config.tickets.support
              .categoryId =
              value;
          }

          if (
            target ===
            'ticketCategoryGiveawayClaim'
          ) {
            config.channels
              .ticketCategoryGiveawayClaim =
              value;

            config.tickets
              .giveawayClaim
              .categoryId =
              value;
          }

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'tickets'
              )
            ]
          });
        }
      }

      // ======================================================================
      // ROLE SELECTS
      // ======================================================================

      if (
        interaction.isRoleSelectMenu()
      ) {
        // --------------------------------------------------------------------
        // SECURITY BYPASS
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'config_bypass_roles:'
          )
        ) {
          const system =
            interaction.customId
              .split(':')[1];

          const config =
            getConfig(
              interaction.guild.id
            );

          config.bypassRoles[
            system
          ] =
            [...interaction.values];

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'security'
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // TICKET ROLES
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'config_ticket_roles:'
          )
        ) {
          const target =
            interaction.customId
              .split(':')[1];

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            target ===
            'support_view'
          ) {
            config.tickets
              .support
              .viewRoleIds =
              [...interaction.values];
          }

          if (
            target ===
            'support_ping'
          ) {
            config.tickets
              .support
              .pingRoleIds =
              [...interaction.values];
          }

          if (
            target ===
            'claim_view'
          ) {
            config.tickets
              .giveawayClaim
              .viewRoleIds =
              [...interaction.values];
          }

          if (
            target ===
            'claim_ping'
          ) {
            config.tickets
              .giveawayClaim
              .pingRoleIds =
              [...interaction.values];
          }

          saveConfig(
            interaction.guild.id,
            config
          );

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'tickets'
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // STAFF ROLE
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_staff_role'
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

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'applications'
              )
            ]
          });
        }

        // --------------------------------------------------------------------
        // GIVEAWAY ROLE
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_giveaway_role'
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

          return interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              configCategoryView(
                config,
                'giveaways'
              )
            ]
          });
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
          'config_refresh'
        ) {
          if (
            !configAccessAllowed(
              interaction
            )
          ) {
            return textReply(
              interaction,
              '❌ Tu n’as plus accès à la configuration.'
            );
          }

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

        if (
          interaction.customId ===
          'config_change_color'
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                'config_color_modal'
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
            return textReply(
              interaction,
              '❌ Aucun rôle de validation n’est configuré.'
            );
          }

          const role =
            await getRole(
              interaction.guild,
              config.roles.verified
            );

          if (
            !role
          ) {
            return textReply(
              interaction,
              '❌ Le rôle configuré est introuvable.'
            );
          }

          try {
            await interaction.member.roles.add(
              role,
              'Acceptation du règlement'
            );

            return textReply(
              interaction,
              `✅ Règlement accepté. Tu as reçu ${role}.`
            );
          } catch {
            return textReply(
              interaction,
              '❌ Je ne peux pas attribuer ce rôle. Vérifie la position du rôle du bot.'
            );
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

          if (
            !application
          ) {
            return textReply(
              interaction,
              '❌ Cette candidature n’est plus disponible.'
            );
          }

          await interaction.update({
            flags:
              MessageFlags.IsComponentsV2,

            components: [
              container({
                title:
                  'Candidature démarrée',
                description:
                  [
                    'Parfait.',
                    '',
                    'Nous commençons maintenant.',
                    '',
                    'Réponds à chaque question directement dans ce DM.'
                  ].join('\n'),
                accent:
                  0x57F287
              })
            ]
          });

          await askApplicationQuestion(
            application
          );

          return;
        }

        // --------------------------------------------------------------------
        // APPLICATION ACCEPT / REFUSE
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
              interaction.customId
                .split(':')[1]
            );

          const modal =
            new ModalBuilder()
              .setCustomId(
                `application_decision:${accepted ? 'accept' : 'refuse'}:${applicationId}`
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
          const giveawayId =
            Number(
              interaction.customId
                .split(':')[1]
            );

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
            giveaway.status !==
              'active'
          ) {
            return textReply(
              interaction,
              '❌ Ce giveaway est fermé.'
            );
          }

          if (
            giveaway.end_at <=
            Date.now()
          ) {
            await startGiveawayClaimRound(
              giveaway.id,
              false
            );

            return textReply(
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
            return textReply(
              interaction,
              `❌ Tu dois avoir <@&${giveaway.required_role_id}> pour participer.`
            );
          }

          const participants =
            getGiveawayParticipants(
              giveaway
            );

          if (
            participants.includes(
              interaction.user.id
            )
          ) {
            return textReply(
              interaction,
              '⚠️ Tu participes déjà à ce giveaway. Utilise **Quitter** si tu veux te retirer.'
            );
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
            giveaway.id
          );

          const updated =
            db.prepare(`
              SELECT *
              FROM giveaways
              WHERE id = ?
            `).get(
              giveaway.id
            );

          await updateGiveawayMessage(
            updated
          );

          return textReply(
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
          const giveawayId =
            Number(
              interaction.customId
                .split(':')[1]
            );

          const confirm =
            new ButtonBuilder()
              .setCustomId(
                `giveaway_confirm_leave:${giveawayId}`
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
                [
                  'Tu participes actuellement à ce giveaway.',
                  '',
                  'Veux-tu vraiment retirer ta participation ?'
                ].join('\n'),
              accent:
                0xED4245,
              rows: [
                new ActionRowBuilder()
                  .addComponents(
                    confirm
                  )
              ],
              footer:
                'Cette confirmation est visible uniquement par toi.'
            }),
            true
          );
        }

        // --------------------------------------------------------------------
        // GIVEAWAY CONFIRM LEAVE
        // --------------------------------------------------------------------

        if (
          interaction.customId.startsWith(
            'giveaway_confirm_leave:'
          )
        ) {
          const giveawayId =
            Number(
              interaction.customId
                .split(':')[1]
            );

          const giveaway =
            db.prepare(`
              SELECT *
              FROM giveaways
              WHERE id = ?
            `).get(
              giveawayId
            );

          if (
            !giveaway
          ) {
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
            getGiveawayParticipants(
              giveaway
            ).filter(
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
            giveawayId
          );

          const updated =
            db.prepare(`
              SELECT *
              FROM giveaways
              WHERE id = ?
            `).get(
              giveawayId
            );

          await updateGiveawayMessage(
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
          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            !config.systems.suggestions
          ) {
            return textReply(
              interaction,
              '❌ Les suggestions sont actuellement désactivées.'
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
              'reason'
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
            !application
          ) {
            return textReply(
              interaction,
              '❌ Candidature introuvable.'
            );
          }

          if (
            application.status !==
            'pending'
          ) {
            return textReply(
              interaction,
              '❌ Cette candidature a déjà été traitée.'
            );
          }

          const accepted =
            action ===
            'accept';

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
                      ? [
                          `Félicitations ! Ta candidature Staff sur **${config.serverName}** a été acceptée.`,
                          '',
                          `**Raison :** ${reason}`
                        ].join('\n')
                      : [
                          `Ta candidature Staff sur **${config.serverName}** a été refusée.`,
                          '',
                          `**Raison :** ${reason}`
                        ].join('\n'),

                  accent:
                    accepted
                      ? 0x57F287
                      : 0xED4245
                })
              )
            );
          } catch {}

          return textReply(
            interaction,
            accepted
              ? '✅ Candidature acceptée et candidat averti.'
              : '✅ Candidature refusée et candidat averti.'
          );
        }

        // --------------------------------------------------------------------
        // SUGGESTION
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'suggestion_modal'
        ) {
          const config =
            getConfig(
              interaction.guild.id
            );

          const text =
            interaction.fields.getTextInputValue(
              'suggestion_text'
            );

          const channel =
            await getTextChannel(
              interaction.guild,
              config.channels.suggestions
            );

          if (
            !channel
          ) {
            return textReply(
              interaction,
              '❌ Le salon des suggestions est introuvable.'
            );
          }

          const result =
            db.prepare(`
              INSERT INTO suggestions (
                guild_id,
                channel_id,
                message_id,
                user_id,
                text,
                upvotes,
                downvotes,
                status,
                created_at
              )
              VALUES (?, ?, ?, ?, ?, '[]', '[]', 'pending', ?)
            `).run(
              interaction.guild.id,
              channel.id,
              'pending',
              interaction.user.id,
              text,
              Date.now()
            );

          let suggestion =
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
              .setLabel(
                'Pour 0'
              )
              .setEmoji('👍')
              .setStyle(
                ButtonStyle.Success
              );

          const down =
            new ButtonBuilder()
              .setCustomId(
                `suggestion_down:${suggestion.id}`
              )
              .setLabel(
                'Contre 0'
              )
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
                    [
                      `**Auteur :** <@${suggestion.user_id}>`,
                      '',
                      text,
                      '',
                      '**Statut :** 🕐 En attente'
                    ].join('\n'),

                  accent:
                    config.appearance.warningColor,

                  rows: [
                    new ActionRowBuilder()
                      .addComponents(
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

          return textReply(
            interaction,
            `✅ Suggestion envoyée dans ${channel}.`
          );
        }

        // --------------------------------------------------------------------
        // CONFIG ADD QUESTION
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_add_question'
        ) {
          if (
            !configAccessAllowed(
              interaction
            )
          ) {
            return textReply(
              interaction,
              '❌ Accès configuration refusé.'
            );
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          const question =
            interaction.fields
              .getTextInputValue(
                'question'
              )
              .trim();

          config.applications
            .questions
            .push(
              question
            );

          saveConfig(
            interaction.guild.id,
            config
          );

          return textReply(
            interaction,
            `✅ Question #${config.applications.questions.length} ajoutée.`
          );
        }

        // --------------------------------------------------------------------
        // CONFIG REMOVE QUESTION
        // --------------------------------------------------------------------

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

          const config =
            getConfig(
              interaction.guild.id
            );

          if (
            !Number.isInteger(
              index
            ) ||
            !config.applications
              .questions[index]
          ) {
            return textReply(
              interaction,
              '❌ Numéro de question invalide.'
            );
          }

          const removed =
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

          return textReply(
            interaction,
            `✅ Question supprimée : ${removed[0]}`
          );
        }

        // --------------------------------------------------------------------
        // CONFIG COLOR
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_color_modal'
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
            return textReply(
              interaction,
              '❌ Couleur invalide. Exemple : `#5865F2`.'
            );
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          config.appearance
            .accentColor =
            parseInt(
              hex,
              16
            );

          saveConfig(
            interaction.guild.id,
            config
          );

          await textReply(
            interaction,
            `✅ Couleur principale définie sur #${hex.toUpperCase()}.`
          );

          await syncAllPanels(
            interaction.guild
          );

          return;
        }

        // --------------------------------------------------------------------
        // CONFIG CLAIM HOURS
        // --------------------------------------------------------------------

        if (
          interaction.customId ===
          'config_claim_hours'
        ) {
          const hours =
            Number(
              interaction.fields
                .getTextInputValue(
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
            return textReply(
              interaction,
              '❌ Entre une durée comprise entre 1 et 168 heures.'
            );
          }

          const config =
            getConfig(
              interaction.guild.id
            );

          config.giveaways.claimHours =
            hours;

          saveConfig(
            interaction.guild.id,
            config
          );

          return textReply(
            interaction,
            `✅ Délai de réclamation défini sur ${hours} heure(s).`
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

      /*
       * This is deliberately robust so the interaction doesn't silently
       * expire when an unexpected coding error happens.
       */
      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          if (
            interaction.isMessageComponent()
          ) {
            await interaction.followUp({
              content:
                '❌ Une erreur est survenue. Vérifie la console du bot.',
              flags:
                MessageFlags.Ephemeral
            });
          }
        } else {
          await interaction.reply({
            content:
              '❌ Une erreur est survenue. Vérifie la console du bot.',
            flags:
              MessageFlags.Ephemeral
          });
        }
      } catch {}
    }
  }
);

// ============================================================================
// UTILITY CONFIG COLOR
// ============================================================================

function configCategoryColor(
  guildId
) {
  return getConfig(
    guildId
  ).appearance.accentColor;
}

// ============================================================================
// CLEAR CHANNEL
// ============================================================================

async function clearChannel(
  channel
) {
  let safety =
    0;

  while (
    safety < 200
  ) {
    safety++;

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
          const message of recent.values()
        ) {
          try {
            await message.delete();
          } catch {}
        }
      }
    }

    if (
      old.size
    ) {
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
// PARSE DURATION
// ============================================================================

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

    switch (
      match[2]
    ) {
      case 's':
        total +=
          amount *
          1000;
        break;

      case 'm':
        total +=
          amount *
          60 *
          1000;
        break;

      case 'h':
        total +=
          amount *
          60 *
          60 *
          1000;
        break;

      case 'd':
        total +=
          amount *
          24 *
          60 *
          60 *
          1000;
        break;

      case 'w':
        total +=
          amount *
          7 *
          24 *
          60 *
          60 *
          1000;
        break;
    }
  }

  return found
    ? total
    : null;
}

// ============================================================================
// GIVEAWAY ANNOUNCEMENT / CLAIM REPAIR
// ============================================================================

/*
 * If the bot restarts while a giveaway is awaiting claim,
 * processGiveaways() will continue from the database.
 *
 * That means:
 * - the 24h timer survives restart
 * - current winner survives restart
 * - expired winners survive restart
 * - the ticket claim state survives restart
 */

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
        '❌ Impossible de connecter le bot:',
        error
      );

      process.exit(1);
    }
  );
