import { groupKey } from './text';

/** Deterministic ids used to aggregate tracks into albums/artists/genres. */
export function artistIdOf(name: string): string {
  const key = groupKey(name) || 'unknown artist';
  return `ar:${key}`;
}

export function albumIdOf(albumArtist: string, albumName: string): string {
  const key = `${groupKey(albumArtist)}||${groupKey(albumName)}`;
  return `al:${key}`;
}

export function genreKeyOf(genre: string | undefined): string {
  return groupKey(genre ?? '') || 'unknown genre';
}
