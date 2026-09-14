/**
 * NEXORA MD - Settings
 * Just edit these 2 lines:
 *   1. ownerNumber - your WhatsApp number
 *   2. botOwner    - your name
 */

const settings = {

  // ═══════════════════════════════════════════════
  // EDIT THESE 2 LINES ONLY
  // ═══════════════════════════════════════════════
  ownerNumber: "254755660053",       // ← Your number here
  botOwner: "Rodgers",                // ← Your name here


  // ═══════════════════════════════════════════════
  // EVERYTHING BELOW WORKS OUT OF THE BOX
  // ═══════════════════════════════════════════════
  botName: "𝐍𝐄𝐗𝐎𝐑𝐀 𝐌𝐃",
  prefix: ".",
  mode: "public",

  developerNumber: "254755660053",
  developerName: "RODGERS",
  sudoUsers: [
    "254755660053"
  ],

  channelId: "120363411498601038@newsletter",
  channelLink: "https://whatsapp.com/channel/0029VbCwZHACXC3PNHgtMT31",
  channelName: "NEXORA MD",

  channelReactions: ['🥰', '😘', '🤯', '🙄'],
  channelReactionsCount: 50,

  welcomeImages: [
    "https://imagetourl.cloud/8lefs2tlap9u.png",
    "https://imagetourl.cloud/sk3gkrgw3ru6.png",
    "https://imagetourl.cloud/uiwsbgle71il.png"
  ],

  menuThemes: {
    1:  { name: "Classic Box",     image: "https://imagetourl.cloud/8lefs2tlap9u.png" },
    2:  { name: "Double Line",     image: "https://imagetourl.cloud/sk3gkrgw3ru6.png" },
    3:  { name: "Minimal",         image: "https://imagetourl.cloud/uiwsbgle71il.png" },
    4:  { name: "Bracketed",       image: "https://imagetourl.cloud/ex40swwr598h.jpg" },
    5:  { name: "Starred",         image: "https://imagetourl.cloud/bu0m060dmlvk.jpg" },
    6:  { name: "Arrow",           image: "https://imagetourl.cloud/mxz4axnknxo.jpg" },
    7:  { name: "Dotted",          image: "https://imagetourl.cloud/jg073ljbkas5.jpg" },
    8:  { name: "Double Bracket",  image: "https://imagetourl.cloud/kbwvnoapvcq6.png" },
    9:  { name: "Ornate Crown",    image: "https://imagetourl.cloud/pqk9yzx7p1u9.png" },
    10: { name: "Gradient Frame",  image: "https://imagetourl.cloud/fwvm94dv4ysa.png" }
  },

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
    github: "https://github.com/queenbellabots-cloud/NEXORA-MD-",
    channel: "https://whatsapp.com/channel/0029VbCwZHACXC3PNHgtMT31",
    email: "rogersonyango87@gmail.com"
  },

  footer: "> © Powered by Rodgers",
  reactionSuccess: "✅",
  reactionError: "❌",

  statusReactionEmojis: [
    '🔥', '❤️', '😍', '👑', '✨', '🌟', '💯', '🎉', '💪', '👏',
    '🙌', '🤩', '😎', '💥', '⭐', '🌈', '🎊', '🎈', '💖', '💗',
    '👍', '🙏', '✌️', '🤝', '😊', '😃', '😂', '🥳', '🤗', '🤔'
  ],

  rateLimitPerMinute: 10,

  antiDelete: true,
  antiCall: true,
  ghostMode: true,
  autoTyping: true,
  autoRead: true,
  alwaysOnline: true,
  autoStatusSeen: true,
  autoStatusReact: true,
  autoChatBot: false,

  usePairingCode: true,
  timeZone: "Africa/Nairobi",

  WARN_COUNT: 3,
  storeWriteInterval: 10000,
  sessionFolder: "./data/session"
};

global.prefix = settings.prefix;
global.botName = settings.botName;
global.botFooter = settings.footer;

module.exports = settings;