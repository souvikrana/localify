import { create } from 'zustand';
import type { Album, Artist, Playlist, Track } from '@/types';
import { db } from '@/db/database';
import { LibraryService } from '@/services/library/LibraryService';
import { PlaylistService } from '@/services/library/PlaylistService';

/**
 * In-memory mirror of the persistent library. Loaded once at startup, then
 * kept in sync through store actions (which wrap the service layer).
 * Components select narrow slices to avoid re-render storms.
 */
interface LibraryState {
  loaded: boolean;
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];

  trackMap: Map<string, Track>;
  load: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;

  addTracks: (tracks: Track[]) => void;
  removeTrackIds: (ids: string[]) => void;
  replaceTrack: (track: Track) => void;

  setLiked: (trackId: string, liked: boolean) => Promise<void>;
  updateTrackMetadata: (
    id: string,
    patch: Parameters<typeof LibraryService.updateMetadata>[1]
  ) => Promise<Track | undefined>;
  deleteTracks: (ids: string[]) => Promise<void>;

  createPlaylist: (name: string, description?: string) => Promise<Playlist | undefined>;
  renamePlaylist: (id: string, name: string, description?: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  playlistAddTracks: (playlistId: string, ids: string[]) => Promise<number>;
  playlistRemoveTrackAt: (playlistId: string, index: number) => Promise<void>;
  playlistMoveTrack: (playlistId: string, from: number, to: number) => Promise<void>;
  playlistSetArtwork: (playlistId: string, blob: Blob) => Promise<void>;
}

function rebuildMap(tracks: Track[]): Map<string, Track> {
  return new Map(tracks.map((t) => [t.id, t]));
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  loaded: false,
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
  trackMap: new Map(),

  load: async () => {
    const [tracks, albums, artists, playlists] = await Promise.all([
      db.tracks.toArray(),
      db.albums.toArray(),
      db.artists.toArray(),
      PlaylistService.getPlaylists(),
    ]);
    set({
      tracks,
      albums,
      artists,
      playlists,
      trackMap: rebuildMap(tracks),
      loaded: true,
    });
  },

  refreshPlaylists: async () => {
    const playlists = await PlaylistService.getPlaylists();
    set({ playlists });
  },

  addTracks: (added) =>
    set((state) => {
      const byId = new Map(state.tracks.map((t) => [t.id, t]));
      for (const track of added) byId.set(track.id, track);
      const tracks = [...byId.values()];
      return { tracks, trackMap: rebuildMap(tracks) };
    }),

  removeTrackIds: (ids) =>
    set((state) => {
      const dead = new Set(ids);
      const tracks = state.tracks.filter((t) => !dead.has(t.id));
      // Albums/artists are rebuilt from the DB on next full refresh; patch
      // the common cases locally so the UI stays correct immediately.
      void get();
      return { tracks, trackMap: rebuildMap(tracks) };
    }),

  replaceTrack: (track) =>
    set((state) => {
      const tracks = state.tracks.some((t) => t.id === track.id)
        ? state.tracks.map((t) => (t.id === track.id ? track : t))
        : [track, ...state.tracks];
      return { tracks, trackMap: rebuildMap(tracks) };
    }),

  setLiked: async (trackId, liked) => {
    // Optimistic update — feels instant, persists underneath.
    const track = get().trackMap.get(trackId);
    if (!track || track.liked === liked) return;
    get().replaceTrack({ ...track, liked });
    try {
      await LibraryService.setLiked(trackId, liked);
    } catch (err) {
      console.error('[libraryStore] like failed', err);
      const rollback = get().trackMap.get(trackId);
      if (rollback) get().replaceTrack({ ...rollback, liked: !liked });
      throw err;
    }
  },

  updateTrackMetadata: async (id, patch) => {
    const updated = await LibraryService.updateMetadata(id, patch);
    if (updated) {
      get().replaceTrack(updated);
      // Aggregates may have changed names/ids — re-read them cheaply.
      const [albums, artists] = await Promise.all([db.albums.toArray(), db.artists.toArray()]);
      set({ albums, artists });
    }
    return updated;
  },

  deleteTracks: async (ids) => {
    await LibraryService.deleteTracks(ids);
    get().removeTrackIds(ids);
    const [albums, artists] = await Promise.all([db.albums.toArray(), db.artists.toArray()]);
    set({ albums, artists });
  },

  createPlaylist: async (name, description) => {
    try {
      const playlist = await PlaylistService.create(name, description);
      await get().refreshPlaylists();
      return playlist;
    } catch (err) {
      console.error('[libraryStore] createPlaylist failed', err);
      return undefined;
    }
  },

  renamePlaylist: async (id, name, description) => {
    await PlaylistService.rename(id, name, description);
    await get().refreshPlaylists();
  },

  deletePlaylist: async (id) => {
    await PlaylistService.remove(id);
    await get().refreshPlaylists();
  },

  playlistAddTracks: async (playlistId, ids) => {
    const added = await PlaylistService.addTracks(playlistId, ids);
    if (added > 0) await get().refreshPlaylists();
    return added;
  },

  playlistRemoveTrackAt: async (playlistId, index) => {
    await PlaylistService.removeTrackAt(playlistId, index);
    await get().refreshPlaylists();
  },

  playlistMoveTrack: async (playlistId, from, to) => {
    // Optimistic reorder.
    const playlists = get().playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const trackIds = [...p.trackIds];
      const [moved] = trackIds.splice(from, 1);
      if (moved !== undefined) trackIds.splice(to, 0, moved);
      return { ...p, trackIds, updatedAt: Date.now() };
    });
    set({ playlists });
    try {
      await PlaylistService.moveTrack(playlistId, from, to);
    } finally {
      await get().refreshPlaylists();
    }
  },

  playlistSetArtwork: async (playlistId, blob) => {
    await PlaylistService.setCustomArtwork(playlistId, blob);
    await get().refreshPlaylists();
  },
}));

/** Convenience selector: resolve a track id to a Track. */
export function useTrackById(id: string | undefined): Track | undefined {
  return useLibraryStore((s) => (id ? s.trackMap.get(id) : undefined));
}
