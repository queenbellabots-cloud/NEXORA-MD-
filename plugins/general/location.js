/**
 * NEXORA MD - Location Info
 * Reads WhatsApp location messages and returns coordinates + map link
 * Usage:
 *   .location (reply to a location message) → show coordinates + map
 *   .location (reply to a live location)    → show live location info
 */

const settings = require('../../settings');

function formatTime(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

async function fetchLocationName(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NEXORA-MD-Bot/1.0'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch (e) {
    console.log('[LOCATION] Reverse geocode failed:', e.message);
    return null;
  }
}

module.exports = {
  name: 'location',
  aliases: ['loc', 'whereami', 'getloc'],
  category: 'general',
  description: 'Read location from a shared WhatsApp location message',
  usage: '.location (reply to a location message)',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // Find location in quoted or current message
      // ─────────────────────────────────────────
      const contextInfo =
        mek.message?.extendedTextMessage?.contextInfo ||
        mek.message?.imageMessage?.contextInfo ||
        mek.message?.videoMessage?.contextInfo;

      const quoted = contextInfo?.quotedMessage;

      const location =
        quoted?.locationMessage ||
        quoted?.liveLocationMessage ||
        mek.message?.locationMessage ||
        mek.message?.liveLocationMessage;

      if (!location) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Share or reply to a WhatsApp location with ${settings.prefix || '.'}location\n\n` +
            `Supports:\n` +
            `- Live Location\n` +
            `- Current Location\n` +
            `- Static Location\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      // ─────────────────────────────────────────
      // Extract coordinates
      // ─────────────────────────────────────────
      const lat = location.degreesLatitude;
      const lon = location.degreesLongitude;
      const name = location.name || '';
      const address = location.address || '';
      const isLive = !!quoted?.liveLocationMessage || !!mek.message?.liveLocationMessage;
      const accuracy = location.accuracyInMeters || location.accuracy || 'unknown';
      const speed = location.speedInMps;
      const sequence = location.sequenceNumber;

      if (lat == null || lon == null) {
        await conn.sendMessage(chatId, {
          text: `Could not read coordinates from the location message.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Reverse geocode (get readable address)
      // ─────────────────────────────────────────
      const resolvedName = await fetchLocationName(lat, lon);

      // ─────────────────────────────────────────
      // Build report
      // ─────────────────────────────────────────
      const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;
      const staticMapImage = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=16&size=800x600&maptype=mapnik&markers=${lat},${lon},red-pushpin`;

      let text = `LOCATION INFO\n\n`;
      text += `Type: ${isLive ? 'Live Location' : 'Static Location'}\n`;
      text += `Latitude: ${lat}\n`;
      text += `Longitude: ${lon}\n`;

      if (name) text += `Label: ${name}\n`;
      if (address) text += `Address: ${address}\n`;
      if (resolvedName && !address) text += `Resolved: ${resolvedName}\n`;
      if (accuracy && accuracy !== 'unknown') text += `Accuracy: ${accuracy} m\n`;
      if (speed != null) text += `Speed: ${(speed * 3.6).toFixed(2)} km/h\n`;
      if (sequence != null) text += `Update #: ${sequence}\n`;

      text += `\nGoogle Maps: ${mapLink}\n`;
      text += `\n${settings.footer}`;

      // Try to send with a static map image
      try {
        const imgRes = await fetch(staticMapImage);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          await conn.sendMessage(chatId, {
            image: buffer,
            caption: text
          });
          return;
        }
      } catch (imgErr) {
        console.log('[LOCATION] Static map failed:', imgErr.message);
      }

      // Fallback: text only
      await conn.sendMessage(chatId, { text });

    } catch (error) {
      console.log('[LOCATION] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};