/**
 * NEXORA MD - Uptime & Stats
 * Shows bot uptime, RAM, CPU, platform, and system info
 * Accompanied by theme 8 image
 */

const settings = require('../../settings');
const axios = require('axios');
const os = require('os');

const START_TIME = Date.now();
const THEME_NUMBER = 8; // Image from menuThemes[8]

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function getCpuLoad() {
  try {
    const load = os.loadavg();
    const cores = os.cpus().length || 1;
    const pct = (load[0] / cores) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  } catch (e) {
    return 0;
  }
}

function getMemoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const pct = Math.round((used / total) * 100);
  return { total, free, used, pct };
}

function getProcessMemory() {
  try {
    const proc = process.memoryUsage();
    return { rss: proc.rss, heapTotal: proc.heapTotal, heapUsed: proc.heapUsed };
  } catch (e) {
    return { rss: 0, heapTotal: 0, heapUsed: 0 };
  }
}

function buildBar(pct, length = 15) {
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

function formatDate(date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// ─────────────────────────────────────────────
// IMAGE FETCH
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'uptime',
  aliases: ['stats', 'sysinfo', 'status'],
  category: 'general',
  description: 'Show bot uptime and system stats',
  usage: '.uptime',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const uptimeMs = Date.now() - START_TIME;
      const uptimeStr = formatUptime(uptimeMs);

      const mem = getMemoryStats();
      const proc = getProcessMemory();
      const cpuPct = getCpuLoad();

      const procMb = Math.round(proc.rss / 1024 / 1024);
      const heapMb = Math.round(proc.heapUsed / 1024 / 1024);

      const platform = os.platform();
      const arch = os.arch();
      const cpuModel = os.cpus()[0]?.model || 'unknown';
      const cpuCores = os.cpus().length;
      const hostname = os.hostname();
      const nodeVer = process.version;

      const totalCommands = (global.commands && global.commands.size) || 0;
      const currentMode = global.botMode ? String(global.botMode).toUpperCase() : 'PUBLIC';

      const memBar = buildBar(mem.pct);
      const cpuBar = buildBar(cpuPct);

      // ─────────────────────────────────────────
      // BUILD OUTPUT
      // ─────────────────────────────────────────
      let text = '';
      text += `+---------------------------------------+\n`;
      text += `|         NEXORA MD STATS              |\n`;
      text += `+---------------------------------------+\n\n`;

      text += `[ BOT ]\n`;
      text += `  Name       : ${settings.botName || 'NEXORA MD'}\n`;
      text += `  Owner      : ${settings.botOwner || 'unknown'}\n`;
      text += `  Mode       : ${currentMode}\n`;
      text += `  Commands   : ${totalCommands}\n`;
      text += `  Prefix     : ${settings.prefix || '.'}\n`;
      text += `  Time Zone  : ${settings.timeZone || 'UTC'}\n\n`;

      text += `[ UPTIME ]\n`;
      text += `  Runtime    : ${uptimeStr}\n`;
      text += `  Started    : ${formatDate(new Date(START_TIME))}\n`;
      text += `  Now        : ${formatDate(new Date())}\n\n`;

      text += `[ PROCESS ]\n`;
      text += `  RSS        : ${procMb} MB\n`;
      text += `  Heap Used  : ${heapMb} MB\n`;
      text += `  Node       : ${nodeVer}\n`;
      text += `  PID        : ${process.pid}\n\n`;

      text += `[ SYSTEM ]\n`;
      text += `  Platform   : ${platform} (${arch})\n`;
      text += `  Hostname   : ${hostname}\n`;
      text += `  CPU Cores  : ${cpuCores}\n`;
      text += `  CPU Model  : ${cpuModel.slice(0, 40)}\n\n`;

      text += `[ MEMORY ]\n`;
      text += `  Used       : ${formatBytes(mem.used)} / ${formatBytes(mem.total)}\n`;
      text += `  Usage      : ${memBar} ${mem.pct}%\n`;
      text += `  Free       : ${formatBytes(mem.free)}\n\n`;

      text += `[ CPU ]\n`;
      text += `  Load       : ${cpuBar} ${cpuPct}%\n\n`;

      text += `${settings.footer}`;

      // ─────────────────────────────────────────
      // SEND WITH THEME 8 IMAGE
      // ─────────────────────────────────────────
      let imageUrl = null;
      try {
        if (settings.menuThemes && settings.menuThemes[THEME_NUMBER] && settings.menuThemes[THEME_NUMBER].image) {
          imageUrl = settings.menuThemes[THEME_NUMBER].image;
        }
      } catch (e) {}

      if (imageUrl) {
        try {
          const buffer = await fetchImageBuffer(imageUrl);
          await conn.sendMessage(chatId, {
            image: buffer,
            caption: text
          });
          return;
        } catch (imgErr) {
          console.log('[UPTIME] Image failed:', imgErr.message);
        }
      }

      // Fallback: text only
      await conn.sendMessage(chatId, { text });
    } catch (error) {
      console.log('[UPTIME] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};