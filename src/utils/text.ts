const WHITESPACE_RE = /\s+/g;

/** Collapse whitespace and trim. */
export function normalizeText(value: string | undefined | null): string {
  return (value ?? '').replace(WHITESPACE_RE, ' ').trim();
}

/** Case/diacritic-insensitive key used for grouping artists, albums, genres. */
export function groupKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}

/**
 * Remove control characters and trim length. Imported metadata is untrusted
 * input — this is applied before anything is stored or rendered.
 */
export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return normalizeText(
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .slice(0, maxLength)
  );
}

export function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const NOISE_WORDS =
  /\b(official|video|audio|lyrics?|hd|4k|mv|visualizer|full\s+album\s+stream)\b/gi;

/** Strip common YouTube noise words from titles when guessing artist/title. */
export function cleanTitle(raw: string): string {
  let out = raw.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  out = out.replace(NOISE_WORDS, ' ');
  return normalizeText(out.replace(/\s*[-–—|]\s*/g, ' ')) || normalizeText(raw);
}

/**
 * Guess "Artist - Title" from a filename like "01 - Arijit Singh - Tum Hi Ho.mp3".
 */
export function parseFilenameMetadata(filename: string): { title: string; artist?: string } {
  const base = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  const parts = base.split(/\s[-–—]\s/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts.map((p) => /^\d{1,3}$/.test(p) ? null : p).filter((p): p is string => !!p);
    if (candidate.length >= 2) {
      return { artist: candidate[0], title: candidate.slice(1).join(' - ') };
    }
  }
  return { title: parts.join(' ') || base };
}

export function initialsOf(value: string): string {
  const words = value.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}
