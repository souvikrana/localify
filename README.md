# Localify

**Your music. Your device. Your library.**

Localify is a **local-first music player** that runs entirely in your browser.
There is no server, no account and no telemetry: your audio files, artwork,
likes, playlists and listening history live in your browser's own storage
(IndexedDB) and every core feature works **completely offline**.

```
Import music ──▶ stored on-device ──▶ play / search / organise offline
```

---

## Features

- **Import local files** — drag & drop anywhere, file picker, or whole-folder
  import (MP3 · FLAC · WAV · M4A/AAC · OGG · Opus · WebM · AIFF)
- **Automatic metadata** — ID3 / Vorbis / MP4 tags via `music-metadata`, with a
  smart `Artist - Title` filename fallback; editable in-app
- **Embedded artwork** — extracted, deduplicated by content hash and resized to
  thumbnails so huge libraries stay fast
- **Optional lossless → Opus conversion** — WAV/FLAC/AIFF imports can be
  transcoded in-browser (WebCodecs) at High/Balanced/Saver quality. Every
  conversion is verified by a decode round-trip; the original is kept if
  anything fails. Compressed formats are never re-compressed.
- **Full playback engine** — play/pause, seek, volume/mute, playback speed,
  shuffle (stable around the current track), repeat off/all/one, queue with
  drag-reorder ("Play next", "Add to queue", save queue as playlist),
  next-track preloading for instant transitions
- **Media Session API** — lock screen / Bluetooth / OS media controls with
  artwork, plus seek actions where supported
- **Persistent session** — reload or close the browser and your queue,
  position, shuffle/repeat state come back
- **Library browsing** — Songs (virtualized for 10k+), Albums, Artists, Genres,
  Liked Songs, Recently Played
- **Playlists** — create, rename, describe, reorder (drag), custom artwork,
  delete; optimistic updates everywhere
- **Instant offline search** — fuzzy matching (prefix / word-boundary /
  subsequence) across titles, artists, albums, genres, playlist names and
  filenames
