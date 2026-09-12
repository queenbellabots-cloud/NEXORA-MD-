/**
 * NEXORA MD - Restart + Update Command
 * Pulls latest code from GitHub, then restarts.
 * Gracefully falls back if git is not available.
 */

const settings = require('../../settings');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, cwd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, timeout: 60000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error ? error.code : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: error ? error.message : null
      });
    });
  });
}

function shortOutput(str, max = 400) {
  if (!str) return '';
  const clean = String(str).trim();
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

module.exports = {
  name: 'restart',
  aliases: ['reboot', 'update', 'pull'],
  category: 'owner',
  description: 'Pull updates from GitHub and restart the bot',
  usage: '.restart',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      // Acknowledge
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const botDir = process.cwd();
      const lines = [];

      // ─────────────────────────────────────────
      // 1. Check git repo
      // ─────────────────────────────────────────
      const gitCheck = await run('git rev-parse --is-inside-work-tree', botDir);

      if (!gitCheck.ok || !gitCheck.stdout.includes('true')) {
        // Not a git repo or git missing
        await conn.sendMessage(chatId, {
          text:
            `Update not available on this host.\n\n` +
            `Reason: git not found or not a git repository.\n` +
            `This happens on Render / Railway / Koyeb / Heroku because their filesystems are ephemeral.\n\n` +
            `To update:\n` +
            `1. Push changes to GitHub\n` +
            `2. Redeploy on your host\n\n` +
            `Restarting process now...\n\n${settings.footer}`
        });

        setTimeout(() => process.exit(0), 2000);
        return;
      }

      lines.push('Git repository detected.');

      // ─────────────────────────────────────────
      // 2. Fetch latest changes
      // ─────────────────────────────────────────
      lines.push('Fetching from origin...');
      const fetch = await run('git fetch --all', botDir);

      if (!fetch.ok) {
        lines.push('Fetch failed: ' + shortOutput(fetch.stderr || fetch.error));
      } else {
        lines.push('Fetch complete.');
      }

      // ─────────────────────────────────────────
      // 3. Check local changes
      // ─────────────────────────────────────────
      const status = await run('git status --porcelain', botDir);
      if (status.ok && status.stdout.length > 0) {
        lines.push('Local uncommitted changes detected — stashing them.');
        await run('git stash push -u -m "nexora-auto-stash"', botDir);
      }

      // ─────────────────────────────────────────
      // 4. Pull
      // ─────────────────────────────────────────
      lines.push('Pulling latest code...');
      const pull = await run('git pull origin HEAD', botDir);

      if (!pull.ok) {
        lines.push('Pull failed: ' + shortOutput(pull.stderr || pull.error));
      } else {
        if (pull.stdout) {
          lines.push(shortOutput(pull.stdout, 300));
        }
        lines.push('Pull complete.');
      }

      // ─────────────────────────────────────────
      // 5. Check if package.json changed
      // ─────────────────────────────────────────
      let depsChanged = false;
      try {
        const pkgMtime = fs.statSync(path.join(botDir, 'package.json')).mtimeMs;
        const now = Date.now();
        // If package.json was modified in the last minute, assume deps changed
        depsChanged = (now - pkgMtime) < 60000;
      } catch (e) {}

      if (depsChanged) {
        lines.push('package.json changed — running npm install...');
        const npm = await run('npm install --omit=dev', botDir);
        if (!npm.ok) {
          lines.push('npm install failed: ' + shortOutput(npm.stderr || npm.error));
        } else {
          lines.push('Dependencies installed.');
        }
      } else {
        lines.push('Dependencies unchanged — skipping npm install.');
      }

      // ─────────────────────────────────────────
      // 6. Send summary and restart
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        text:
          `Update Summary\n` +
          `====================\n` +
          lines.join('\n') +
          `\n====================\n` +
          `Restarting bot in 3 seconds...\n\n` +
          `${settings.footer}`
      });

      setTimeout(() => process.exit(0), 3000);

    } catch (error) {
      try {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Restart error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};