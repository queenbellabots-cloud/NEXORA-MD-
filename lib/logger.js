/**
 * NEXORA MD - Logger
 * Clean, no emoji decoration
 */

const chalk = require('chalk');

function timestamp() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

function prefix() {
  return chalk.magenta('[NEXORA MD]');
}

const logger = {
  info(msg) {
    console.log(`${prefix()} ${chalk.cyan(timestamp())} ${msg}`);
  },
  success(msg) {
    console.log(`${prefix()} ${chalk.cyan(timestamp())} ${chalk.green(msg)}`);
  },
  warn(msg) {
    console.log(`${prefix()} ${chalk.cyan(timestamp())} ${chalk.yellow(msg)}`);
  },
  error(msg) {
    console.log(`${prefix()} ${chalk.cyan(timestamp())} ${chalk.red(msg)}`);
  },
  raw(msg) {
    console.log(msg);
  }
};

module.exports = logger;