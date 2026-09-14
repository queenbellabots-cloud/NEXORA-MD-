/**
 * NEXORA MD - Restart & Update Command
 * Owner-only. Checks for updates, applies them via ZIP download, then restarts.
 * Uses kill -15 1 for proper Katabump / Pterodactyl restart.
 * No emojis in output. No version line - shows commit info instead.
 */

const settings = require('../../settings');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const REPO_API_URL = 'https://api.github.com/repos/queenbellabots-cloud/NEXORA-MD-/commits/main';
const REPO_ZIP_URL = 'https://github.com/queenbellabots-cloud/NEXORA-MD-/archive/refs/heads/main.zip';

function banner() {
  return (
    `+---------------------------+\n` +
    `|    NEXORA MD              |\n` +
    `|    Created by Rodgers     |\n` +
    `+---------------------------+`
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

function ensureAdmZip() {
  try {
    require.resolve('adm-zip');
    return true;
  } catch (e) {
    return false;
  }
}

const PROTECTED_FILES = ['settings.js', 'config.js', '.env'];
const FILES_TO_COPY = ['index.js', 'main.js', 'package.json'];
const FOLDERS_TO_COPY = ['plugins', 'lib'];

async function installAdmZip(chatId, conn) {
  await conn.sendMessage(chatId, {
    text: `Installing required package...\n\nPlease wait...`
  });

  const installCmd = exec('npm install adm-zip --save', {
    cwd: path.join(__dirname, '..', '..')
  });

  await new Promise(resolve => {
    installCmd.on('close', code => resolve(code === 0));
  });

  return ensureAdmZip();
}

async function fetchCommitInfo() {
  try {
    const res = await axios.get(REPO_API_URL, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    });

    const sha = res.data?.sha?.substring(0, 7) || '';
    const commitDate = res.data?.commit?.committer?.date;
    const message = res.data?.commit?.message || '';
    const files = res.data?.files || [];

    let formattedDate = '';
    if (commitDate) formattedDate = formatDate(new Date(commitDate));

    const newCommands = [];
    files.forEach(f => {
      if (f.status === 'added' && f.filename.endsWith('.js') && f.filename.includes('plugins/')) {
        const base = path.basename(f.filename, '.js');
        newCommands.push(base);
      }
    });

    return {
      sha,
      date: formattedDate,
      message: message.split('\n')[0],
      newCommands
    };
  } catch (e) {
    console.log('[RESTART] Commit fetch failed:', e.message);
    return { sha: '', date: '', message: '', newCommands: [] };
  }
}

async function downloadAndApply(chatId, conn, botRoot) {
  const tempDir = path.join(botRoot, 'temp_restart');
  const extractPath = path.join(tempDir, 'extracted');
  const zipPath = path.join(tempDir, 'repo.zip');

  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const res = await axios({
      method: 'get',
      url: REPO_ZIP_URL,
      responseType: 'arraybuffer',
      timeout: 60000
    });

    fs.writeFileSync(zipPath, res.data);

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const extractedFolders = fs.readdirSync(extractPath).filter(f => {
      try { return fs.statSync(path.join(extractPath, f)).isDirectory(); }
      catch (e) { return false; }
    });

    if (extractedFolders.length === 0) {
      throw new Error('No folder found in extracted ZIP');
    }

    const sourceFolder = path.join(extractPath, extractedFolders[0]);

    for (const file of FILES_TO_COPY) {
      if (PROTECTED_FILES.includes(file)) continue;
      const src = path.join(sourceFolder, file);
      const dest = path.join(botRoot, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('[RESTART] Copied file:', file);
      }
    }

    for (const folder of FOLDERS_TO_COPY) {
      const src = path.join(sourceFolder, folder);
      const dest = path.join(botRoot, folder);
      if (fs.existsSync(src)) {
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
        fs.cpSync(src, dest, { recursive: true });
        console.log('[RESTART] Copied folder:', folder);
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: true };
  } catch (e) {
    console.log('[RESTART] Download/apply failed:', e.message);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    return { success: false, error: e.message };
  }
}

module.exports = {
  name: 'restart',
  aliases: ['reboot', 'reload', 'update'],
  category: 'owner',
  description: 'Check for updates, apply them, and restart the bot',
  usage: '.restart',
  ownerOnly: true,
  react: '🔄',

  async execute(conn, mek, args, chatId, isOwner) {
    const botRoot = path.join(__dirname, '..', '..');

    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

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

      await new Promise(r => setTimeout(r, 800));

      // ─────────────────────────────────────────
      // Step 2 - Ensure adm-zip
      // ─────────────────────────────────────────
      if (!ensureAdmZip()) {
        const ok = await installAdmZip(chatId, conn);
        if (!ok) {
          await conn.sendMessage(chatId, {
            text: `Failed to install adm-zip. Aborting update.\n\n${settings.footer}`
          });
          return;
        }
      }

      // ─────────────────────────────────────────
      // Step 3 - Fetch commit info
      // ─────────────────────────────────────────
      const commitInfo = await fetchCommitInfo();

      let updateInfoText = '';
      if (commitInfo.sha) {
        updateInfoText =
          `Current Commit: ${commitInfo.sha}\n` +
          `Update Time: ${commitInfo.date || 'unknown'}\n`;
        if (commitInfo.message) {
          updateInfoText += `Latest Message: ${commitInfo.message}\n`;
        }
        if (commitInfo.newCommands.length > 0) {
          updateInfoText += `\nNew Commands Found:\n`;
          commitInfo.newCommands.forEach(c => {
            updateInfoText += `  ${settings.prefix || '.'}${c}\n`;
          });
        }
      } else {
        updateInfoText = `Could not fetch commit info.\n`;
      }

      // ─────────────────────────────────────────
      // Step 4 - Updating message
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `UPDATING NEXORA MD...\n\n` +
          `${updateInfoText}\n` +
          `Step 1/3: Downloading latest version...\n` +
          `Step 2/3: Applying updates...\n` +
          `Step 3/3: Restarting services...\n\n` +
          `Status: Updating...\n\n` +
          `${settings.footer}`
      });

      // ─────────────────────────────────────────
      // Step 5 - Download + apply
      // ─────────────────────────────────────────
      const applyRes = await downloadAndApply(chatId, conn, botRoot);

      await new Promise(r => setTimeout(r, 800));

      // ─────────────────────────────────────────
      // Step 6 - Final message
      // ─────────────────────────────────────────
      const finalTime = formatDate(new Date());

      let finalText = `${banner()}\n\n`;
      finalText += `RESTART COMPLETED\n\n`;
      finalText += `Current Commit: ${commitInfo.sha || 'unknown'}\n`;
      finalText += `Update Time: ${finalTime}\n\n`;

      if (applyRes.success) {
        finalText += `Updates applied successfully.\n`;
        if (commitInfo.newCommands.length > 0) {
          finalText += `\nNew Commands:\n`;
          commitInfo.newCommands.forEach(c => {
            finalText += `  ${settings.prefix || '.'}${c}\n`;
          });
        } else {
          finalText += `\nNo new commands detected.\n`;
        }
      } else {
        finalText += `Update failed: ${applyRes.error}\n`;
        finalText += `Bot will restart on current code.\n`;
      }

      finalText += `\nStatus: Restarting process...\n\n`;
      finalText += `${settings.footer}`;

      await conn.sendMessage(chatId, { text: finalText });

      // Wait for message to send fully
      await new Promise(r => setTimeout(r, 2500));

      // ─────────────────────────────────────────
      // Step 7 - Trigger restart via kill -15 1
      // ─────────────────────────────────────────
      console.log('[RESTART] Triggering container restart via kill -15 1...');

      exec('kill -15 1', (error) => {
        if (error) {
          console.log('[RESTART] kill signal failed:', error.message);
          console.log('[RESTART] Falling back to process.exit(0)');
          process.exit(0);
        }
      });

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