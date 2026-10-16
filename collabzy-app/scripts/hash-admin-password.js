#!/usr/bin/env node
'use strict';

const bcrypt = require('bcryptjs');

function readHiddenPassword() {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive terminal so the password can be entered without echo.'));
      return;
    }
    process.stdout.write('Choose an admin password (hidden, 14–72 UTF-8 bytes): ');
    input.setRawMode(true);
    input.resume();
    const bytes = [];
    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(Buffer.from(bytes).toString('utf8'));
    };
    const onData = (chunk) => {
      for (const byte of chunk) {
        if (byte === 3) {
          finish(new Error('Password entry cancelled.'));
          return;
        }
        if (byte === 13 || byte === 10) {
          finish();
          return;
        }
        if (byte === 8 || byte === 127) {
          if (bytes.length) {
            bytes.pop();
            while (bytes.length && (bytes[bytes.length - 1] & 0xc0) === 0x80) bytes.pop();
            if (bytes.length && ((bytes[bytes.length - 1] & 0xe0) === 0xc0 || (bytes[bytes.length - 1] & 0xf0) === 0xe0 || (bytes[bytes.length - 1] & 0xf8) === 0xf0)) bytes.pop();
          }
          continue;
        }
        if (byte >= 32 && byte !== 127) bytes.push(byte);
      }
    };
    input.on('data', onData);
  });
}

(async () => {
  try {
    const password = await readHiddenPassword();
    const size = Buffer.byteLength(password, 'utf8');
    if (password.length < 14 || size > 72) {
      throw new Error('Use at least 14 characters and no more than 72 UTF-8 bytes.');
    }
    const hash = await bcrypt.hash(password, 12);
    process.stdout.write('\nCOLLABZY_ADMIN_PASSWORD_HASH (copy this hash into Render; do not commit it):\n' + hash + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
})();
