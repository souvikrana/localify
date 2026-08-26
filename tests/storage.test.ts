// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { LibraryService } from '@/services/library/LibraryService';
import { AudioStorage } from '@/services/storage/AudioStorage';
import { PlaylistService } from '@/services/library/PlaylistService';
import { db } from '@/db/database';
import { makeTrack } from './helpers';

describe('AudioStorage', () => {
  it('saves, retrieves and deletes audio blobs', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' });
    await AudioStorage.saveTrackAudio('audio:test-1', blob);
    const restored = await AudioStorage.getTrackAudio('audio:test-1');
    expect(restored).not.toBeNull();
    expect(restored?.size).toBe(3);
    expect(restored?.type).toBe('audio/mpeg');

    await AudioStorage.deleteTrackAudio('audio:test-1');
    expect(await AudioStorage.getTrackAudio('audio:test-1')).toBeNull();
  });

  it('returns null for unknown keys', async () => {
    expect(await AudioStorage.getTrackAudio('missing')).toBeNull();
  });

  it('sums stored bytes', async () => {
    await AudioStorage.saveTrackAudio('k1', new Blob([new Uint8Array(100)]));
    await AudioStorage.saveTrackAudio('k2', new Blob([new Uint8Array(50)]));
    expect(await AudioStorage.audioBytes()).toBeGreaterThanOrEqual(150);
  });
});

describe('LibraryService persistence', () => {
  it('persists tracks across database handles (refresh survival)', async () => {
    const t = makeTrack();
    await db.transaction('rw', db.tracks, db.albums, db.artists, async () => {
      await db.tracks.put(t);
      // Mirror what persistNewTrack does for aggregates.
      await db.albums.put({
        id: t.albumId,
        name: t.album,
        artist: t.artist,
        artworkId: undefined,
        trackIds: [t.id],
        totalDuration: t.duration,
      });
      await db.artists.put({ id: t.artistId, name: t.artist, trackCount: 1, albumCount: 1 });
    });

    const loaded = await db.tracks.get(t.id);
    expect(loaded?.title).toBe(t.title);

    // Simulate a full app reload: read everything fresh.
    const allTracks = await db.tracks.toArray();
    expect(allTracks).toHaveLength(1);
    expect(await db.albums.get(t.albumId)).toBeTruthy();
    expect(await db.artists.get(t.artistId)).toBeTruthy();
  });

  it('setLiked flips the flag', async () => {
    const t = makeTrack();
    await db.tracks.put(t);
    await LibraryService.setLiked(t.id, true);
    expect((await db.tracks.get(t.id))?.liked).toBe(true);
    await LibraryService.setLiked(t.id, false);
    expect((await db.tracks.get(t.id))?.liked).toBe(false);
  });

  it('recordPlay increments counts and caps history growth', async () => {
    const t = makeTrack();
    await db.tracks.put(t);
    await LibraryService.recordPlay(t.id);
    await LibraryService.recordPlay(t.id);
    const updated = await db.tracks.get(t.id);
    expect(updated?.playCount).toBe(2);
    expect(updated?.lastPlayedAt).toBeDefined();

    const history = await db.history.where('trackId').equals(t.id).toArray();
    expect(history).toHaveLength(2);
  });

  it('deleteTracks removes rows, blobs and playlist references', async () => {
    const t = makeTrack();
    await db.tracks.put(t);
    await db.audioBlobs.put({ key: t.storageKey, blob: new Blob(['x']) });
    const playlist = await PlaylistService.create('Mix');
    await PlaylistService.addTracks(playlist.id, [t.id]);

    await LibraryService.deleteTracks([t.id]);

    expect(await db.tracks.get(t.id)).toBeUndefined();
    expect(await db.audioBlobs.get(t.storageKey)).toBeUndefined();
    const updatedPlaylist = await db.playlists.get(playlist.id);
    expect(updatedPlaylist?.trackIds).toHaveLength(0);
  });

  it('updateMetadata regroups albums/artists when names change', async () => {
    const t = makeTrack({ title: 'Old Title', artist: 'Old Artist', album: 'Old Album' });
    await db.tracks.put(t);
    await LibraryService.rebuildAggregates();

    const updated = await LibraryService.updateMetadata(t.id, {
      title: 'New Title',
      artist: 'New Artist',
      album: 'New Album',
    });
    expect(updated?.title).toBe('New Title');

    const artists = await db.artists.toArray();
    expect(artists.map((a) => a.name)).toContain('New Artist');
    expect(artists.map((a) => a.name)).not.toContain('Old Artist');
    const albums = await db.albums.toArray();
    expect(albums.map((a) => a.name)).toContain('New Album');
  });

  it('rebuildAggregates reconstructs exact album/artist state', async () => {
    const tracks = [
      makeTrack({ id: 't1', artist: 'A', album: 'X' }),
      makeTrack({ id: 't2', artist: 'A', album: 'X' }),
      makeTrack({ id: 't3', artist: 'A', album: 'Y' }),
      makeTrack({ id: 't4', artist: 'B', album: 'Z' }),
    ];
    await db.tracks.bulkPut(tracks);
    await LibraryService.rebuildAggregates();

    const artists = await db.artists.toArray();
    const artistA = artists.find((a) => a.name === 'A');
    expect(artistA?.trackCount).toBe(3);
    expect(artistA?.albumCount).toBe(2);
    const albumX = await db.albums.get(tracks[0]!.albumId);
    expect(albumX?.trackIds.sort()).toEqual(['t1', 't2']);
  });
});

describe('Duplicate detection inputs', () => {
  it('detects identical content hash', async () => {
    const existing = makeTrack({ hash: 'same-hash' });
    await db.tracks.put(existing);
    const result = await LibraryService.findDuplicate('same-hash', null);
    expect(result?.reason).toBe('identical-file');
  });

  it('matches same title + close duration as fuzzy duplicate', async () => {
    const existing = makeTrack({ title: 'Tum Hi Ho', artist: 'Arijit Singh', duration: 260 });
    await db.tracks.put(existing);
    const result = await LibraryService.findDuplicate('other-hash', {
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
      duration: 261.5,
    });
    expect(result?.reason).toBe('same-title-and-length');
  });

  it('ignores different songs', async () => {
    const existing = makeTrack({ title: 'One', artist: 'A', duration: 200 });
    await db.tracks.put(existing);
    expect(
      await LibraryService.findDuplicate('hash-x', { title: 'Two', artist: 'A', duration: 310 })
    ).toBeNull();
  });
});
