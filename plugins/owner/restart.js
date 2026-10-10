/**
 * NEXORA MD - Restart & Update Command
 * - Pulls latest code from GitHub
 * - Auto-installs dependencies when package.json changes OR when plugins fail to load
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

const PROTECTED_FILES = ['settings.js', 'config.js', '.env'];
const CORE_FILES = ['index.js', 'main.js', 'package.json'];
const CORE_FOLDERS = ['lib'];
const PLUGIN_FOLDER = 'plugins';

// ─────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────
const THEME = {
  header: '╔═════════════════════════╗',
  headerText: '      N E X O R A   M D     ',
  subHeader: '     『 Rodgers Edition 』     ',
  footerLine: '╚════════════════════════╝',
  divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  bullet: '◆',
  subBullet: '▸',
  check: '✅',
  cross: '❌',
  arrow: '➤',
  spark: '✨',
  gear: '⚙️',
  rocket: '🚀',
  fire: '🔥',
  brain: '🧠',
  box: '📦',
  clock: '⏱',
  bolt: '⚡',
  star: '★'
};

function banner() {
  return (
    `${THEME.header}\n` +
    `${THEME.headerText}\n` +
    `${THEME.subHeader}\n` +
    `${THEME.footerLine}`
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
    text:
      `${banner()}\n\n` +
      `${THEME.box} *Installing Package*\n\n` +
      `${THEME.arrow} adm-zip\n` +
      `${THEME.arrow} Status: In progress...\n\n` +
      `${settings.footer}`
  });

  const installCmd = exec('npm install adm-zip --save', { cwd: botRoot });

  await new Promise(resolve => {
    installCmd.on('close', code => resolve(code === 0));
  });

  return ensureAdmZip();
}

// ─────────────────────────────────────────────
// NPM INSTALL
// ─────────────────────────────────────────────
async function runNpmInstall(chatId, conn, botRoot) {
  await conn.sendMessage(chatId, {
    text:
      `${banner()}\n\n` +
      `${THEME.box} *Installing Dependencies*\n\n` +
      `${THEME.arrow} Reading package.json...\n` +
      `${THEME.arrow} Fetching new modules...\n` +
      `${THEME.clock} This may take 1-2 minutes\n\n` +
      `${settings.footer}`
  });

  return new Promise(resolve => {
    const inst = exec(
      'npm install --no-audit --no-fund --loglevel=error',
      { cwd: botRoot, timeout: 300000, maxBuffer: 20 * 1024 * 1024 }
    );

    let output = '';
    inst.stdout?.on('data', d => { output += d.toString(); });
    inst.stderr?.on('data', d => { output += d.toString(); });

    inst.on('close', code => {
      console.log('[RESTART] npm install exit code:', code);
      if (output) console.log('[RESTART] npm output tail:', output.slice(-800));
      resolve(code === 0);
    });
  });
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
    pluginsChanged: false,
    depsChanged: false
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

    // ─── DETECT package.json CHANGE ───
    const pkgSrc = path.join(sourceFolder, 'package.json');
    const pkgDest = path.join(botRoot, 'package.json');
    if (fs.existsSync(pkgSrc)) {
      const oldPkg = fs.existsSync(pkgDest) ? fs.readFileSync(pkgDest) : Buffer.from('');
      const newPkg = fs.readFileSync(pkgSrc);
      if (!oldPkg.equals(newPkg)) {
        result.depsChanged = true;
        console.log('[RESTART] package.json changed — will run npm install');
      }
    }

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
  if (!fs.existsSync(pluginsDir)) return { loaded: 0, failed: 0, missingDeps: [] };

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

  for (const filePath of files) {
    try {
      delete require.cache[require.resolve(filePath)];
    } catch (e) {}
  }

  if (global.commands && typeof global.commands.clear === 'function') {
    global.commands.clear();
  } else {
    global.commands = new Map();
  }

  let loaded = 0;
  let failed = 0;
  const missingDeps = [];

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
      // Detect missing module errors → trigger reinstall
      const m = error.message.match(/Cannot find module '([^']+)'/);
      if (m && m[1]) missingDeps.push(m[1]);
    }
  }

  console.log(`[RESTART] Hot-reloaded ${loaded} commands (${failed} failed).`);
  return { loaded, failed, missingDeps };
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'restart',
  aliases: ['reboot', 'reload', 'update'],
  category: 'owner',
  description: 'Download updates, install deps, hot-reload plugins',
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

      await conn.sendMessage(chatId, { react: { text: '🔄', key: mek.key } });

      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `${THEME.rocket} *RESTART SEQUENCE INITIATED*\n\n` +
          `${THEME.divider}\n` +
          `${THEME.bullet} Scanning for updates\n` +
          `${THEME.bullet} Preparing deployment\n` +
          `${THEME.bullet} Warming up services\n` +
          `${THEME.divider}\n\n` +
          `╭─ ${THEME.bolt} *STATUS* ─╮\n` +
          `│ Initializing...\n` +
          `╰───────────────╯\n\n` +
          `${settings.footer}`
      });

      await new Promise(r => setTimeout(r, 800));

      if (!ensureAdmZip()) {
        const ok = await installAdmZip(chatId, conn, botRoot);
        if (!ok) {
          await conn.sendMessage(chatId, {
            text:
              `${banner()}\n\n` +
              `${THEME.cross} *Failed to install adm-zip*\n` +
              `${THEME.arrow} Update aborted.\n\n` +
              `${settings.footer}`
          });
          return;
        }
      }

      const commitInfo = await fetchCommitInfo();

      const infoLines = [];
      if (commitInfo.sha) {
        infoLines.push(`Commit   : ${commitInfo.sha}`);
        infoLines.push(`Date     : ${commitInfo.date || 'unknown'}`);
        if (commitInfo.message) infoLines.push(`Message  : ${commitInfo.message}`);
      } else {
        infoLines.push('Commit   : unavailable');
      }

      await conn.sendMessage(chatId, {
        text:
          `${banner()}\n\n` +
          `${THEME.gear} *UPDATING NEXORA MD*\n\n` +
          `┌─ ${THEME.star} *BUILD INFO*\n` +
          infoLines.map(l => `│ ${l}`).join('\n') + '\n' +
          `└──────────────────────────\n\n` +
          `┌─ ${THEME.rocket} *PROGRESS*\n` +
          `│ ①  Downloading latest version...\n` +
          `│ ②  Applying updates...\n` +
          `│ ③  Restarting services...\n` +
          `└──────────────────────────\n\n` +
          `╭─ ${THEME.bolt} *STATUS* ─╮\n` +
          `│ Updating...\n` +
          `╰───────────────╯\n\n` +
          `${settings.footer}`
      });

      const applyRes = await downloadAndApply(botRoot);

      await new Promise(r => setTimeout(r, 800));

      const finalTime = formatDate(new Date());

      let finalText = `${banner()}\n\n`;
      finalText += `${THEME.fire} *RESTART COMPLETED*\n\n`;
      finalText += `┌─ ${THEME.star} *BUILD INFO*\n`;
      finalText += `│ Commit   : ${commitInfo.sha || 'unknown'}\n`;
      finalText += `│ Finished : ${finalTime}\n`;
      finalText += `└──────────────────────────\n\n`;

      if (!applyRes.success) {
        finalText +=
          `${THEME.cross} *Update Failed*\n\n` +
          `┌─ ${THEME.arrow} *REASON*\n` +
          `│ ${applyRes.error || 'unknown'}\n` +
          `└──────────────────────────\n\n` +
          `╭─ ${THEME.bolt} *STATUS* ─╮\n` +
          `│ Restarting on current code...\n` +
          `╰───────────────╯\n\n` +
          `${settings.footer}`;

        await conn.sendMessage(chatId, { text: finalText });

        await new Promise(r => setTimeout(r, 2500));
        exec('kill -15 1', (error) => {
          if (error) process.exit(0);
        });
        return;
      }

      finalText += `${THEME.check} Updates applied successfully.\n`;

      // ─────────────────────────────────────────
      // STEP: HOT RELOAD PLUGINS FIRST
      // ─────────────────────────────────────────
      let reloaded = { loaded: 0, failed: 0, missingDeps: [] };
      if (applyRes.pluginsChanged) {
        reloaded = reloadPlugins(botRoot);
        finalText += `\n${THEME.brain} *Plugins Reloaded*\n`;
        finalText += `┌──────────────────────────\n`;
        finalText += `│ Loaded : ${reloaded.loaded}\n`;
        finalText += `│ Failed : ${reloaded.failed}\n`;
        finalText += `└──────────────────────────\n`;
      }

      // ─────────────────────────────────────────
      // AUTO-REINSTALL TRIGGER
      // If deps changed OR plugins failed with missing modules → npm install
      // ─────────────────────────────────────────
      const missing = [...new Set(reloaded.missingDeps || [])];
      const shouldInstall = applyRes.depsChanged || missing.length > 0;

      if (shouldInstall) {
        finalText += `\n${THEME.box} *Dependencies Required*\n`;
        finalText += `┌──────────────────────────\n`;
        if (applyRes.depsChanged) finalText += `│ package.json changed\n`;
        if (missing.length > 0) {
          finalText += `│ Missing modules:\n`;
          missing.forEach(m => { finalText += `│   ▸ ${m}\n`; });
        }
        finalText += `└──────────────────────────\n`;
        await conn.sendMessage(chatId, { text: finalText });

        const installOk = await runNpmInstall(chatId, conn, botRoot);

        // Reload plugins AGAIN after install (now that libs exist)
        const reloaded2 = reloadPlugins(botRoot);

        // Rebuild final message
        finalText = `${banner()}\n\n`;
        finalText += `${THEME.fire} *RESTART COMPLETED*\n\n`;
        finalText += `┌─ ${THEME.star} *BUILD INFO*\n`;
        finalText += `│ Commit   : ${commitInfo.sha || 'unknown'}\n`;
        finalText += `│ Finished : ${finalTime}\n`;
        finalText += `└──────────────────────────\n\n`;
        finalText += `${THEME.check} Updates applied successfully.\n`;
        finalText += installOk
          ? `${THEME.check} Dependencies installed\n`
          : `${THEME.cross} Dependencies install FAILED\n`;
        finalText += `\n${THEME.brain} *Plugins Reloaded*\n`;
        finalText += `┌──────────────────────────\n`;
        finalText += `│ Loaded : ${reloaded2.loaded}\n`;
        finalText += `│ Failed : ${reloaded2.failed}\n`;
        finalText += `└──────────────────────────\n`;

        reloaded = reloaded2;
      }

      // ── NEW COMMANDS ──
      if (commitInfo.newCommands.length > 0) {
        finalText += `\n${THEME.spark} *New Commands*\n`;
        finalText += `┌──────────────────────────\n`;
        commitInfo.newCommands.forEach(c => {
          finalText += `│ ${THEME.arrow} ${settings.prefix || '.'}${c}\n`;
        });
        finalText += `└──────────────────────────\n`;
      } else {
        finalText += `\n${THEME.arrow} No new commands detected.\n`;
      }

      const totalActive = (global.commands && global.commands.size) || 0;
      finalText += `\n${THEME.box} Total commands active: *${totalActive}*\n\n`;

      // ── RESTART IF CORE CHANGED ──
      if (applyRes.coreChanged) {
        finalText +=
          `${THEME.gear} *Core files updated*\n` +
          `Restarting process in 3s...\n\n` +
          `╭─ ${THEME.bolt} *STATUS* ─╮\n` +
          `│ Rebooting container...\n` +
          `╰───────────────╯\n\n` +
          `${settings.footer}`;

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

      finalText +=
        `${THEME.check} Plugins updated. No restart needed.\n\n` +
        `Send ${settings.prefix || '.'}menu to see the new list.\n\n` +
        `${settings.footer}`;

      await conn.sendMessage(chatId, { text: finalText });
      return;

    } catch (error) {
      console.log('[RESTART] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text:
            `${banner()}\n\n` +
            `${THEME.cross} *Restart Error*\n\n` +
            `┌─ ${THEME.arrow} *REASON*\n` +
            `│ ${error.message}\n` +
            `└──────────────────────────\n\n` +
            `${settings.footer}`
        });
      } catch (e) {}
    }
  }
};