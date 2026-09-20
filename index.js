/**
 * NEXORA MD - WhatsApp Bot
 * Consolidated state loaders + all handlers
 * Owner: paired number (from creds.json)
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('NEXORA MD - WhatsApp Bot is Online');
});

app.listen(PORT, () => {
  console.log(`[NEXORA MD] Web server running on port ${PORT}`);
});

process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

require('./config');
const settings = require('./settings');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const axios = require('axios');

// Auto-create data folders
try {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
  if (!fs.existsSync('./data/session')) fs.mkdirSync('./data/session', { recursive: true });
  if (!fs.existsSync('./data/tmp')) fs.mkdirSync('./data/tmp', { recursive: true });
} catch (e) {
  console.log('[NEXORA] Could not create data folders:', e.message);
}

const { handleMessages, handleGroupParticipantUpdate } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { sleep } = require('./lib/myfunc');
const mode = require('./lib/mode');
const owner = require('./lib/owner');
const logger = require('./lib/logger');
const { enableChannelBranding } = require('./lib/channel');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
  jidNormalizedUser,
  jidDecode
} = require("@whiskeysockets/baileys");

const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const { rmSync } = require('fs');

// ═══════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════
global.botMode = mode.getMode(settings.mode || 'public');
global.autoWipeSeconds = 0;
global.commands = new Map();
global.autoReadPM = false;

// Anti-delete
try {
  if (fs.existsSync('./data/antidelete.json')) {
    const adData = JSON.parse(fs.readFileSync('./data/antidelete.json', 'utf8'));
    global.antiDelete = adData.enabled !== false;
  } else {
    global.antiDelete = settings.antiDelete;
  }
} catch (e) {
  global.antiDelete = settings.antiDelete;
}

// Anti-edit
try {
  if (fs.existsSync('./data/antiedit.json')) {
    const aeData = JSON.parse(fs.readFileSync('./data/antiedit.json', 'utf8'));
    global.antiEdit = aeData.enabled === true;
  } else {
    global.antiEdit = false;
  }
} catch (e) {
  global.antiEdit = false;
}

// Anti-block
try {
  if (fs.existsSync('./data/antiblock.json')) {
    const abData = JSON.parse(fs.readFileSync('./data/antiblock.json', 'utf8'));
    global.antiBlock = abData.enabled === true;
  } else {
    global.antiBlock = false;
  }
} catch (e) {
  global.antiBlock = false;
}

// Always online
try {
  if (fs.existsSync('./data/alwaysonline.json')) {
    const aoData = JSON.parse(fs.readFileSync('./data/alwaysonline.json', 'utf8'));
    global.alwaysOnline = aoData.enabled !== false;
  } else {
    global.alwaysOnline = settings.alwaysOnline;
  }
} catch (e) {
  global.alwaysOnline = settings.alwaysOnline;
}

// Auto-typing
try {
  if (fs.existsSync('./data/autotyping.json')) {
    const atData = JSON.parse(fs.readFileSync('./data/autotyping.json', 'utf8'));
    global.autoTyping = {
      enabled: atData.enabled !== false,
      dm: atData.dm !== false,
      groups: atData.groups !== false,
      status: atData.status !== false
    };
  } else {
    global.autoTyping = {
      enabled: settings.autoTyping,
      dm: true,
      groups: true,
      status: true
    };
  }
} catch (e) {
  global.autoTyping = { enabled: settings.autoTyping, dm: true, groups: true, status: true };
}

// Auto-recording
try {
  if (fs.existsSync('./data/autorecording.json')) {
    const arData = JSON.parse(fs.readFileSync('./data/autorecording.json', 'utf8'));
    global.autoRecording = {
      enabled: arData.enabled === true,
      dm: arData.dm !== false,
      groups: arData.groups !== false,
      status: arData.status !== false
    };
  } else {
    global.autoRecording = { enabled: false, dm: true, groups: true, status: true };
  }
} catch (e) {
  global.autoRecording = { enabled: false, dm: true, groups: true, status: true };
}

// Auto-chatbot
try {
  if (fs.existsSync('./data/autochatbot.json')) {
    const acData = JSON.parse(fs.readFileSync('./data/autochatbot.json', 'utf8'));
    global.autoChatBot = acData.enabled === true;
  } else {
    global.autoChatBot = settings.autoChatBot || false;
  }
} catch (e) {
  global.autoChatBot = settings.autoChatBot || false;
}

// Auto-status flags
try {
  if (fs.existsSync('./data/status.json')) {
    const sd = JSON.parse(fs.readFileSync('./data/status.json', 'utf8'));
    global.autoStatusFlags = {
      seen: sd.view !== false,
      react: sd.react !== false
    };
  } else {
    global.autoStatusFlags = {
      seen: settings.autoStatusSeen,
      react: settings.autoStatusReact
    };
  }
} catch (e) {
  global.autoStatusFlags = {
    seen: settings.autoStatusSeen,
    react: settings.autoStatusReact
  };
}

// Ghost mode
try {
  if (fs.existsSync('./data/ghost.json')) {
    const gData = JSON.parse(fs.readFileSync('./data/ghost.json', 'utf8'));
    global.ghostMode = gData.enabled === true;
  } else {
    global.ghostMode = settings.ghostMode || false;
  }
} catch (e) {
  global.ghostMode = settings.ghostMode || false;
}

global.customStatus = 'composing';
global.antiCall = settings.antiCall;

// ═══════════════════════════════════════════════════════
// IMAGE FETCH HELPER
// ═══════════════════════════════════════════════════════
async function fetchImageBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/*,*/*;q=0.8'
    }
  });

  const type = res.headers['content-type'] || '';
  if (!type.startsWith('image/')) {
    throw new Error(`Not an image: content-type=${type}`);
  }

  return Buffer.from(res.data);
}

