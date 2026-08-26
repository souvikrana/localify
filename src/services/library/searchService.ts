import type { Album, Artist, Playlist, Track } from '@/types';
import { groupKey } from '@/utils/text';

/**
 * Fully offline fuzzy search over in-memory library data.
 * No network, no API — instant at 10k+ track scale because it is a single
 * scored pass over plain strings.
 */

export interface LibrarySearchInput {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
}

export interface SearchResults {
  query: string;
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  isEmpty: boolean;
}

const FIELD_WEIGHTS = {
  title: 1,
  artist: 0.85,
  album: 0.7,
  albumArtist: 0.55,
  genre: 0.55,
  filename: 0.45,
} as const;

const SCORE_THRESHOLD = 0.28;
const MAX_PER_GROUP = 120;

/** Score a single text against the query: 0 (no match) … 1 (exact). */
export function scoreText(rawQuery: string, rawText: string): number {
  const query = groupKey(rawQuery);
  const text = groupKey(rawText);
  if (!query || !text) return 0;
  if (text === query) return 1;
  if (text.startsWith(query)) return 0.92;

  // Word-boundary prefix match ("arijit" → "Arijit Singh").
  const wordStart = text.search(new RegExp(`\\b${escapeRegExp(query.slice(0, 32))}`));
  if (wordStart !== -1) return 0.82 - Math.min(0.07, wordStart * 0.01);
  if (text.includes(query)) return 0.62;

  // Subsequence fallback ("arjt" → "Arijit") with a gap penalty.
  let ti = 0;
  let gaps = 0;
  let matched = 0;
  for (let qi = 0; qi < query.length && ti < text.length; qi++) {
    const foundAt = text.indexOf(query[qi]!, ti);
    if (foundAt === -1) break;
    gaps += foundAt - ti;
    ti = foundAt + 1;
    matched++;
  }
  if (matched === query.length) {
    const gapPenalty = Math.min(0.2, (gaps / text.length) * 0.35);
    return 0.42 - gapPenalty;
  }
  return 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bestFieldScore(query: string, fields: { weight: number; value?: string | undefined }[]): number {
  let best = 0;
  for (const field of fields) {
    if (!field.value) continue;
    const score = scoreText(query, field.value) * field.weight;
    if (score > best) best = score;
  }
  return best;
}

export function searchLibrary(query: string, data: LibrarySearchInput): SearchResults {
  const q = query.trim();
  if (!q) {
    return { query: q, tracks: [], artists: [], albums: [], playlists: [], isEmpty: true };
  }

  const scoredTracks: { track: Track; score: number }[] = [];
  for (const track of data.tracks) {
    const score = bestFieldScore(q, [
      { weight: FIELD_WEIGHTS.title, value: track.title },
      { weight: FIELD_WEIGHTS.artist, value: track.artist },
      { weight: FIELD_WEIGHTS.album, value: track.album },
      { weight: FIELD_WEIGHTS.albumArtist, value: track.albumArtist },
      { weight: FIELD_WEIGHTS.genre, value: track.genre },
      { weight: FIELD_WEIGHTS.filename, value: track.originalFilename },
    ]);
    if (score >= SCORE_THRESHOLD) scoredTracks.push({ track, score });
  }
  scoredTracks.sort(
    (a, b) =>
      b.score - a.score ||
      b.track.playCount - a.track.playCount ||
      b.track.dateAdded - a.track.dateAdded
  );

  const scoredArtists: { artist: Artist; score: number }[] = [];
  for (const artist of data.artists) {
    const score = scoreText(q, artist.name) * FIELD_WEIGHTS.artist;
    if (score >= SCORE_THRESHOLD) scoredArtists.push({ artist, score });
  }
  scoredArtists.sort((a, b) => b.score - a.score || b.artist.trackCount - a.artist.trackCount);

  const scoredAlbums: { album: Album; score: number }[] = [];
  for (const album of data.albums) {
    const score = bestFieldScore(q, [
      { weight: FIELD_WEIGHTS.title, value: album.name },
      { weight: FIELD_WEIGHTS.artist, value: album.artist },
    ]);
    if (score >= SCORE_THRESHOLD) scoredAlbums.push({ album, score });
  }
  scoredAlbums.sort((a, b) => b.score - a.score);

  const scoredPlaylists: { playlist: Playlist; score: number }[] = [];
  for (const playlist of data.playlists) {
    const score = bestFieldScore(q, [
      { weight: FIELD_WEIGHTS.title, value: playlist.name },
      { weight: FIELD_WEIGHTS.artist, value: playlist.description },
    ]);
    if (score >= SCORE_THRESHOLD) scoredPlaylists.push({ playlist, score });
  }
  scoredPlaylists.sort((a, b) => b.score - a.score);

  return {
    query: q,
    tracks: scoredTracks.slice(0, MAX_PER_GROUP).map((s) => s.track),
    artists: scoredArtists.slice(0, MAX_PER_GROUP).map((s) => s.artist),
    albums: scoredAlbums.slice(0, MAX_PER_GROUP).map((s) => s.album),
    playlists: scoredPlaylists.slice(0, MAX_PER_GROUP).map((s) => s.playlist),
    isEmpty:
      scoredTracks.length === 0 &&
      scoredArtists.length === 0 &&
      scoredAlbums.length === 0 &&
      scoredPlaylists.length === 0,
  };
}
