/**
 * NEXORA MD - Lightweight JSON store
 * Mirrors Bella's store
 */

const fs = require('fs');

class LightweightStore {
  constructor() {
    this.contacts = {};
    this.messages = {};
    this.filePath = './data/store.json';
  }

  readFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(data);
        this.contacts = parsed.contacts || {};
        this.messages = parsed.messages || {};
      }
    } catch (error) {
      console.error('Error reading store:', error.message);
    }
  }

  writeToFile() {
    try {
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify({
        contacts: this.contacts,
        messages: this.messages
      }, null, 2));
    } catch (error) {
      console.error('Error writing store:', error.message);
    }
  }

  bind(ev) {
    ev.on('contacts.update', (updates) => {
      for (let update of updates) {
        if (update.id && update.notify) {
          this.contacts[update.id] = {
            id: update.id,
            name: update.notify
          };
        }
      }
    });
  }

  async loadMessage(jid, id) {
    try {
      if (this.messages[jid] && this.messages[jid][id]) {
        return this.messages[jid][id];
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new LightweightStore();