// ═══════════════════════════════════════════════════════
// STATUS REACTION EMOJIS
// ═══════════════════════════════════════════════════════
function getDefaultReactionEmojis() {
  if (Array.isArray(settings.statusReactionEmojis) && settings.statusReactionEmojis.length > 0) {
    return settings.statusReactionEmojis.slice();
  }
  return [
    '🔥', '❤️', '😍', '👑', '✨', '🌟', '💯', '🎉', '💪', '👏',
    '🙌', '🤩', '😎', '💥', '⭐', '🌈', '🎊', '🎈', '💖', '💗',
    '👍', '🙏', '✌️', '🤝', '😊', '😃', '😂', '🥳', '🤗', '🤔'
  ];
}

function loadReactionEmojis() {
  try {
    if (fs.existsSync('./data/status.json')) {
      const data = JSON.parse(fs.readFileSync('./data/status.json', 'utf8'));
      if (Array.isArray(data.emojis) && data.emojis.length > 0) {
        return data.emojis;
      }
    }
  } catch (e) {
    console.log('[NEXORA] Emoji load failed:', e.message);
  }
  return getDefaultReactionEmojis();
}

let REACTION_EMOJIS = loadReactionEmojis();

// ═══════════════════════════════════════════════════════
// PLUGIN LOADER
// ═══════════════════════════════════════════════════════
function loadCommands() {
  const rootDir = path.join(process.cwd(), 'plugins');
  if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });

  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  }

  walk(rootDir);

  logger.info(`Loading plugins...`);
  global.commands.clear();

  let loaded = 0;

  for (const filePath of files) {
    try {
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      if (command && command.name && typeof command.execute === 'function') {
        global.commands.set(command.name.toLowerCase(), command);
        if (Array.isArray(command.aliases)) {
          command.aliases.forEach(a => global.commands.set(a.toLowerCase(), command));
        }
        loaded++;
      }
    } catch (error) {
      logger.error(`Failed to load ${path.basename(filePath)}: ${error.message}`);
    }
  }

  logger.success(`Loaded ${loaded} commands.`);
}

const store = require('./lib/lightweight_store');
store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 3 * 60 * 1000);

