/**
 * NEXORA MD - APK Downloader
 * Library: @lurepos/apkpure
 * Usage: .apk <app-name>
 */
const settings = require('../../settings');
const { ApkPure } = require('@lurepos/apkpure');
const fs = require('fs');

module.exports = {
  name: 'apk',
  aliases: ['apkdl'],
  category: 'download',
  description: 'Search and download APK from APKPure',
  usage: '.apk <app-name>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    let downloadedPath = null;
    try {
      const query = args.join(' ').trim();
      if (!query) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, { text: `Usage: ${settings.prefix || '.'}apk <app-name>\n\nExample: .apk WhatsApp\n\n${settings.footer}` });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Searching "${query}"...` });

      const client = new ApkPure({ outputDir: './data/tmp' });
      const results = await client.searchPackages(query);
      if (!results?.length) throw new Error('No results');

      const app = results[0];
      await conn.sendMessage(chatId, { text: `Found: ${app.name}\nDownloading...` });

      const download = await client.downloadPackage(app.packageName, { limit: 1 });
      if (!download?.filePath || !fs.existsSync(download.filePath)) throw new Error('Download failed');

      downloadedPath = download.filePath;
      const buffer = fs.readFileSync(downloadedPath);

      await conn.sendMessage(chatId, {
        document: buffer,
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${app.name.replace(/[^a-zA-Z0-9]/g, '_')}.apk`,
        caption: `${app.name}\n${app.packageName}\n\n${settings.footer}`
      }, { quoted: mek });
    } catch (error) {
      console.log('[APK] Error:', error.message);
      await conn.sendMessage(chatId, { text: `APK failed: ${error.message}\n\n${settings.footer}` });
    } finally {
      try { if (downloadedPath && fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath); } catch (e) {}
    }
  }
};