/**
 * NEXORA MD - Restart + Update Command
 * Pulls latest code from GitHub, then restarts
 * No emojis in output. No version shown. Update info only.
 */

const settings = require('../../settings');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/queenbellabots-cloud/NEXORA-MD-';

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

module.exports = {
  name: 'restart',
  aliases: ['reboot', 'update', 'pull'],
  category: 'owner',
  description: 'Pull updates from GitHub and restart the bot',
  usage: '.restart',
  ownerOnly: true,
  react: '🔄',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const botDir = process.cwd();

      // ─────────────────────────────────────────
      // Step 1 - Restarting message
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '🔄', key: mek.key } });

      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `RESTARTING NEXORA MD...\n\n` +
          `Checking for updates...\n` +
          `Applying latest features...\n` +
          `Restarting services...\n\n` +
          `Status: Initializing...\n\n` +
          `${settings.footer}`
      });

      await new Promise(r => setTimeout(r, 1200));

      // ─────────────────────────────────────────
      // Step 2 - Gather git info
      // ─────────────────────────────────────────
      const gitCheck = await run('git rev-parse --is-inside-work-tree', botDir);
      const isGitRepo = gitCheck.ok && gitCheck.stdout.includes('true');

      let currentCommit = 'unknown';

      if (isGitRepo) {
        const commitRes = await run('git rev-parse --short HEAD', botDir);
        if (commitRes.ok && commitRes.stdout) {
          currentCommit = commitRes.stdout.split('\n')[0];
        }
      }

      const updateTime = formatDate(new Date());

      // ─────────────────────────────────────────
      // Step 3 - Updating message
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `UPDATING NEXORA MD...\n\n` +
          `Current Update: ${currentCommit}\n` +
          `Update Time: ${updateTime}\n` +
          `Source: ${REPO_URL}\n\n` +
          `Step 1/3: Downloading latest version...\n` +
          `Step 2/3: Applying updates...\n` +
          `Step 3/3: Restarting services...\n\n` +
          `Status: Updating...\n\n` +
          `${settings.footer}`
      });

      // ─────────────────────────────────────────
      // Step 4 - Actual git pull
      // ─────────────────────────────────────────
      let pullOutput = '';
      let newCommit = currentCommit;

      if (isGitRepo) {
        const status = await run('git status --porcelain', botDir);
        if (status.ok && status.stdout.length > 0) {
          await run('git stash push -u -m "nexora-auto-stash"', botDir);
        }

        await run('git fetch --all', botDir);

        const pull = await run('git pull origin HEAD', botDir);
        if (pull.ok) {
          pullOutput = 'Pull successful';
          const newCommitRes = await run('git rev-parse --short HEAD', botDir);
          if (newCommitRes.ok && newCommitRes.stdout) {
            newCommit = newCommitRes.stdout.split('\n')[0];
          }

          try {
            const pkgMtime = fs.statSync(path.join(botDir, 'package.json')).mtimeMs;
            if ((Date.now() - pkgMtime) < 60000) {
              pullOutput += ' + dependencies reinstalled';
              await run('npm install --omit=dev', botDir);
            }
          } catch (e) {}
        } else {
          pullOutput = 'Pull failed: ' + (pull.stderr || 'unknown');
        }
      } else {
        pullOutput = 'Git not available on this host';
      }

      await new Promise(r => setTimeout(r, 1200));

      // ─────────────────────────────────────────
      // Step 5 - Completion message
      // ─────────────────────────────────────────
      const changed = newCommit !== currentCommit;

      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `RESTART COMPLETED\n\n` +
          `Current Update: ${newCommit}\n` +
          `Previous Update: ${currentCommit}\n` +
          `Update Time: ${formatDate(new Date())}\n\n` +
          (changed
            ? `New update pulled from source.`
            : `No new updates. Bot restarted on current code.`) +
          `\n\n${pullOutput}\n\n` +
          `${settings.footer}`
      });

      // ─────────────────────────────────────────
      // Step 6 - Restart
      // ─────────────────────────────────────────
      setTimeout(() => process.exit(0), 2500);

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