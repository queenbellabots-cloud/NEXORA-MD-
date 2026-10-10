/**
 * NEXORA MD - Restart & Update Command
 * - Pulls latest code from GitHub
 * - Hot-reloads plugins (no restart needed for new commands)
 * - Only restarts container if core files changed
 * - Works on Katabump / Pterodactyl / Render / Railway / Koyeb
 */

const settings = require('../../settings');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const REPO_API_URL = 'https://api.github.com/repos/queenbellabots-cloud/NEXORA-MD-/commits/main';
const REPO_ZIP_URL = 'https://github.com/queenbellabots-cloud/NEXORA-MD-/archive/refs/heads/main.zip';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const PROTECTED_FILES = ['settings.js', 'config.js', '.env'];
const CORE_FILES = ['index.js', 'main.js', 'package.json'];
const CORE_FOLDERS = ['lib'];
const PLUGIN_FOLDER = 'plugins';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
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

async function installAdmZip(chatId, conn, botRoot) {
  await conn.sendMessage(chatId, {
    text: `Installing required package...\n\nPlease wait...`
  });

  const installCmd = exec('npm install adm-zip --save', { cwd: botRoot });

  await new Promise(resolve => {
    installCmd.on('close', code => resolve(code === 0));
  });

  return ensureAdmZip();
}

// ─────────────────────────────────────────────
// GITHUB
// ─────────────────────────────────────────────
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

    return { sha, date: formattedDate, message: message.split('\n')[0], newCommands };
  } catch (e) {
    console.log('[RESTART] Commit fetch failed:', e.message);
    return { sha: '', date: '', message: '', newCommands: [] };
  }
}

// ─────────────────────────────────────────────
// DOWNLOAD + APPLY
// ─────────────────────────────────────────────
async function downloadAndApply(botRoot) {
  const tempDir = path.join(botRoot, 'temp_restart');
  const extractPath = path.join(tempDir, 'extracted');
  const zipPath = path.join(tempDir, 'repo.zip');

  const result = {
    success: false,
    error: null,
    coreChanged: false,
    pluginsChanged: false
  };

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

    // Copy core files
    for (const file of CORE_FILES) {
      if (PROTECTED_FILES.includes(file)) continue;
      const src = path.join(sourceFolder, file);
      const dest = path.join(botRoot, file);
      if (fs.existsSync(src)) {
        const oldContent = fs.existsSync(dest) ? fs.readFileSync(dest) : Buffer.from('');
        const newContent = fs.readFileSync(src);
        if (!oldContent.equals(newContent)) {
          fs.copyFileSync(src, dest);
          result.coreChanged = true;
          console.log('[RESTART] Updated core file:', file);
        }
      }
    }

    for (const folder of CORE_FOLDERS) {
      const src = path.join(sourceFolder, folder);
      const dest = path.join(botRoot, folder);
      if (fs.existsSync(src)) {
        // Simple folder change detection — always copy, mark changed
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
        fs.cpSync(src, dest, { recursive: true });
        result.coreChanged = true;
        console.log('[RESTART] Updated core folder:', folder);
      }
    }

    // Copy plugins folder
    const pluginSrc = path.join(sourceFolder, PLUGIN_FOLDER);
    const pluginDest = path.join(botRoot, PLUGIN_FOLDER);
    if (fs.existsSync(pluginSrc)) {
      if (fs.existsSync(pluginDest)) {
        fs.rmSync(pluginDest, { recursive: true, force: true });
      }
      fs.cpSync(pluginSrc, pluginDest, { recursive: true });
      result.pluginsChanged = true;
      console.log('[RESTART] Updated plugins folder');
    }

    fs.rmSync(tempDir, { recursive: true, force: true });

    result.success = true;
    return result;
  } catch (e) {
    console.log('[RESTART] Download/apply failed:', e.message);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    result.error = e.message;
    return result;
  }
}

