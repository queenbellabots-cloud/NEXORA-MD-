/**
 * NEXORA MD - Settings
 * Edit the sections below to customize your bot
 */

const settings = {

  // ═══════════════════════════════════════════════
  // BOT IDENTITY
  // ═══════════════════════════════════════════════
  botName: "𝐍𝐄𝐗𝐎𝐑𝐀 𝐌𝐃",
  botOwner: "Rodgers",
  prefix: ".",

  // ═══════════════════════════════════════════════
  // OWNER NUMBER (Auto-detected from paired number)
  // Leave empty to auto-detect
  // ═══════════════════════════════════════════════
  ownerNumber: "254755660053",

  // ═══════════════════════════════════════════════
  // BOT MODE (Default) - "public" or "private"
  // ═══════════════════════════════════════════════
  mode: "public",

  // ═══════════════════════════════════════════════
  // DEVELOPER
  // ═══════════════════════════════════════════════
  developerNumber: "254755660053",
  developerName: "RODGERS",

  // ═══════════════════════════════════════════════
  // SUDO USERS (Extra admins)
  // ═══════════════════════════════════════════════
  sudoUsers: [
    "254755660053"
  ],

  // ═══════════════════════════════════════════════
  // CHANNEL
  // ═══════════════════════════════════════════════
  channelId: "120363411498601038@newsletter",
  channelLink: "https://whatsapp.com/channel/0029VbCwZHACXC3PNHgtMT31",
  channelName: "QUEEN BELLA MD",

  // ═══════════════════════════════════════════════
  // CHANNEL REACTIONS
  // ═══════════════════════════════════════════════
  channelReactions: ['🥰', '😘', '🤯', '🙄'],
  channelReactionsCount: 50,

  // ═══════════════════════════════════════════════
  // IMAGES
  // ═══════════════════════════════════════════════
  menuImages: [
    "https://yourimageshare.com/ib/Nkl9B3D6q9.png",
    "https://yourimageshare.com/ib/nky6GDc1JX.png",
    "https://yourimageshare.com/ib/CGBwjF3kXQ.png"
  ],

  welcomeImages: [
    "https://yourimageshare.com/ib/Nkl9B3D6q9.png",
    "https://yourimageshare.com/ib/nky6GDc1JX.png",
    "https://yourimageshare.com/ib/CGBwjF3kXQ.png"
  ],

  // ═══════════════════════════════════════════════
  // OWNER INFO (shown in .owner command)
  // ═══════════════════════════════════════════════
  ownerInfo: {
    name: "Rodgers Onyango",
    role: "Developer and Owner",
    location: "Kisumu, Kenya",
    currentLoc: "Nakuru, Kenya",
    girlfriend: "Currently Single",
    status: "Taken by the code",
    contact: "+254755660053",
    report: "+254716388654",
    support: "+254755660053",
    github: "Add your GitHub",
    channel: "https://whatsapp.com/channel/0029VbCwZHACXC3PNHgtMT31",
    email: "Add your email"
  },

  // ═══════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════
  footer: "> © Powered by Rodgers",

  // ═══════════════════════════════════════════════
  // REACTION EMOJIS (only place emojis are used)
  // ═══════════════════════════════════════════════
  reactionSuccess: "✅",
  reactionError: "❌",

  // ═══════════════════════════════════════════════
  // RATE LIMIT
  // ═══════════════════════════════════════════════
  rateLimitPerMinute: 10,

  // ═══════════════════════════════════════════════
  // FEATURE TOGGLES
  // ═══════════════════════════════════════════════
  antiDelete: true,
  antiCall: true,
  ghostMode: true,
  autoTyping: true,
  autoRead: true,
  alwaysOnline: true,
  autoStatusSeen: true,
  autoStatusReact: true,
  autoChatBot: false,

  // ═══════════════════════════════════════════════
  // PAIRING / CONNECTION
  // ═══════════════════════════════════════════════
  usePairingCode: true,
  timeZone: "Africa/Nairobi",

  // ═══════════════════════════════════════════════
  // WARN SYSTEM
  // ═══════════════════════════════════════════════
  WARN_COUNT: 3,

  // ═══════════════════════════════════════════════
  // STORE
  // ═══════════════════════════════════════════════
  storeWriteInterval: 10000,

  // ═══════════════════════════════════════════════
  // ADVANCED - DO NOT CHANGE BELOW
  // ═══════════════════════════════════════════════
  sessionFolder: "./data/session"
};

global.prefix = settings.prefix;
global.botName = settings.botName;
global.botFooter = settings.footer;

module.exports = settings;
