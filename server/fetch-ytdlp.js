'use strict';

// Downloads a standalone yt-dlp binary (no Python required) into ./bin/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BIN_DIR = path.join(__dirname, 'bin');
const IS_WIN = process.platform === 'win32';
const TARGET = path.join(BIN_DIR, IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');

const ASSETS = {
  darwin: 'yt-dlp_macos',
  linux: process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux',
  win32: 'yt-dlp.exe'
};

async function main() {
  const asset = ASSETS[process.platform];
  if (!asset) {
    console.log(`[fetch-ytdlp] Unsupported platform "${process.platform}" — will fall back to system yt-dlp.`);
    return;
  }
  if (fs.existsSync(TARGET)) {
    console.log('[fetch-ytdlp] Binary already present.');
    return;
  }

  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  console.log(`[fetch-ytdlp] Downloading ${url} …`);

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  fs.mkdirSync(BIN_DIR, { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(TARGET, buf);
  if (!IS_WIN) fs.chmodSync(TARGET, 0o755);

  // sanity check
  try {
    const v = execSync(`"${TARGET}" --version`).toString().trim();
    console.log(`[fetch-ytdlp] OK — yt-dlp ${v}`);
  } catch {
    console.log('[fetch-ytdlp] Warning: downloaded binary did not run; falling back to system yt-dlp at runtime.');
  }
}

main().catch(err => {
  console.error('[fetch-ytdlp]', err.message);
  process.exit(0); // non-fatal: runtime falls back to system yt-dlp
});
