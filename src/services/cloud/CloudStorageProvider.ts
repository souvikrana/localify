import type { StorageUsage, Track } from '@/types';

/** A track as known by the remote provider (subset + remote identity). */
export interface RemoteTrack {
  id: string;
  localTrackId?: string;
  title: string;
  artist?: string;
  updatedAt: number;
}

/**
 * Contract for user-owned cloud backup providers (Google Drive, Dropbox,
 * OneDrive, S3…). Phase 2+: Localify uploads *only* when the user explicitly
 * connects their own account via OAuth. No proprietary server sits between
 * the app and the user's storage.
 *
 * Planned sync model:
 *
 *   Local Library ⇄ SyncManager ⇄ CloudStorageProvider
 *
 * The SyncManager will diff local vs remote manifests, upload new audio +
 * artwork, and pull remote-only items down for offline playback.
 */
export interface CloudStorageProvider {
  readonly id: string;
  readonly label: string;

  /** Run the OAuth flow in a popup window; resolves once authorized. */
  connect(): Promise<void>;

  disconnect(): Promise<void>;

  isConnected(): Promise<boolean>;

  uploadTrack(track: Track, audio: Blob, artwork?: Blob): Promise<void>;

  downloadTrack(trackId: string): Promise<Blob>;

  deleteTrack(trackId: string): Promise<void>;

  listTracks(): Promise<RemoteTrack[]>;

  getStorageUsage(): Promise<StorageUsage>;
}
