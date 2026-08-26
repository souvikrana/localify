import type { Track } from '@/types';
import { db } from '@/db/database';

export interface LocalAudioStorage {
  saveTrackAudio(key: string, blob: Blob): Promise<void>;
  getTrackAudio(key: string): Promise<Blob | null>;
  deleteTrackAudio(key: string): Promise<void>;
  audioBytes(): Promise<number>;
}

/**
 * Owns every audio byte on disk. UI code never touches IndexedDB directly —
 * it goes through this service (and the library service) only.
 */
class AudioStorageImpl implements LocalAudioStorage {
  async saveTrackAudio(key: string, blob: Blob): Promise<void> {
    await db.audioBlobs.put({ key, blob });
  }

  async getTrackAudio(key: string): Promise<Blob | null> {
    const record = await db.audioBlobs.get(key);
    return record?.blob ?? null;
  }

  async deleteTrackAudio(key: string): Promise<void> {
    await db.audioBlobs.delete(key);
  }

  /** Sum of stored audio sizes. Reads blob metadata without loading payloads. */
  async audioBytes(): Promise<number> {
    let total = 0;
    await db.audioBlobs.each((record) => {
      total += record.blob.size;
    });
    return total;
  }
}

export const AudioStorage = new AudioStorageImpl();

/** Convenience used by playback + export flows. */
export async function loadTrackBlob(track: Pick<Track, 'storageKey'>): Promise<Blob> {
  const blob = await AudioStorage.getTrackAudio(track.storageKey);
  if (!blob) throw new Error('Audio data is missing for this track');
  return blob;
}
