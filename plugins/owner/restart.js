/**
 * NEXORA MD - Restart Command
 * Checks for updates, then restarts.
 * Auto-restart on Katabump works via process.exit(0).
 */

const settings = require('../../settings');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/queenbellabots-cloud/NEXORA-MD-';

function run(cmd, cwd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, timeout: 20000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: error ? error.message : null
      });
    });
  });
}

function banner() {
  return (
    `+-----------------------+\n` +
    `|    NEXORA MD          |\n` +
    `|    Created by Rodgers |\n` +
    `+-----------------------+`
  );
}

function formatDate(date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

async function checkForUpdates(botDir) {
  // Verify this is a git repo
  const gitCheck = await run('git rev-parse --is-inside-work-tree', botDir);
  if (!gitCheck.ok || !gitCheck.stdout.includes('true')) {
    return { supported: false, newCommits: [], currentCommit: 'unknown' };
  }

  // Current commit
  const currentRes = await run('git rev-parse --short HEAD', botDir);
  const currentCommit = currentRes.ok ? currentRes.stdout.split('\n')[0] : 'unknown';

  // Fetch remote (fast)
  const fetchRes = await run('git fetch --quiet origin HEAD', botDir);
  if (!fetchRes.ok) {
    return { supported: true, newCommits: [], currentCommit, fetchFailed: true };
  }

  // Compare
  const logRes = await run(
    'git log HEAD..origin/HEAD --pretty=format:%h|%s|%an --no-merges',
    botDir
  );

  if (!logRes.ok || !logRes.stdout) {
    return { supported: true, newCommits: [], currentCommit };
  }

  const newCommits = logRes.stdout
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [hash, ...rest] = line.split('|');
      const author = rest.pop();
      const message = rest.join('|');
      return { hash, message, author };
    })
    .slice(0, 5);

  return { supported: true, newCommits, currentCommit };
}

module.exports = {
  name: 'restart',
  aliases: ['reboot'],
  category: 'owner',
  description: 'Check for updates and restart the bot',
  usage: '.restart',
  ownerOnly: true,
  react: '🔄',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '🔄', key: mek.key } });

      const botDir = process.cwd();

      // ─────────────────────────────────────────
      // Step 1 - Restarting message
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `RESTARTING NEXORA MD...\n\n` +
          `Checking for updates...\n` +
          `Preparing restart...\n\n` +
          `Status: Initializing...\n\n` +
          `${settings.footer}`
      });

      await new Promise(r => setTimeout(r, 800));

      // ─────────────────────────────────────────
      // Step 2 - Check for updates
      // ─────────────────────────────────────────
      let updateInfo = { supported: false, newCommits: [], currentCommit: 'unknown' };
      try {
        updateInfo = await checkForUpdates(botDir);
      } catch (e) {
        console.log('[RESTART] Update check failed:', e.message);
      }

      const updateTime = formatDate(new Date());
      const hasUpdates = updateInfo.newCommits.length > 0;

      // ─────────────────────────────────────────
      // Step 3 - Report update status
      // ─────────────────────────────────────────
      let reportText = `${banner()}\n\n`;

      if (!updateInfo.supported) {
        reportText +=
          `UPDATE CHECK\n\n` +
          `Git not available on this host.\n` +
          `Current Commit: ${updateInfo.currentCommit}\n` +
          `Update Time: ${updateTime}\n\n` +
          `Restarting on current code...\n\n` +
          `${settings.footer}`;
      } else if (hasUpdates) {
        reportText +=
          `UPDATES AVAILABLE\n\n` +
          `Current Commit: ${updateInfo.currentCommit}\n` +
          `Update Time: ${updateTime}\n` +
          `New Commits: ${updateInfo.newCommits.length}\n\n` +
          `Recent changes:\n`;

        updateInfo.newCommits.forEach((c, i) => {
          reportText += `  ${i + 1}. ${c.hash} - ${c.message} (${c.author})\n`;
        });

        reportText +=
          `\nSource: ${REPO_URL}\n\n` +
          `Note: On Katabump, pull the repo manually from the panel, then restart.\n` +
          `Or push and redeploy on Render/Railway/Koyeb.\n\n` +
          `${settings.footer}`;
      } else {
        reportText +=
          `NO UPDATES AVAILABLE\n\n` +
          `Current Commit: ${updateInfo.currentCommit}\n` +
          `Update Time: ${updateTime}\n\n` +
          `Bot is on the latest code.\n\n` +
          `${settings.footer}`;
      }

      await conn.sendMessage(chatId, { text: reportText });

      await new Promise(r => setTimeout(r, 800));

      // ─────────────────────────────────────────
      // Step 4 - Final message + exit
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `RESTART COMPLETED\n\n` +
          `Update Time: ${formatDate(new Date())}\n` +
          `Status: Restarting process...\n\n` +
          `${settings.footer}`
      });

      setTimeout(() => process.exit(0), 2000);

    } catch (error) {
      console.log('[RESTART] Error:', error.message);
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