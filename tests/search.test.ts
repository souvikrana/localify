// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { searchLibrary, scoreText } from '@/services/library/searchService';
import { groupTracksByGenre } from '@/services/library/LibraryService';
import type { Track } from '@/types';

function track(patch: Partial<Track>): Track {
  return {
    id: patch.id ?? Math.random().toString(36).slice(2),
    title: 'Untitled',
    artist: 'Unknown Artist',
    artistId: 'ar:unknown artist',
    albumId: 'al:unknown||untitled',
    album: 'Unknown Album',
    duration: 200,
    format: 'mp3',
    mimeType: 'audio/mpeg',
    fileSize: 1000,
    source: 'local',
    dateAdded: Date.now(),
    playCount: 0,
    liked: false,
    storageKey: 'audio:x',
    hash: 'h',
    ...patch,
  };
}

describe('scoreText', () => {
  it('scores exact matches highest', () => {
    expect(scoreText('tum hi ho', 'Tum Hi Ho')).toBe(1);
  });

  it('supports prefixes and word starts', () => {
    const exact = scoreText('arijit', 'arijit singh');
    const wordStart = scoreText('singh', 'Arijit Singh');
    expect(exact).toBeGreaterThan(0.9);
    expect(wordStart).toBeGreaterThan(0.7);
  });

  it('matches diacritic/case-insensitively', () => {
    expect(scoreText('beyonce', 'Beyoncé')).toBeGreaterThan(0.9);
  });

  it('falls back to fuzzy subsequence', () => {
    expect(scoreText('arjt', 'Arijit')).toBeGreaterThan(0.2);
    expect(scoreText('zzz', 'Arijit')).toBe(0);
  });
});

describe('searchLibrary', () => {
  const tracks = [
    track({ title: 'Tum Hi Ho', artist: 'Arijit Singh', album: 'Aashiqui 2', genre: 'Bollywood' }),
    track({ title: 'Kesariya', artist: 'Arijit Singh', album: 'Brahmastra' }),
    track({ title: 'Blinding Lights', artist: 'The Weeknd', originalFilename: 'blinding_lights.mp3' }),
  ];

  it('finds songs by artist across albums', () => {
    const results = searchLibrary('arijit', { tracks, artists: [], albums: [], playlists: [] });
    expect(results.tracks).toHaveLength(2);
    expect(results.isEmpty).toBe(false);
  });

  it('matches filenames with a lower weight than titles', () => {
    const results = searchLibrary('blinding', { tracks, artists: [], albums: [], playlists: [] });
    expect(results.tracks[0]?.title).toBe('Blinding Lights');
  });

  it('returns empty groups for nonsense queries', () => {
    const results = searchLibrary('qwertyuiop', { tracks, artists: [], albums: [], playlists: [] });
    expect(results.isEmpty).toBe(true);
  });

  it('ranks title matches above filename matches', () => {
    const results = searchLibrary('lights', { tracks, artists: [], albums: [], playlists: [] });
    expect(results.tracks[0]?.title).toBe('Blinding Lights');
  });
});

describe('groupTracksByGenre', () => {
  it('groups by normalized key and labels unknowns', () => {
    const grouped = groupTracksByGenre([
      track({ id: '1', genre: 'Rock' }),
      track({ id: '2', genre: 'rock ' }),
      track({ id: '3' }),
      track({ id: '4', genre: '' }),
    ]);
    expect(grouped).toHaveLength(2);
    const rock = grouped.find((g) => g.label === 'Rock');
    const unknown = grouped.find((g) => g.label === 'Unknown Genre');
    expect(rock?.trackCount).toBe(2);
    expect(unknown?.trackCount).toBe(2);
  });
});
