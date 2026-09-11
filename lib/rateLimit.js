/**
 * NEXORA MD - Per-user command rate limiter
 * 10 commands per minute per user
 */

const hits = new Map();

const WINDOW_MS = 60 * 1000;

function clean(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isAllowed(sender, limit) {
  const key = clean(sender);
  if (!key) return false;

  const now = Date.now();
  const timestamps = hits.get(key) || [];
  const recent = timestamps.filter(t => now - t < WINDOW_MS);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}

function reset(sender) {
  hits.delete(clean(sender));
}

function clearAll() {
  hits.clear();
}

setInterval(clearAll, WINDOW_MS);

module.exports = { isAllowed, reset, clearAll };