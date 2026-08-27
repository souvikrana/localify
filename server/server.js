'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
// Prefer standalone binary, fall back to youtube-dl-exec bundled
const localBin = path.join(__dirname, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const YT_DLP_BIN = fs.existsSync(localBin)
  ? localBin
  : (() => { try { return require('youtube-dl-exec').constants.YOUTUBE_DL_PATH; } catch { return 'yt-dlp'; } })();

// Use system ffmpeg (installed via apt-get in Docker)
const FFMPEG_PATH = '/usr/bin/ffmpeg';

const app = express();
const PORT = process.env.PORT || 8000;

app.disable('x-powered-by');
app.use(express.json({ limit: '1kb' }));

// CORS for the GitHub Pages frontend
const ALLOWED = new Set([
  'https://souvikrana.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
]);

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ── helpers ─────────────────────────────────────────────────────── */

const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'music.youtube.com', 'youtu.be', 'www.youtu.be',
]);

function extractVideoId(raw) {
  try {
    const u = new URL(String(raw));
    if (!YT_HOSTS.has(u.hostname.toLowerCase())) return null;
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const segs = u.pathname.split('/').filter(Boolean);
    const marker = segs.findIndex(s => ['shorts', 'embed', 'live', 'v'].includes(s));
    if (marker !== -1 && segs[marker + 1] && /^[a-zA-Z0-9_-]{11}$/.test(segs[marker + 1])) {
      return segs[marker + 1];
    }
    return null;
  } catch { return null; }
}

function spawnYtdlp(args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let lastErr = '';
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Timed out')); }, timeoutMs);
    proc.stdout.on('data', c => { stdout += c.toString(); });
    proc.stderr.on('data', c => {
      const s = c.toString();
      stderr += s;
      lastErr = s.trim().split('\n').pop() || lastErr;
    });
    proc.on('error', reject);
    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(lastErr || `yt-dlp exited ${code}`));
      else resolve({ stdout, stderr });
    });
  });
}

/* ── GET /metadata ───────────────────────────────────────────────── */

app.get('/metadata', async (req, res) => {
  const url = String(req.query.url || '');
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Not a valid YouTube URL' });

  try {
    const { stdout } = await spawnYtdlp([
      `https://www.youtube.com/watch?v=${videoId}`,
      '--dump-single-json', '--no-playlist', '--no-warnings',
      '--socket-timeout', '15',
    ], 20_000);

    const info = JSON.parse(stdout);
    return res.json({
      videoId,
      title: info.title || `YouTube Video (${videoId})`,
      artist: info.uploader || info.channel || null,
      duration: Number(info.duration) || null,
      thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      extractionAvailable: true,
    });
  } catch {
    // yt-dlp failed — fall back to oEmbed
    try {
      const resp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (resp.ok) {
        const data = await resp.json();
        return res.json({
          videoId,
          title: data.title || `YouTube Video (${videoId})`,
          artist: data.author_name || null,
          duration: null,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          extractionAvailable: false,
        });
      }
    } catch {}
    return res.status(502).json({ error: 'Could not resolve video metadata' });
  }
});

/* ── GET /download ───────────────────────────────────────────────── */

app.get('/download', async (req, res) => {
  const url = String(req.query.url || '');
  const format = ['mp3', 'opus', 'm4a'].includes(req.query.format) ? req.query.format : 'mp3';
  const quality = ['128', '192', '256', '320'].includes(req.query.quality) ? req.query.quality : '192';
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Not a valid YouTube URL' });

  const dir = path.join(os.tmpdir(), `localify_${crypto.randomBytes(8).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });

  const outputTemplate = path.join(dir, '%(title)s.%(ext)s');
  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '-f', 'bestaudio/best',
    '-x', '--audio-format', format,
    '--audio-quality', `${quality}K`,
    '--ffmpeg-location', path.dirname(FFMPEG_PATH),
    '--no-playlist', '--no-warnings',
    '-o', outputTemplate,
  ];

  try {
    await spawnYtdlp(args, 120_000);
  } catch (err) {
    fs.rm(dir, { recursive: true, force: true }, () => {});
    const msg = String(err.message || err);
    if (/sign in|bot|confirm/i.test(msg)) {
      return res.status(503).json({
        error: 'YouTube is blocking automated downloads. Try a different video or import the file manually.',
      });
    }
    return res.status(502).json({ error: `Download failed: ${msg}` });
  }

  // Find the output file
  const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
  if (!files.length) {
    fs.rm(dir, { recursive: true, force: true }, () => {});
    return res.status(500).json({ error: 'No output produced' });
  }

  const chosen = files.find(f => f.toLowerCase().endsWith('.' + format)) || files[0];
  const filePath = path.join(dir, chosen);
  const stat = fs.statSync(filePath);

  // Try to get title from yt-dlp info for headers
  let title = chosen.replace(/\.[^.]+$/, '');
  let artist = '';
  let duration = '';
  let thumbnail = '';
  try {
    const { stdout } = await spawnYtdlp([
      `https://www.youtube.com/watch?v=${videoId}`,
      '--dump-single-json', '--no-playlist', '--no-warnings', '--skip-download',
    ], 15_000);
    const info = JSON.parse(stdout);
    title = info.title || title;
    artist = info.uploader || info.channel || '';
    duration = String(info.duration || '');
    thumbnail = info.thumbnail || '';
  } catch {}

  const mimeMap = { mp3: 'audio/mpeg', opus: 'audio/opus', m4a: 'audio/mp4' };
  const safeName = title.replace(/[^\w\s\-.]/g, '').trim() || 'youtube-audio';

  res.setHeader('Content-Type', mimeMap[format] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${format}"`);
  res.setHeader('X-Video-Title', title);
  res.setHeader('X-Video-Artist', artist);
  res.setHeader('X-Video-Duration', duration);
  res.setHeader('X-Video-Thumbnail', thumbnail);
  res.setHeader('Cache-Control', 'no-store');

  const stream = fs.createReadStream(filePath);
  stream.on('end', () => fs.rm(dir, { recursive: true, force: true }, () => {}));
  stream.on('error', () => { fs.rm(dir, { recursive: true, force: true }, () => {}); res.destroy(); });
  stream.pipe(res);
});

/* ── GET /health ─────────────────────────────────────────────────── */

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'localify-extractor' }));

/* ── start ───────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`Localify extractor → http://localhost:${PORT}`);
  console.log(`yt-dlp: ${YT_DLP_BIN}`);
  console.log(`ffmpeg: ${FFMPEG_PATH}`);
});
