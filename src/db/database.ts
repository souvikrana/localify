import Dexie, { type Table } from 'dexie';
import type {
  Album,
  Artist,
  ArtworkRecord,
  HistoryEntry,
  Playlist,
  Track,
} from '@/types';

export interface AudioBlobRecord {
  key: string;
  blob: Blob;
}

/** key/value rows used for app settings + playback snapshot. */
export interface SettingsRecord {
  key: string;
  value: unknown;
}

/**
 * The entire application state lives here, on-device.
 * Binary audio is isolated in `audioBlobs` so metadata queries never
 * deserialize megabytes of media data.
 */
export class LocalifyDB extends Dexie {
  tracks!: Table<Track, string>;
  albums!: Table<Album, string>;
  artists!: Table<Artist, string>;
  playlists!: Table<Playlist, string>;
  history!: Table<HistoryEntry, number>;
  artworks!: Table<ArtworkRecord, string>;
  audioBlobs!: Table<AudioBlobRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor(name = 'localify') {
    super(name);
    this.version(1).stores({
      tracks:
        'id, title, artist, albumId, artistId, genre, hash, liked, playCount, dateAdded, lastPlayedAt',
      albums: 'id',
      artists: 'id',
      playlists: 'id, updatedAt',
      history: '++id, trackId, playedAt',
      artworks: 'id',
      audioBlobs: 'key',
      settings: 'key',
    });
  }
}

export const db = new LocalifyDB();

/** Settings keys used around the app (single source of truth). */
export const SETTINGS_KEYS = {
  THEME: 'appearance.theme',
  ACCENT: 'appearance.accent',
  AUDIO_QUALITY: 'storage.audioQuality',
  AUTO_TRANSCODE_LOSSLESS: 'storage.transcodeLossless',
  DEFAULT_SORT: 'library.defaultSort',
  SAVE_ARTWORK: 'downloads.saveArtwork',
  DEFAULT_VOLUME: 'playback.defaultVolume',
  PLAYBACK_SNAPSHOT: 'playback.snapshot',
  ONBOARDED: 'app.onboarded',
} as const;

/** Mirror settings into localStorage so index.html can apply theme pre-paint. */
export function mirrorSettingsToLocalStorage(): void {
  void db.settings.toArray().then((rows) => {
    try {
      localStorage.setItem('localify:settings', JSON.stringify(Object.fromEntries(rows.map((r) => [r.key, r.value]))));
    } catch {
      /* private-mode localStorage failures are non-fatal */
    }
  });
}