// ─────────────────────────────────────────────
// HOT RELOAD PLUGINS
// ─────────────────────────────────────────────
function reloadPlugins(botRoot) {
  const pluginsDir = path.join(botRoot, 'plugins');
  if (!fs.existsSync(pluginsDir)) return 0;

  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  }
  walk(pluginsDir);

  // Clear require cache for all plugin files
  for (const filePath of files) {
    try {
      delete require.cache[require.resolve(filePath)];
    } catch (e) {}
  }

  // Reset commands map
  if (global.commands && typeof global.commands.clear === 'function') {
    global.commands.clear();
  } else {
    global.commands = new Map();
  }

  let loaded = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const command = require(filePath);
      if (command && command.name && typeof command.execute === 'function') {
        global.commands.set(command.name.toLowerCase(), command);
        if (Array.isArray(command.aliases)) {
          command.aliases.forEach(a => global.commands.set(a.toLowerCase(), command));
        }
        loaded++;
      }
    } catch (error) {
      failed++;
      console.log(`[RESTART] Failed to load ${path.basename(filePath)}: ${error.message}`);
    }
  }

  console.log(`[RESTART] Hot-reloaded ${loaded} commands (${failed} failed).`);
  return loaded;
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'restart',
  aliases: ['reboot', 'reload', 'update'],
  category: 'owner',
  description: 'Download updates and hot-reload plugins',
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
      // STEP 1 — Restarting message
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
      // STEP 2 — Ensure adm-zip
      // ─────────────────────────────────────────
      if (!ensureAdmZip()) {
        const ok = await installAdmZip(chatId, conn, botRoot);
        if (!ok) {
          await conn.sendMessage(chatId, {
            text: `Failed to install adm-zip. Aborting update.\n\n${settings.footer}`
          });
          return;
        }
      }

      // ─────────────────────────────────────────
      // STEP 3 — Fetch commit info
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
      // STEP 4 — Updating message
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
      // STEP 5 — Download + apply
      // ─────────────────────────────────────────
      const applyRes = await downloadAndApply(botRoot);

      await new Promise(r => setTimeout(r, 800));

      // ─────────────────────────────────────────
      // STEP 6 — Final message
      // ─────────────────────────────────────────
      const finalTime = formatDate(new Date());

      let finalText = `${banner()}\n\n`;
      finalText += `RESTART COMPLETED\n\n`;
      finalText += `Current Commit: ${commitInfo.sha || 'unknown'}\n`;
      finalText += `Update Time: ${finalTime}\n\n`;

      if (!applyRes.success) {
        finalText += `Update failed: ${applyRes.error}\n`;
        finalText += `Bot will restart on current code.\n\n`;
        finalText += `Status: Restarting process...\n\n`;
        finalText += `${settings.footer}`;
        await conn.sendMessage(chatId, { text: finalText });

        await new Promise(r => setTimeout(r, 2500));
        exec('kill -15 1', (error) => {
          if (error) process.exit(0);
        });
        return;
      }

      finalText += `Updates applied successfully.\n`;

      // ─── HOT RELOAD PLUGINS ───
      let loaded = 0;
      if (applyRes.pluginsChanged) {
        loaded = reloadPlugins(botRoot);
        finalText += `\nPlugins reloaded: ${loaded} commands.\n`;
      }

      if (commitInfo.newCommands.length > 0) {
        finalText += `\nNew Commands:\n`;
        commitInfo.newCommands.forEach(c => {
          finalText += `  ${settings.prefix || '.'}${c}\n`;
        });
      } else {
        finalText += `\nNo new commands detected.\n`;
      }

      const totalActive = (global.commands && global.commands.size) || 0;
      finalText += `\nTotal commands active: ${totalActive}\n\n`;

      // ─────────────────────────────────────────
      // STEP 7 — Restart only if core files changed
      // ─────────────────────────────────────────
      if (applyRes.coreChanged) {
        finalText += `Core files updated. Restarting process in 3s...\n\n`;
        finalText += `${settings.footer}`;
        await conn.sendMessage(chatId, { text: finalText });

        await new Promise(r => setTimeout(r, 3000));

        console.log('[RESTART] Core files changed, restarting container...');
        exec('kill -15 1', (error) => {
          if (error) {
            console.log('[RESTART] kill signal failed:', error.message);
            process.exit(0);
          }
        });
        return;
      }

      // ─────────────────────────────────────────
      // Plugins only — no container restart needed
      // ─────────────────────────────────────────
      finalText += `Plugins updated. No restart needed.\n`;
      finalText += `Send ${settings.prefix || '.'}menu to see the new list.\n\n`;
      finalText += `${settings.footer}`;
      await conn.sendMessage(chatId, { text: finalText });
      return;

    } catch (error) {
      console.log('[RESTART] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Restart error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};