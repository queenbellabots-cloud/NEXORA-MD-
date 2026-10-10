/**
 * NEXORA MD - APK Downloader
 * Library: apkpure
 * Usage: .apk <app-name>
 */
const settings = require('../../settings');
const { ApkPure } = require('apkpure');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'apk',
  aliases: ['apkdl'],
  category: 'download',
  description: 'Search and download APK from APKPure',
  usage: '.apk <app-name>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    let tmpFile = null;
    try {
      const query = args.join(' ').trim();
      if (!query) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, {
          text: `Usage: ${settings.prefix || '.'}apk <app-name>\n\nExample: .apk WhatsApp\n\n${settings.footer}`
        });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Searching APKPure for "${query}"...` });

      const client = new ApkPure({ outputDir: './data/tmp' });

      // 1. Search for the app to get its package name
      const apps = await client.searchPackages(query);
      if (!apps || apps.length === 0) {
        throw new Error(`No results for "${query}"`);
      }

      const app = apps[0];
      const packageName = app.packageName || app.package;
      if (!packageName) {
        throw new Error('Could not resolve package name');
      }

      await conn.sendMessage(chatId, { text: `Found: ${app.name || app.title}\nDownloading latest APK...` });

      // 2. Download the latest version (limit: 1 = latest)
      const result = await client.downloadPackage(packageName, { limit: 1 });

      // The library may return an array of downloaded files
      const downloaded = Array.isArray(result) ? result[0] : result;
      const filePath = downloaded?.file || downloaded?.path || downloaded?.filePath;

      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('APK download failed');
      }

      tmpFile = filePath;
      const buffer = fs.readFileSync(filePath);

      await conn.sendMessage(chatId, {
        document: buffer,
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${(app.name || packageName).replace(/[^a-zA-Z0-9]/g, '_')}.apk`,
        caption: `${app.name || packageName}\n${packageName}\n\n${settings.footer}`
      }, { quoted: mek });

    } catch (error) {
      console.log('[APK] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, {
        text: `APK failed: ${error.message}\n\n${settings.footer}`
      });
    } finally {
      try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
};