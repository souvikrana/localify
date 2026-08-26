import 'fake-indexeddb/auto';

// Ensure object-URL APIs exist (used by artwork/audio plumbing).
if (typeof URL !== 'undefined' && typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => undefined;
}

import type { Track } from '@/types';

let counter = 0;

/** Build a valid Track with sensible defaults, overridden by `patch`. */
export function makeTrack(patch: Partial<Track> = {}): Track {
  counter += 1;
  const artist = patch.artist ?? 'Test Artist';
  const album = patch.album ?? 'Test Album';
  const id = patch.id ?? `track-${counter}`;
  return {
    id,
    title: patch.title ?? `Song ${counter}`,
    artist,
    artistId: `ar:${artist.toLowerCase()}`,
    albumId: `al:${artist.toLowerCase()}||${album.toLowerCase()}`,
    album,
    duration: patch.duration ?? 180,
    format: patch.format ?? 'mp3',
    mimeType: patch.mimeType ?? 'audio/mpeg',
    fileSize: patch.fileSize ?? 4_000_000,
    source: patch.source ?? 'local',
    dateAdded: patch.dateAdded ?? Date.now() - counter * 1000,
    playCount: patch.playCount ?? 0,
    liked: patch.liked ?? false,
    storageKey: `audio:${id}`,
    hash: patch.hash ?? `hash-${counter}`,
    ...patch,
  };
}

/** Tiny valid WAV blob (44-byte header + PCM samples). */
export function makeWavBlob(samples: number[] = [0, 0]): Blob {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 44100, true);
  view.setUint32(28, 88200, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, s, true));
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Wipe every store between tests. */
export async function resetDB(): Promise<void> {
  await Promise.all([
    db.tracks.clear(),
    db.albums.clear(),
    db.artists.clear(),
    db.playlists.clear(),
    db.history.clear(),
    db.artworks.clear(),
    db.audioBlobs.clear(),
    db.settings.clear(),
  ]);
}

import { db } from '@/db/database';
