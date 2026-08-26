import type { Playlist } from '@/types';
import { db } from '@/db/database';
import { createId } from '@/utils/id';
import { sanitizeText } from '@/utils/text';
import type { Track } from '@/types';
import { saveArtwork } from '@/services/storage/ArtworkStorage';

export class PlaylistServiceClass {
  async getPlaylists(): Promise<Playlist[]> {
    const playlists = await db.playlists.toArray();
    return playlists.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    return db.playlists.get(id);
  }

  /** Resolve an ordered playlist into track objects (missing ones dropped). */
  async resolveTracks(playlist: Playlist): Promise<Track[]> {
    const tracks = await db.tracks.bulkGet(playlist.trackIds);
    return tracks.filter((t): t is Track => t !== undefined);
  }

  async create(name: string, description?: string): Promise<Playlist> {
    const cleanName = sanitizeText(name, 120);
    if (!cleanName) throw new Error('Playlist name is required');
    const playlist: Playlist = {
      id: createId(),
      name: cleanName,
      description: sanitizeText(description ?? '', 400) || undefined,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.playlists.put(playlist);
    return playlist;
  }

  async rename(id: string, name: string, description?: string): Promise<void> {
    await db.playlists.update(id, {
      name: sanitizeText(name, 120) || 'Untitled Playlist',
      ...(description !== undefined ? { description: sanitizeText(description, 400) } : {}),
      updatedAt: Date.now(),
    });
  }

  async remove(id: string): Promise<void> {
    await db.playlists.delete(id);
  }

  async addTracks(id: string, trackIds: string[]): Promise<number> {
    const playlist = await db.playlists.get(id);
    if (!playlist) return 0;
    const existing = new Set(playlist.trackIds);
    const fresh = trackIds.filter((tid) => !existing.has(tid));
    if (fresh.length === 0) return 0;
    await db.playlists.update(id, {
      trackIds: [...playlist.trackIds, ...fresh],
      updatedAt: Date.now(),
    });
    return fresh.length;
  }

  async removeTrackAt(id: string, index: number): Promise<void> {
    const playlist = await db.playlists.get(id);
    if (!playlist || index < 0 || index >= playlist.trackIds.length) return;
    const trackIds = [...playlist.trackIds];
    trackIds.splice(index, 1);
    await db.playlists.update(id, { trackIds, updatedAt: Date.now() });
  }

  async moveTrack(id: string, from: number, to: number): Promise<void> {
    const playlist = await db.playlists.get(id);
    if (!playlist) return;
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= playlist.trackIds.length ||
      to >= playlist.trackIds.length
    ) {
      return;
    }
    const trackIds = [...playlist.trackIds];
    const [moved] = trackIds.splice(from, 1);
    if (moved === undefined) return;
    trackIds.splice(to, 0, moved);
    await db.playlists.update(id, { trackIds, updatedAt: Date.now() });
  }

  async setCustomArtwork(id: string, blob: Blob): Promise<void> {
    const artworkId = await saveArtwork(blob);
    if (!artworkId) throw new Error('Could not process that image');
    await db.playlists.update(id, { artworkId, updatedAt: Date.now() });
  }
}

export const PlaylistService = new PlaylistServiceClass();
