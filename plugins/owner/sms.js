/**
 * NEXORA MD - SMS Command
 * Sends an SMS via eSMS Africa API
 * Requires ESMS_API_KEY in .env
 */

const settings = require('../../settings');
const axios = require('axios');

const ESMS_API_URL = 'https://api.esmsafrica.io/v1/sms/send';
const ESMS_API_KEY = process.env.ESMS_API_KEY || settings.esmsApiKey || '';
const ESMS_SENDER_ID = process.env.ESMS_SENDER_ID || settings.esmsSenderId || 'NEXORA';

// ─────────────────────────────────────────────
// PHONE NORMALIZER (Kenya format)
// ─────────────────────────────────────────────
function cleanPhone(num) {
  let c = String(num || '').replace(/[^0-9]/g, '');

  // 07XXXXXXXX → 2547XXXXXXXX
  if (c.startsWith('0')) c = '254' + c.slice(1);

  // 7XXXXXXXX (9 digits) → 2547XXXXXXXX
  if (c.length === 9 && !c.startsWith('254')) c = '254' + c;

  // +254... → 254...
  if (c.startsWith('254')) return c;

  return c;
}

module.exports = {
  name: 'sms',
  aliases: ['sendsms', 'text'],
  category: 'owner',
  description: 'Send an SMS to a phone number',
  usage: '.sms <number> <message>',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      // ─────────────────────────────────────────
      // CONFIG CHECK
      // ─────────────────────────────────────────
      if (!ESMS_API_KEY) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `SMS API key not configured.\n\n` +
            `Add ESMS_API_KEY to your .env file.\n` +
            `Example:\n` +
            `  ESMS_API_KEY=your_key_here\n` +
            `  ESMS_SENDER_ID=NEXORA\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // PARSE ARGS
      // ─────────────────────────────────────────
      const rawNumber = args[0];
      const message = args.slice(1).join(' ').trim();

      if (!rawNumber || !message) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Send an SMS\n\n` +
            `Usage: ${settings.prefix || '.'}sms <number> <message>\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}sms 0712345678 Hello from NEXORA\n` +
            `  ${settings.prefix || '.'}sms 254712345678 Test message\n\n` +
            `Number formats accepted:\n` +
            `  0712345678\n` +
            `  254712345678\n` +
            `  +254712345678\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const number = cleanPhone(rawNumber);

      if (number.length < 10 || number.length > 15) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Invalid phone number: ${rawNumber}\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // SEND
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Sending SMS to ${number}...`
      });

      try {
        const res = await axios.post(ESMS_API_URL, {
          to: number,
          from: ESMS_SENDER_ID,
          message: message
        }, {
          headers: {
            'Authorization': `Bearer ${ESMS_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 20000
        });

        console.log('[SMS] API response:', JSON.stringify(res.data).slice(0, 300));

        // Success check — most APIs return a status field or 200 OK
        const ok =
          res.status === 200 ||
          res.status === 201 ||
          (res.data && (
            res.data.status === 'submitted' ||
            res.data.status === 'success' ||
            res.data.status === 'ok' ||
            res.data.success === true
          ));

        if (ok) {
          await conn.sendMessage(chatId, {
            text:
              `SMS sent to ${number}\n\n` +
              `Message length: ${message.length}\n` +
              `Sender ID: ${ESMS_SENDER_ID}\n\n` +
              `${settings.footer}`
          });
        } else {
          await conn.sendMessage(chatId, {
            text:
              `SMS may have failed.\n\n` +
              `Response: ${JSON.stringify(res.data)}\n\n` +
              `${settings.footer}`
          });
        }
      } catch (e) {
        console.log('[SMS] Send failed:', e.message);

        let errText = e.message;
        if (e.response && e.response.data) {
          errText = JSON.stringify(e.response.data);
        }

        await conn.sendMessage(chatId, {
          text:
            `SMS failed.\n\n` +
            `Reason: ${errText}\n\n` +
            `${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[SMS] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};