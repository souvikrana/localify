import type { TrackMetadata } from '@/types';
import { sanitizeText } from '@/utils/text';
import { parseFilenameMetadata } from '@/utils/text';

/** Extensions we accept on import. */
export const SUPPORTED_EXTENSIONS = [
  'mp3', 'm4a', 'm4b', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus',
  'webm', 'weba', 'mp4', 'aif', 'aiff', 'wma',
];

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

export function looksLikeAudio(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  return SUPPORTED_EXTENSIONS.includes(extensionOf(file.name));
}

/** Human-facing format label derived from whatever hints we have. */
export function detectFormat(hints: {
  filename?: string;
  mimeType?: string;
  container?: string;
  codec?: string;
}): string {
  const ext = hints.filename ? extensionOf(hints.filename) : '';
  if (ext === 'm4a' || ext === 'm4b' || ext === 'mp4') {
    return /alac/i.test(hints.codec ?? '') ? 'alac' : 'aac';
  }
  if (ext === 'webm' || ext === 'weba') return /vorbis/i.test(hints.codec ?? '') ? 'ogg' : 'opus';
  const codec = (hints.codec ?? '').toLowerCase();
  if (codec.includes('opus')) return 'opus';
  if (codec.includes('flac')) return 'flac';
  if (codec.includes('mp3') || codec.includes('mpeg')) return 'mp3';
  if (codec.includes('aac')) return 'aac';
  if (codec.includes('pcm')) return 'wav';
  if (ext && SUPPORTED_EXTENSIONS.includes(ext)) return ext === 'aiff' || ext === 'aif' ? 'aiff' : ext;
  const container = (hints.container ?? '').toLowerCase();
  if (container.includes('mpeg')) return 'mp3';
  if (container.includes('iso.mp4') || container.includes('mp4')) return 'aac';
  if (container.includes('ogg')) return 'ogg';
  return ext || 'unknown';
}

const LOSSLESS = new Set(['wav', 'flac', 'aiff', 'alac']);
export function isLossless(format: string): boolean {
  return LOSSLESS.has(format);
}

const MIME_BY_FORMAT: Record<string, string> = {
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  aac: 'audio/mp4',
  m4a: 'audio/mp4',
  alac: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  aiff: 'audio/aiff',
};

export function guessMime(format: string): string {
  return MIME_BY_FORMAT[format] ?? 'audio/mpeg';
}

/** Minimal shape of music-metadata's parseBlob result we rely on. */
interface ParsedMedia {
  common?: {
    title?: string;
    artist?: string;
    artists?: string[];
    album?: string;
    albumartist?: string;
    genre?: string[];
    year?: number;
    track?: { no?: number | null };
    picture?: { format?: string; data: Uint8Array }[];
  };
  format?: {
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    container?: string;
    codec?: string;
  };
}

interface ParsedTags {
  metadata: Required<Pick<TrackMetadata, 'title' | 'artist' | 'album'>> &
    Pick<
      TrackMetadata,
      'thumbnailUrl'
    > & {
      albumArtist?: string;
      genre?: string;
      year?: number;
      trackNumber?: number;
      duration?: number;
      bitrateKbps?: number;
      sampleRateHz?: number;
    };
  picture?: Blob;
}

/**
 * Read embedded tags (ID3, Vorbis comments, MP4 atoms…) via music-metadata,
 * falling back to filename heuristics when tags are missing.
 */
export async function readTags(file: File | Blob, filename?: string): Promise<ParsedTags> {
  let parsed: ParsedMedia | null = null;
  try {
    const mm = await import('music-metadata');
    parsed = await mm.parseBlob(file, { duration: false, skipPostHeaders: true });
  } catch (err) {
    console.warn('[MetadataService] tag parsing failed:', err);
  }

  const name = filename ?? (file instanceof File ? file.name : 'audio');
  const fallback = parseFilenameMetadata(sanitizeText(name) || 'audio');
  const common = parsed?.common;

  const artist =
    sanitizeText(common?.artist ?? common?.artists?.[0]) ||
    sanitizeText(fallback.artist) ||
    '';
  const title = sanitizeText(common?.title) || sanitizeText(fallback.title) || stripExtension(name);

  const pictureBlob = extractPicture(parsed);
  const format = parsed?.format;

  return {
    metadata: {
      title,
      artist: artist || 'Unknown Artist',
      album: sanitizeText(common?.album) || '',
      albumArtist: sanitizeText(common?.albumartist) || undefined,
      genre: sanitizeText(common?.genre?.[0], 80) || undefined,
      year: typeof common?.year === 'number' && common.year > 0 ? common.year : undefined,
      trackNumber: common?.track?.no ?? undefined,
      duration:
        typeof format?.duration === 'number' && Number.isFinite(format.duration)
          ? format.duration
          : undefined,
      bitrateKbps:
        typeof format?.bitrate === 'number' && Number.isFinite(format.bitrate)
          ? Math.round(format.bitrate / 1000)
          : undefined,
      sampleRateHz:
        typeof format?.sampleRate === 'number' ? format.sampleRate : undefined,
    },
    picture: pictureBlob,
  };
}

function extractPicture(parsed: ParsedMedia | null): Blob | undefined {
  const pic = parsed?.common?.picture?.[0];
  if (!pic) return undefined;
  try {
    const bytes = pic.data as Uint8Array;
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const mime = pic.format?.startsWith('image/') ? pic.format : 'image/jpeg';
    return new Blob([copy], { type: mime });
  } catch {
    return undefined;
  }
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/**
 * Determine real duration for files whose tags don't include it.
 * Uses an <audio> element metadata load — cheap, no full decode.
 */
export function probeDuration(blob: Blob, mimeTypeHint?: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(undefined);
    const url = URL.createObjectURL(blob);
    const el = document.createElement('audio');
    const cleanup = (value: number | undefined) => {
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
      resolve(value);
    };
    const timer = setTimeout(() => cleanup(undefined), 8000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = el.duration;
      cleanup(Number.isFinite(d) && d > 0 ? d : undefined);
    };
    el.onerror = () => {
      clearTimeout(timer);
      cleanup(undefined);
    };
    if (mimeTypeHint) {
      try {
        // Some browsers need a type hint for raw containers.
        el.srcObject = null;
      } catch {
        /* noop */
      }
    }
    el.src = url;
  });
}
