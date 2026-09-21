/**
 * NEXORA MD - Call Me Back
 * User sends a callback request to the bot owner
 * Usage: .callmeback <optional reason>
 */

const settings = require('../../settings');
const fs = require('fs');
const owner = require('../../lib/owner');

const reqPath = './data/callback_requests.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readRequests() {
  try {
    if (fs.existsSync(reqPath)) return JSON.parse(fs.readFileSync(reqPath, 'utf8'));
  } catch (e) {}
  return [];
}

function writeRequests(data) {
  try {
    // Keep last 100 requests
    fs.writeFileSync(reqPath, JSON.stringify(data.slice(-100), null, 2));
  } catch (e) {}
}

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

module.exports = {
  name: 'callmeback',
  aliases: ['callback', 'cmb'],
  category: 'general',
  description: 'Request the bot owner to call you back',
  usage: '.callmeback <optional reason>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const reason = args.join(' ').trim() || 'No reason given';

      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = cleanNum(sender);
      const senderName = mek.pushName || 'Unknown';

      // Log the request
      const requests = readRequests();
      requests.push({
        number: senderNum,
        name: senderName,
        reason,
        time: new Date().toLocaleString()
      });
      writeRequests(requests);

      // Notify owner
      const ownerNum = (owner.getPairedNumber && owner.getPairedNumber()) || settings.ownerNumber;
      if (ownerNum) {
        const ownerJid = ownerNum.includes('@') ? ownerNum : ownerNum + '@s.whatsapp.net';

        try {
          await conn.sendMessage(ownerJid, {
            text:
              `CALLBACK REQUEST\n\n` +
              `From: ${senderName}\n` +
              `Number: ${senderNum}\n` +
              `Reason: ${reason}\n` +
              `Time: ${new Date().toLocaleString()}\n\n` +
              `Reply with: ${settings.prefix || '.'}callback ${senderNum} <your message>\n\n` +
              `${settings.footer}`,
            mentions: [sender]
          });
        } catch (e) {
          console.log('[CALLMEBACK] Owner notify failed:', e.message);
        }
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `CALLBACK REQUEST SENT\n\n` +
          `Your request has been sent to the owner.\n` +
          `They will call you back when available.\n\n` +
          `Reason: ${reason}\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[CALLMEBACK] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};