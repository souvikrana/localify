# Localify — Architecture

This document is the deep-dive companion to the README: project structure,
database schema, the storage/import pipeline, playback engine, downloader
boundary, performance strategy and future cloud plan.

---

## 1. Project structure

```
localify/
├── index.html                  # pre-paint theme bootstrap (no flash)
├── vite.config.ts              # Vite 8 + React + Tailwind v4 + PWA + Vitest
├── public/
│   ├── favicon.svg             # source of truth for iconography
│   └── icons/                  # PWA PNG icons (192/512/maskable/apple)
├── src/
│   ├── app/App.tsx             # routes + one-time engine wiring
│   ├── components/
│   │   ├── dialogs/            # AddMusic, Create/Edit playlist & metadata,
│   │   │                       # Confirm, Shortcuts, Welcome, DialogHost
│   │   ├── layout/             # AppShell (responsive frame), MobileNav,
│   │   │                       # OfflineBanner
│   │   ├── library/            # TrackRow, virtualized list, shelves/cards,
│   │   │                       # context-menu builder, global drop zone
│   │   ├── player/             # PlayerBar, NowPlayingOverlay, QueuePanel/Host
│   │   └── ui/                 # design-system primitives (Button, Slider,
│   │                           # Modal, BottomSheet, ContextMenu, Artwork…)
│   ├── db/database.ts          # Dexie schema + settings keys (single source)
│   ├── hooks/                  # useIsMobile, useOnlineStatus,
│   │                           # useKeyboardShortcuts, useResolvedTracks
│   ├── pages/                  # Home, Search, Library tabs, detail pages,
│   │                           # Playlists (+detail), Settings, NotFound
│   ├── services/
│   │   ├── audio/              # PlaybackService, QueueManager, Transcoder,
│   │   │                       # OggOpusMuxer, MediaSessionService
│   │   ├── downloader/         # MusicDownloader iface + Direct/YouTube impls
│   │   ├── library/            # LibraryService, MetadataService,
│   │   │                       # PlaylistService, searchService
│   │   ├── storage/            # AudioStorage, ArtworkStorage, StorageManager
│   │   └── cloud/              # CloudStorageProvider interface (Phase 2)
│   ├── stores/                 # zustand: library, playback, ui, import
│   ├── styles/index.css        # design tokens + Tailwind v4 theme mapping
│   ├── types/                  # domain model
│   └── utils/                  # format, text/sanitize, hash, id, emitter…
└── tests/                      # Vitest suites (node/jsdom + fake-indexeddb)
```

### Layering rules

1. **UI → stores → services → DB.** Components never import `db` directly.
2. Services own their domain: only `LibraryService` mutates track rows;
   only `PlaybackService` touches the `<audio>` element.
3. Runtime vs persistent state are separate: stores may be discarded at any
   time; IndexedDB is authoritative.

---

## 2. Database schema (Dexie / IndexedDB v1)

```ts
tracks     'id, title, artist, albumId, artistId, genre, hash, liked,
            playCount, dateAdded, lastPlayedAt'
albums     'id'
artists    'id'
playlists  'id, updatedAt'
history    '++id, trackId, playedAt'
artworks   'id'
audioBlobs 'key'                    // { key: "audio:<trackId>", blob }
settings   'key'
```

- **`albums` / `artists` are derived aggregates** keyed by deterministic ids
  (`al:<groupKey(albumArtist)||album>`, `ar:<groupKey(artist)>`) so the same
  album always collapses regardless of tag case/diacritics. They are updated
  incrementally on single mutations and rebuilt (`rebuildAggregates`) after
  bulk structural changes — O(n), safe at 10k+ tracks.
- **Playlists embed ordered `trackIds`.** A join table would make reordering a
  multi-row transaction; an ordered array is atomic in one row update.
- **`audioBlobs` isolation**: metadata queries never deserialize audio bytes.
  Storage accounting reads sizes via cursor without loading payloads into JS
  strings.
- **Artwork dedup**: `id = aw:<sha256[:32]>` — importing 200 albums from the
  same rips stores each unique cover once, plus a ~320 px thumbnail generated
  with canvas (OffscreenCanvas when available).
- **Settings** is a KV store; keys live in one constant object
  (`SETTINGS_KEYS`). Theme is mirrored to `localStorage` so `index.html` can
  apply it before first paint.

### Duplicate detection

1. SHA-256 of file bytes → exact match ⇒ duplicate (`identical-file`)
2. else same normalized title + artist within ±3 s duration ⇒
   `same-title-and-length`
3. Import UI pauses for that file and asks **Skip / Keep both**.

---

## 3. Import pipeline

