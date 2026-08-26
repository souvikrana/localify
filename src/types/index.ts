export type TrackSource = 'local' | 'url' | 'youtube';

export type RepeatMode = 'off' | 'all' | 'one';

export type AudioQuality = 'high' | 'balanced' | 'saver';

/** A single song in the local library. */
export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Grouping ids derived from names — see utils/grouping.ts. */
  artistId: string;
  albumId: string;
  album: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  /** Duration in seconds (0 until known). */
  duration: number;
  /** Container/format label, e.g. "mp3", "flac", "opus". */
  format: string;
  mimeType: string;
  fileSize: number;
  artworkId?: string;
  source: TrackSource;
  originalFilename?: string;
  sourceUrl?: string;
  dateAdded: number;
  lastPlayedAt?: number;
  playCount: number;
  liked: boolean;
  /** Key of the audio blob in the `audioBlobs` store. */
  storageKey: string;
  /** SHA-256 of file content — used for duplicate detection. */
  hash: string;
  bitrateKbps?: number;
  sampleRateHz?: number;
}

/** Aggregated album view, rebuilt as tracks are added/removed. */
export interface Album {
  id: string;
  name: string;
  artist: string;
  year?: number;
  genre?: string;
  artworkId?: string;
  trackIds: string[];
  totalDuration: number;
}

/** Aggregated artist view, rebuilt as tracks are added/removed. */
export interface Artist {
  id: string;
  name: string;
  artworkId?: string;
  trackCount: number;
  albumCount: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  /** Explicit user-set artwork; otherwise derived from first track. */
  artworkId?: string;
}

export interface HistoryEntry {
  id?: number;
  trackId: string;
  playedAt: number;
}

export interface ArtworkRecord {
  id: string;
  /** Full-resolution image (max ~1024px on the long edge). */
  full: Blob;
  /** ~320px thumbnail used by cards and lists. */
  thumb: Blob;
  width: number;
  height: number;
}

/** Persisted snapshot so playback survives reloads. */
export interface PlaybackSnapshot {
  trackId: string;
  positionSec: number;
  queueTrackIds: string[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  savedAt: number;
}

export interface StorageUsage {
  usageBytes: number;
  quotaBytes: number;
  audioBytes: number;
  artworkBytes: number;
}

export interface DownloadProgress {
  phase: 'metadata' | 'downloading' | 'processing' | 'done';
  progress: number;
  receivedBytes?: number;
  totalBytes?: number;
}

export interface TrackMetadata {
  sourceUrl?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  thumbnailUrl?: string;
}
