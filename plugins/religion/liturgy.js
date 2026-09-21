/**
 * NEXORA MD - Catholic Daily Liturgy
 * Fetches the daily Mass readings (CNBB, Brazil)
 * Usage:
 *   .liturgy
 *   .liturgy <day> <month> <year>
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'liturgy',
  aliases: ['mass', 'catholic'],
  category: 'religion',
  description: 'Get Catholic daily liturgy readings',
  usage: '.liturgy [day month year]',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      let url = 'https://liturgia.cloudhub.ia.br/v1/liturgia';

      if (args.length >= 3) {
        const d = parseInt(args[0]);
        const m = parseInt(args[1]);
        const y = parseInt(args[2]);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          url += `?dia=${d}&mes=${m}&ano=${y}`;
        }
      }

      const res = await axios.get(url, {
        timeout: 20000,
        headers: { 'Accept': 'application/json' }
      });

      const data = res.data;
      if (!data) throw new Error('No liturgy data');

      let text = `CATHOLIC LITURGY\n\n`;
      if (data.data) text += `Date: ${data.data}\n`;
      if (data.liturgia) text += `Celebration: ${data.liturgia}\n`;
      if (data.cor) text += `Color: ${data.cor}\n\n`;

      if (Array.isArray(data.leituras)) {
        for (const reading of data.leituras) {
          if (reading.titulo) text += `${reading.titulo}\n`;
          if (reading.texto) text += `${reading.texto.slice(0, 1200)}\n\n`;
        }
      }

      text += `${settings.footer}`;

      if (text.length > 4000) {
        text = text.slice(0, 3950) + '...\n\n' + settings.footer;
      }

      await conn.sendMessage(chatId, { text });
    } catch (error) {
      console.log('[LITURGY] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to fetch liturgy.\n\n${settings.footer}` });
    }
  }
};