```
File(s) ─▶ looksLikeAudio? ─▶ sha256 hash ─▶ duplicate? ──▶ user decision
                │                                             │
                ▼                                             ▼
        readTags (music-metadata) ◀── fallback: filename heuristics
                │
                ├─ embedded picture ─▶ saveArtwork (dedupe + thumbnails)
                │
                ├─ lossless && conversion enabled?
                │     └─ transcodeToOpus (verified) or keep original
                │
                ├─ duration: tags ?? <audio> metadata probe
                ▼
        AudioStorage.put(blob) ─▶ tracks.put(row) ─▶ upsert album/artist
```

- Files process sequentially with explicit yields (`yieldToMain`) so batches
  never freeze the UI; progress reports per-file name and counts.
- Quota failures surface as friendly errors ("Not enough device storage") with
  no partial state: blob write happens inside try/catch before row insert.

## 4. Playback engine

`PlaybackService` (singleton) owns:

- **one** `<audio>` element (created lazily; jsdom-safe for tests)
- `QueueManager` — pure ordering logic:
  - shuffle = Fisher–Yates of *remaining* items anchored behind the current
    track; disabling restores natural order
  - repeat-one loops in-place; explicit skip uses
    `advanceSkippingRepeatOne()`
  - remove/reorder adjust indices so playback never jumps unexpectedly
- **snapshot persistence** (throttled 5 s + pagehide): queue ids, index,
  position, shuffle/repeat → restored paused at app start
- **prefetch**: next track's object URL is materialized ahead of time
- **play counting**: a "play" records after ~8 s of listening or on natural end
- error events map DOM exceptions to user-safe messages consumed by the toast
  system

`MediaSessionService` subscribes to engine events and sets action handlers +
metadata (awaiting artwork URLs). Every handler is guarded for unsupported
APIs.

## 5. Design system

Tokens are CSS custom properties flipped by `[data-theme]`, mapped into
Tailwind v4 via `@theme inline` — components use semantic utilities
(`bg-surface-2`, `text-fg-muted`, `border-line`) and never hard-code colors.
Accent is a single runtime-swappable variable. Motion respects
`prefers-reduced-motion` twice: CSS overrides + Framer `MotionConfig`.

Mobile patterns: bottom tab bar, bottom sheets (menus, queue), compact player
strip, `env(safe-area-inset-*)` padding everywhere it matters, ≥40 px touch
targets.

## 6. Performance strategy

| Concern               | Approach                                                        |
| --------------------- | --------------------------------------------------------------- |
| 10k+ song lists       | `@tanstack/react-virtual` windowing (~10 live rows)             |
| Search latency        | single scored pass over in-memory strings, debounced input      |
| Re-render control     | narrow zustand selectors; memoized rows; position isolated      |
| Memory                | bounded LRU artwork URL cache; prefetch cache capped at 3 blobs |
| Startup               | code-split vendor/media/motion chunks; lazy dialog content      |
| Storage pressure      | thumbnails instead of full art; optional Opus conversion        |

## 7. Cloud backup (Phase 2 plan)

`CloudStorageProvider` already defines the contract:

```
connect()/disconnect()/isConnected()
uploadTrack(track, audio, artwork?) / downloadTrack(id) / deleteTrack(id)
listTracks(): RemoteTrack[]          // manifest for diffing
getStorageUsage()
```

Implementation order:

1. `GoogleDriveProvider` — OAuth via `google.accounts.oauth2` (token client,
   no server secret needed for drive.file scope), app-data folder
   `Localify/<trackId>.<ext>` + `manifest.json`.
2. `SyncManager` — three-way diff between local rows, remote manifest and last
   sync marker: upload new/changed, download missing, respect deletions with a
   confirmation pass. Conflict rule: newest `updatedAt` wins, loser kept as
   copy.
3. Settings gains Connect/Status/Last-synced UI wired to the provider registry.

Nothing in the current codebase needs restructuring for this — providers plug
in exactly like downloaders do today.

---

## Acceptance checklist (manual)

Run through this against `npm run build && npm run preview`:

1. **Offline boot** — DevTools Network → Offline, reload: app loads, library
   loads, search works, songs play, queue works, likes/playlists work.
2. **Import 20 files** — drag-drop onto the app: progress lists names, no UI
   freeze, metadata + artwork appear.
3. **Refresh** — library, likes, playlists persist; last track + position
   restore paused.
4. **Full browser restart** — everything still plays (persistent storage helps
   here; grant it in Settings → Storage).
5. **Search** — artist, album, song title all return instant grouped results.
6. **Playlist round-trip** — create "My Playlist", add five songs, restart:
   intact and playable.
7. **Mobile viewport (360–430 px)** — no horizontal scroll, mini-player taps
   open full player, bottom nav works, queue sheet opens, controls reachable.
8. **Storage failure** — fill quota (or simulate): friendly toast, library
   state remains consistent.
9. **Keyboard**: Space/←/→/↑/↓/M/Ctrl-K behave and ignore typing fields.
10. **Media keys / lock screen** (desktop Chrome or Android PWA): play/pause/
    next/prev with artwork reflected.
