/**
 * NEXORA MD - Helpers
 * Mirrors Bella's myfunc + 2 additions
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function smsg(conn, m, store) {
  return m;
}

function formatTime(ms) {
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
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

module.exports = {
  sleep,
  smsg,
  formatTime,
  formatBytes,
  // Bella-compatible stubs
  imageToWebp: async () => {},
  videoToWebp: async () => {},
  writeExifImg: async () => {},
  writeExifVid: async () => {}
};