- **Likes** — one-tap heart, optimistic UI, persisted locally
- **Downloader** — direct audio URLs download fully in-browser with progress;
  YouTube links resolve metadata honestly and explain exactly why browsers
  cannot fetch their streams (see [YouTube import](#youtube-import))
- **PWA** — installable, service-worker-cached app shell, offline indicator
- **Storage management** — usage breakdown, largest songs, history/artwork
  cleanup, storage-persistence request
- **Keyboard shortcuts** — Space, ←/→ (+Shift for track skip), ↑/↓, M,
  Ctrl/⌘K (listed in Settings → About)
- **Dark / light / system theme** with accent-color choices

---

## Quick start

```bash
cd localify
npm install
npm run dev        # → http://localhost:5173
```

> Node 20+ recommended (built with Node 24).

### Commands

| Command             | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Vite dev server with HMR             |
| `npm run build`     | Type-check + production build        |
| `npm run preview`   | Serve the production build locally   |
| `npm run test`      | Run the Vitest suite                 |
| `npm run lint`      | ESLint                               |
| `npm run typecheck` | TypeScript, strict mode, no emit     |

The production bundle is fully static (`dist/`) — host it on any static file
server (GitHub Pages, Netlify, nginx…) and it works. No backend exists or is
required.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│ React UI (pages, components)                               │
│   never touches IndexedDB directly                         │
├────────────────────────────────────────────────────────────┤
│ Zustand stores                                             │
│   libraryStore  – in-memory mirror of persistent data      │
│   playbackStore – reactive projection of PlaybackService   │
│   uiStore / importStore – dialogs, toasts, progress        │
├────────────────────────────────────────────────────────────┤
│ Services                                                   │
│   LibraryService    MetadataService    PlaylistService     │
│   PlaybackService   QueueManager       MediaSessionService │
│   AudioStorage      ArtworkStorage     StorageManager      │
│   Transcoder        OggOpusMuxer                           │
│   Downloader registry (Direct / YouTube / future cloud)    │
├────────────────────────────────────────────────────────────┤
│ IndexedDB (Dexie) — the single source of truth             │
└────────────────────────────────────────────────────────────┘
```

Key decisions:

- **UI state vs persistent data are strictly separated.** Dexie is the source
  of truth; stores are caches that services keep in sync.
- **Playback position is throttled** — snapshots persist every ~5 s and on
  page hide, never per animation frame.
- **Virtualization** (`@tanstack/react-virtual`) keeps song lists at 60 fps
  with five-figure libraries; search runs over in-memory metadata strings only.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full tour, schema reference
and design rationale.

---

## Local storage

Everything lives in the `localify` IndexedDB database:

| Store        | Contents                                              |
| ------------ | ----------------------------------------------------- |
| `tracks`     | Song metadata (indexed: title, artist, album, genre…) |
| `albums`     | Aggregated album views (rebuilt incrementally)        |
| `artists`    | Aggregated artist views                               |
| `playlists`  | Ordered `trackIds` arrays (atomic reorder-friendly)   |
| `history`    | Capped playback history (~3000 entries)               |
| `artworks`   | Deduplicated full image + ~320 px thumbnail           |
| `audioBlobs` | **All audio bytes**, isolated from metadata queries   |
| `settings`   | Theme, accent, quality prefs, playback snapshot       |

Binary audio lives in its own store so listing/searching thousands of tracks
never deserializes media payloads. Artwork object-URLs are cached (bounded LRU)
to avoid re-decoding images while scrolling.

Storage screens use `navigator.storage.estimate()` plus real byte sums, and the
app requests **persistent storage** so browsers won't silently evict your
library.

---

## Offline mode

- The PWA service worker precaches the entire app shell (JS/CSS/HTML/icons).
- Music, artwork, playlists, likes and history live in IndexedDB — already
  local.
- Search is pure in-memory string scoring. No code path for any core feature
  touches the network.
- When offline: an unobtrusive banner explains that everything still works.
  Only *new* downloads are unavailable.
- YouTube thumbnail previews are cached by the service worker when online so
  recent link previews survive offline restarts.

Test it: DevTools → Network → Offline → reload → play, search, like, playlist.

---

## Audio playback

`PlaybackService` owns one `<audio>` element, the `QueueManager`, snapshot
persistence and next-track prefetching:

1. Blob read from `audioBlobs` → `URL.createObjectURL` → element source
2. Queue logic is a **pure class** (fully unit-tested): stable Fisher–Yates
   shuffle anchored on the current track, natural-order restore, repeat modes
   with explicit-skip semantics, safe index arithmetic on remove/reorder
3. Next track's blob is prefetched so transitions don't wait on disk
4. Media Session integration degrades gracefully when unsupported
5. Playback errors map to friendly messages ("format not supported…"), never
   stack traces

### Lossless→Opus pipeline (optional, default ON where supported)

```
WAV / FLAC / AIFF file
   ↓ AudioContext.decodeAudioData          (browser-native decode)
   ↓ WebCodecs AudioEncoder (Opus)         192 / 128 / 96 kbps
   ↓ OggOpusMuxer (RFC 7845 subset, written in-house)
   ↓ verification: decode round-trip + duration tolerance
   ↓ pass → store Opus (often 40-70% smaller than WAV)
     fail → keep the original file, log a warning
```

MP3/M4A/OGG/etc. are **always stored as-is** — recompressing lossy formats
wastes CPU and battery for no gain. Browsers without `AudioEncoder` simply
skip conversion (the toggle disables itself).

---

## YouTube import

Honest status: **metadata yes, audio no.**

- ✅ Pasting a YouTube URL resolves **title, channel and thumbnail**
  client-side via YouTube's public oEmbed endpoint (CORS-enabled).
- ❌ The actual audio stream **cannot be fetched by any purely client-side web
  app**: stream URLs are CORS-restricted and signed for YouTube's own player.
  Working around that requires a server-side extractor, which Localify
  deliberately refuses to include.

So the downloader is a clean, replaceable interface:

```ts
interface MusicDownloader {
  id: string;
  canHandle(url): boolean;
  getMetadata(url): Promise<TrackMetadata>;
  download(url, onProgress?, signal?): Promise<DownloadedAudio>;
}
```

- `DirectAudioDownloader` — **fully working** for any CORS-enabled direct audio
  link (archive.org, podcasts, your own S3/bucket/server). Streams with byte
  progress, sniffs magic numbers before accepting, then runs the normal import
  pipeline (hash → dedupe → tags → artwork → store).
- `YouTubeDownloader` — resolves previews, then fails `download()` with a clear
  explanation card in the UI and routes you to file import instead.

Registering a future provider (e.g. a self-hosted extractor you authorize) is a
one-line change in `services/downloader/index.ts`; no UI changes required.

---

## Browser compatibility

| Browser         | Status                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Chrome/Edge 90+ | Full experience, including lossless→Opus conversion (WebCodecs)         |
| Firefox 90+     | Everything except Opus encoding (toggle auto-disables); playback/search |
| Safari 16+      | Everything except Opus encoding; install support varies by platform     |

Core promises — import, play, search, playlists, likes, persistence — work in
any modern evergreen browser.

### Known limitations

- **YouTube audio** requires the manual step described above (by design).
- Folder import uses `webkitdirectory` (all major desktop browsers support it;
  some mobile browsers hide folder pickers).
- Direct-link downloads require the source to send CORS headers — that's a
  browser security rule, not a Localify bug.
- Very large lossless files (>~300 MB) are kept as-is rather than transcoded,
  to avoid memory spikes on mobile devices.
- Private/incognito windows may evict storage aggressively; request persistent
  storage from Settings → Storage and prefer an installed PWA profile.
- Safari's Media Session seek-to support is partial; play/pause/next/prev work.

---

## Testing

```bash
npm run test
```

61 tests across 5 suites cover the business core:

- **QueueManager** — set/advance/repeat/shuffle-stability/remove/reorder/clear
- **PlaybackService** — queue operations through the real service
- **LibraryService + AudioStorage** — persistence across "reloads", likes,
  play-count/history, deletes (blob + playlist references), metadata edits with
  album/artist regrouping, duplicate detection (hash + fuzzy title/duration)
- **Search** — exact/prefix/word-boundary/subsequence scoring, diacritics,
  field weighting, genre grouping
- **OggOpusMuxer** — page framing, OpusHead/OpusTags layout, lacing edge cases
  (255-byte packets, zero-terminators)
- **Downloaders** — YouTube URL parsing matrix, registry routing, format sniffing

Run against `fake-indexeddb` with per-test database resets. Real-audio decoding
and end-to-end playback are covered by the manual acceptance checklist in
[ARCHITECTURE.md](./ARCHITECTURE.md#acceptance-checklist).

---

## Data ownership & privacy

No analytics. No accounts. No network calls except: YouTube oEmbed +
thumbnails when you paste a link, direct downloads you initiate, and service-
worker asset caching. Your data leaves the device only when you export a file
or (in a future phase) connect **your own** cloud storage.

## Future roadmap

1. **Phase 2 — Cloud backup**: OAuth to Google Drive/Dropbox via the existing
   `CloudStorageProvider` interface; user-owned storage only (plan in
   ARCHITECTURE.md).
2. Sync manager (diff manifests, upload/download tracks + artwork).
3. Crossfade, equalizer (Web Audio graph), lyrics tagging.
4. Library export/import as a portable archive.

---

Built as a demonstration that a music app can be fast, beautiful and respect
its users — without a backend.