setInterval(() => {
  if (global.gc) global.gc();
}, 60000);

setInterval(() => {
  const used = process.memoryUsage().rss / 1024 / 1024;
  if (used > 450) {
    logger.warn('RAM too high, restarting...');
    process.exit(1);
  }
}, 60000);

const CHANNEL_ID = settings.channelId;
const CHANNEL_REACTIONS = settings.channelReactions;
const TOTAL_CHANNEL_REACTIONS = settings.channelReactionsCount;

const pairingCode = settings.usePairingCode;

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const question = (text) => {
  if (rl) return new Promise((resolve) => rl.question(text, resolve));
  return Promise.resolve(settings.ownerNumber || '');
};

const isSystemJid = (jid) => {
  if (!jid) return true;
  if (jid === 'status@broadcast') return false;
  return jid.includes('@broadcast') || jid.includes('@newsletter');
};

function loadCallMessages() {
  try {
    const data = fs.readFileSync('./data/call_messages.json', 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

async function startNexora() {
  try {
    loadCommands();

    const sessionFolder = settings.sessionFolder || './data/session';
    if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

    let { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const msgRetryCounterCache = new NodeCache();

    const Nexora = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: !pairingCode,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
      },
      markOnlineOnConnect: false,
      syncFullHistory: false,
      downloadHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async (key) => {
        try {
          const jid = jidNormalizedUser(key.remoteJid);
          const msg = await store.loadMessage(jid, key.id);
          return msg?.message || { conversation: "" };
        } catch (e) {
          return { conversation: "" };
        }
      },
      msgRetryCounterCache,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: false,
      fireInitQueries: false,
      retryRequestDelayMs: 250,
    });

    enableChannelBranding(Nexora, settings);

    Nexora.ev.on('creds.update', saveCreds);
    store.bind(Nexora.ev);

    // ─────────────────────────────────────────
    // AUTO-WIPE + ANTI-BLOCK WRAPPER
    // ─────────────────────────────────────────
    const preWipeSend = Nexora.sendMessage.bind(Nexora);
    Nexora.sendMessage = async function(jid, content, options = {}) {
      try {
        const result = await preWipeSend(jid, content, options);

        if (global.autoWipeSeconds > 0 &&
            result?.key &&
            !content?.delete &&
            !content?.react &&
            !content?.protocolMessage) {
          setTimeout(async () => {
            try {
              await preWipeSend(jid, {
                delete: {
                  remoteJid: jid,
                  fromMe: true,
                  id: result.key.id
                }
              });
            } catch (e) {}
          }, global.autoWipeSeconds * 1000);
        }

        return result;
      } catch (err) {
        // Anti-block detection
        if (global.antiBlock &&
            err.message &&
            (err.message.includes('forbidden') ||
             err.message.includes('unauthorized') ||
             err.message.includes('not-authorized'))) {
          try {
            const num = String(jid).split('@')[0];
            const detectedPath = './data/antiblock_detected.json';
            let detected = {};
            if (fs.existsSync(detectedPath)) {
              detected = JSON.parse(fs.readFileSync(detectedPath, 'utf8'));
            }
            if (!detected[num]) {
              detected[num] = { date: new Date().toLocaleString() };
              fs.writeFileSync(detectedPath, JSON.stringify(detected, null, 2));

              const ownerNum = (owner.getPairedNumber && owner.getPairedNumber()) || settings.ownerNumber;
              if (ownerNum) {
                const ownerJid = ownerNum.includes('@') ? ownerNum : ownerNum + '@s.whatsapp.net';
                await preWipeSend(ownerJid, {
                  text:
                    `ANTI-BLOCK DETECTED\n\n` +
                    `Number: ${num}\n` +
                    `Time: ${new Date().toLocaleString()}\n\n` +
                    `The bot's message to this user failed — likely blocked.\n\n` +
                    `${settings.footer}`
                });
              }
            }
          } catch (e) {}
        }
        throw err;
      }
    };

    // ─────────────────────────────────────────
    // MESSAGES.UPSERT
    // ─────────────────────────────────────────
    Nexora.ev.on('messages.upsert', async chatUpdate => {
      try {
        if (chatUpdate.type !== 'notify') return;
        const mek = chatUpdate.messages[0];
        if (!mek || !mek.message || !mek.key?.id) return;

        const chatId = mek.key.remoteJid;
        if (!chatId || isSystemJid(chatId)) return;
        if (processedMessages.has(mek.key.id)) return;
        processedMessages.add(mek.key.id);

        // Save to store
        try {
          if (!store.messages[chatId]) store.messages[chatId] = {};
          store.messages[chatId][mek.key.id] = {
            key: mek.key,
            message: mek.message,
            pushName: mek.pushName,
            messageTimestamp: mek.messageTimestamp
          };
          const keys = Object.keys(store.messages[chatId]);
          if (keys.length > 200) {
            const toDelete = keys.slice(0, keys.length - 200);
            toDelete.forEach(k => delete store.messages[chatId][k]);
          }
        } catch (e) {}

        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
          ? mek.message.ephemeralMessage.message
          : mek.message;

        if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

        setImmediate(() => {
          handleMessages(Nexora, chatUpdate, true).catch(err => {
            if (!err.message?.includes('rate-overlimit')) {
              logger.error(`Message handler: ${err.message}`);
            }
          });
        });

        if (!global.ghostMode) {
          setImmediate(async () => {
            try {
              if (settings.autoRead && chatId.endsWith('@g.us')) {
                await Nexora.readMessages([mek.key]);
              }
              if (global.autoReadPM && !chatId.endsWith('@g.us')) {
                await Nexora.readMessages([mek.key]);
              }
            } catch (e) {}
          });
        }

        // ─── AUTO-TYPING ───
        try {
          if (global.autoTyping && global.autoTyping.enabled && !mek.key.fromMe) {
            const isGroup = chatId.endsWith('@g.us');
            const isStatus = chatId === 'status@broadcast';

            let send = false;
            if (isStatus && global.autoTyping.status) send = true;
            else if (isGroup && global.autoTyping.groups) send = true;
            else if (!isGroup && !isStatus && global.autoTyping.dm) send = true;

            if (send) {
              await Nexora.sendPresenceUpdate(global.customStatus || 'composing', chatId);
            }
          }
        } catch (error) {}

        // ─── AUTO-RECORDING ───
        try {
          if (global.autoRecording && global.autoRecording.enabled && !mek.key.fromMe) {
            const isGroup = chatId.endsWith('@g.us');
            const isStatus = chatId === 'status@broadcast';

            let send = false;
            if (isStatus && global.autoRecording.status) send = true;
            else if (isGroup && global.autoRecording.groups) send = true;
            else if (!isGroup && !isStatus && global.autoRecording.dm) send = true;

            if (send) {
              await Nexora.sendPresenceUpdate('recording', chatId);
            }
          }
        } catch (error) {}

        // ─── ALWAYS ONLINE ───
        try {
          if (global.alwaysOnline && !chatId.endsWith('@g.us')) {
            await Nexora.sendPresenceUpdate('available', chatId);
          }
        } catch (error) {}

        // ─── AUTO STATUS VIEW + REACT ───
        try {
          if (chatId === 'status@broadcast') {
            if (!mek || !mek.message) return;

            REACTION_EMOJIS = loadReactionEmojis();

            const autoView = global.autoStatusFlags?.seen !== undefined ? global.autoStatusFlags.seen : true;
            const autoReact = global.autoStatusFlags?.react !== undefined ? global.autoStatusFlags.react : true;

            if (autoView) {
              try {
                await Nexora.readMessages([mek.key]);
                console.log('[STATUS] Viewed from:', (mek.key.participant || mek.key.remoteJid).split('@')[0]);
              } catch (e) {
                console.log('[STATUS] View failed:', e.message);
              }
            }

            if (autoReact) {
              try {
                let statusSender =
                  mek.key.participant ||
                  mek.participant ||
                  null;

                if (!statusSender && mek.message) {
                  const msgKeys = Object.keys(mek.message || {});
                  for (const k of msgKeys) {
                    const inner = mek.message[k];
                    if (inner && inner.contextInfo && inner.contextInfo.participant) {
                      statusSender = inner.contextInfo.participant;
                      break;
                    }
                  }
                }

                if (statusSender) {
                  const randomEmoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];

                  const jidList = [statusSender];
                  if (Nexora.user && Nexora.user.id) {
                    const botJid = Nexora.user.id.split(':')[0] + '@s.whatsapp.net';
                    if (!jidList.includes(botJid)) jidList.push(botJid);
                  }

                  await Nexora.sendMessage(
                    'status@broadcast',
                    { react: { text: randomEmoji, key: mek.key } },
                    { statusJidList: jidList }
                  );
                }
              } catch (e) {
                console.log('[STATUS] React failed:', e.message);
              }
            }
          }
        } catch (error) {
          console.log('[STATUS] Block error:', error.message);
        }

        // ─── CHANNEL REACTIONS ───
        try {
          if (chatId !== CHANNEL_ID) return;
          if (mek.key.fromMe) return;

          const messageId = mek.key.id;

          for (let i = 0; i < TOTAL_CHANNEL_REACTIONS; i++) {
            try {
              const randomEmoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
              await Nexora.newsletterReactMessage(CHANNEL_ID, messageId, randomEmoji);
              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e) {}
          }
        } catch (error) {}

      } catch (err) {
        logger.error(`messages.upsert: ${err.message}`);
      }
    });

    // ─────────────────────────────────────────
    // MESSAGES.UPDATE (ANTI-DELETE + ANTI-EDIT)
    // ─────────────────────────────────────────
    Nexora.ev.on('messages.update', async (updates) => {
      try {
        for (const update of updates) {
          if (!update.update) continue;

          const protocol = update.update.protocolMessage;

          // ─── ANTI-DELETE ───
          if (global.antiDelete && protocol && protocol.type === 0) {
            const key = protocol.key;
            console.log('[ANTI-DELETE] Delete detected for:', key.id);

            let originalMsg = await store.loadMessage(key.remoteJid, key.id);

            if (!originalMsg) {
              try {
                const messages = await Nexora.loadMessages(key.remoteJid, 50);
                originalMsg = messages.find(m => m.key?.id === key.id);
              } catch (e) {}
            }

            if (!originalMsg) {
              console.log('[ANTI-DELETE] Original message not found in store');
              continue;
            }

            const sender = key.participant || key.remoteJid;
            const senderName = await Nexora.getName(sender) || sender.split('@')[0];

            const caption = `ANTI DELETE DETECTED

User: ${senderName}
Number: ${sender.split('@')[0]}
Time: ${new Date().toLocaleString()}

RECOVERED MESSAGE:`;

            const ownerJid = (owner.getPairedNumber() || settings.ownerNumber) + '@s.whatsapp.net';

            await Nexora.sendMessage(ownerJid, {
              text: caption,
              mentions: [sender]
            });

            try {
              await Nexora.copyNForward(ownerJid, originalMsg, true);
              console.log('[ANTI-DELETE] Forwarded successfully');
            } catch (forwardError) {
              if (originalMsg.message?.conversation) {
                await Nexora.sendMessage(ownerJid, {
                  text: `Recovered Text:\n${originalMsg.message.conversation}`
                });
              }
            }
          }

          // ─── ANTI-EDIT (DM only) ───
          if (global.antiEdit) {
            const editedMessage = update.update.message?.editedMessage;
            if (!editedMessage) continue;

            const key = update.key;
            if (!key) continue;

            const chatId = key.remoteJid;
            if (!chatId || chatId.endsWith('@g.us')) continue;
            if (chatId === 'status@broadcast' || chatId.includes('@newsletter')) continue;

            console.log('[ANTI-EDIT] Edit detected in', chatId.split('@')[0]);

            let originalMsg = await store.loadMessage(chatId, key.id);

            const sender = key.participant || key.remoteJid;
            const senderName = await Nexora.getName(sender) || sender.split('@')[0];

            let originalText = 'unknown';
            if (originalMsg && originalMsg.message) {
              const m = originalMsg.message;
              originalText = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '[media]';
            }

            let newText = 'unknown';
            const inner = editedMessage.message || editedMessage;
            newText = inner.conversation || inner.extendedTextMessage?.text || inner.imageMessage?.caption || inner.videoMessage?.caption || '[media]';

            const ownerNum = (owner.getPairedNumber && owner.getPairedNumber()) || settings.ownerNumber;
            if (!ownerNum) continue;

            const ownerJid = ownerNum.includes('@') ? ownerNum : ownerNum + '@s.whatsapp.net';

            const caption =
              `ANTI-EDIT DETECTED\n\n` +
              `User: ${senderName}\n` +
              `Number: ${sender.split('@')[0]}\n` +
              `Time: ${new Date().toLocaleString()}\n\n` +
              `ORIGINAL:\n${originalText}\n\n` +
              `EDITED TO:\n${newText}\n\n` +
              `${settings.footer}`;

            try {
              await Nexora.sendMessage(ownerJid, {
                text: caption,
                mentions: [sender]
              });
            } catch (e) {}
          }
        }
      } catch (error) {
        logger.error(`messages.update: ${error.message}`);
      }
    });

    // ─────────────────────────────────────────
    // ANTI-CALL
    // ─────────────────────────────────────────
    Nexora.ev.on('call', async (calls) => {
      try {
        if (!global.antiCall) return;

        for (const call of calls) {
          if (!call.from) continue;

          const callMessages = loadCallMessages();
          const userMsg = callMessages[call.from] || 'Call rejected. Please message instead.';

          try {
            await Nexora.sendMessage(call.from, { text: userMsg });
          } catch (e) {}

          try {
            await Nexora.updateBlockStatus(call.from, 'block');
          } catch (e) {}
        }
      } catch (error) {
        logger.error(`Anti-Call Error: ${error.message}`);
      }
    });

    // ─────────────────────────────────────────
    // UTIL
    // ─────────────────────────────────────────
    Nexora.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return decode.user && decode.server && decode.user + '@' + decode.server || jid;
      }
      return jid;
    };

    Nexora.getName = (jid, withoutContact = false) => {
      let id = Nexora.decodeJid(jid);
      withoutContact = Nexora.withoutContact || withoutContact;
      let v;
      if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = Nexora.groupMetadata(id) || {};
        resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
      });
      else v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } :
        id === Nexora.decodeJid(Nexora.user.id) ? Nexora.user :
        (store.contacts[id] || {});
      return (withoutContact ? '' : v.name) || v.subject || v.verifiedName ||
        PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
    };

    Nexora.public = true;

    // ─────────────────────────────────────────
    // CONNECTION UPDATE
    // ─────────────────────────────────────────
    let pairingDone = false;
    Nexora.ev.on('connection.update', async (s) => {
      const { connection, lastDisconnect, qr } = s;

      if (pairingCode && !Nexora.authState.creds.registered && !pairingDone) {
        if (connection === 'connecting' || connection === 'open') {
          pairingDone = true;
          let phoneNumber = settings.ownerNumber || '';

          if (!phoneNumber) {
            phoneNumber = await question('Enter your WhatsApp number with country code (no + or spaces): ');
          }

          phoneNumber = String(phoneNumber).replace(/[^0-9]/g, '');

          logger.info(`Requesting pairing code...`);

          setTimeout(async () => {
            try {
              let code = await Nexora.requestPairingCode(phoneNumber);
              code = code?.match(/.{1,4}/g)?.join("-") || code;
              console.log(chalk.green(`Pairing code: `) + chalk.white.bold(code));
              console.log(chalk.yellow('Enter this code in WhatsApp > Linked Devices > Link with phone number'));
            } catch (error) {
              logger.error(`Pairing code error: ${error.message}`);
            }
          }, 5000);
        }
      }

      if (qr && !pairingCode) logger.warn('QR code generated.');
      if (connection === 'connecting') logger.info('Connecting...');

      if (connection === "open") {
        console.log(chalk.magenta.bold(`
    =====================================
           NEXORA MD - ONLINE
    =====================================
        `));
        logger.info(`Bot name : ${settings.botName}`);
        logger.info(`Owner    : ${settings.botOwner}`);
        logger.success('Connected.');

        try {
          const paired = owner.getPairedNumber ? owner.getPairedNumber() : '';
          if (paired) {
            logger.success(`Paired number loaded`);
          } else {
            logger.warn('Could not read paired number from creds.json');
          }
        } catch (e) {}

        try {
          if (global.alwaysOnline) {
            await Nexora.sendPresenceUpdate('available');
          }
        } catch (e) {}

        // ─── GHOST MODE (apply privacy on boot) ───
        try {
          if (global.ghostMode) {
            await Nexora.updateReadReceiptsPrivacy('none');
            logger.success('Ghost mode applied (read receipts off)');
          }
        } catch (e) {
          console.log('[GHOST] Apply failed:', e.message);
        }

        // ─── AUTO-BIO TIMER ───
        try {
          const autobio = require('./plugins/owner/autobio');
          if (autobio && typeof autobio.startTimer === 'function') {
            autobio.startTimer(Nexora);
          }
        } catch (e) {
          console.log('[AUTOBIO] Timer start failed:', e.message);
        }

        // ─── WELCOME MESSAGE ───
        setTimeout(async () => {
          try {
            const botNumber = Nexora.user.id.split(':')[0] + '@s.whatsapp.net';
            const currentPrefix = settings.prefix || '.';
            const userName = settings.botOwner || 'USER';
            const userNumber = settings.ownerNumber || Nexora.user.id.split(':')[0];

            const welcomeText = `NEXORA MD
Connected successfully.

Bot: ${settings.botName}
Owner: ${userName}
Developer: ${settings.developerName}
Number: ${userNumber}
Prefix: ${currentPrefix}
Status: Online and Ready

Join our channel for updates.

${settings.footer}`;

            const welcomeImages = Array.isArray(settings.welcomeImages) ? settings.welcomeImages : [];
            const randomImage = welcomeImages.length > 0
              ? welcomeImages[Math.floor(Math.random() * welcomeImages.length)]
              : null;

            let imageSent = false;

            if (randomImage) {
              try {
                const buffer = await fetchImageBuffer(randomImage);
                await Nexora.sendMessage(botNumber, {
                  image: buffer,
                  caption: welcomeText
                });
                imageSent = true;
                logger.success('Welcome message sent with image.');
              } catch (imgErr) {
                logger.warn(`Welcome image failed: ${imgErr.message}`);
              }
            }

            if (!imageSent) {
              await Nexora.sendMessage(botNumber, { text: welcomeText });
              logger.success('Welcome message sent (text only).');
            }
          } catch (error) {
            logger.error(`Welcome message error: ${error.message}`);
          }
        }, 3000);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            rmSync(sessionFolder, { recursive: true, force: true });
            logger.warn('Session cleared. Please re-authenticate.');
          } catch (e) {}
        }

        if (shouldReconnect) {
          await delay(3000);
          startNexora();
        }
      }
    });

    Nexora.ev.on('group-participants.update', async (update) => {
      await handleGroupParticipantUpdate(Nexora, update);
    });

    return Nexora;
  } catch (error) {
    logger.error(`Error starting bot: ${error.message}`);
    await delay(5000);
    startNexora();
  }
}

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', (err) => {
  if (err?.message && err.message.includes('rate-overlimit')) return;
  logger.error(`Unhandled Rejection: ${err?.message}`);
});

startNexora().catch(error => {
  logger.error(`Fatal crash: ${error.message}`);
  process.exit(1);
});