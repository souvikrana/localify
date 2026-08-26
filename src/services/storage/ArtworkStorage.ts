import { db } from '@/db/database';
import { hashBlob } from '@/utils/hash';

export type ArtworkSize = 'thumb' | 'full';

const THUMB_EDGE = 320;
const FULL_MAX_EDGE = 1024;

/** Object-URL cache with a bounded entry count (LRU by insertion). */
const urlCache = new Map<string, string>();
const URL_CACHE_LIMIT = 500;

function cachePut(key: string, url: string): void {
  if (urlCache.size >= URL_CACHE_LIMIT) {
    const oldest = urlCache.keys().next().value as string | undefined;
    if (oldest !== undefined) {
      const stale = urlCache.get(oldest);
      if (stale) URL.revokeObjectURL(stale);
      urlCache.delete(oldest);
    }
  }
  urlCache.set(key, url);
}

export function artworkUrl(artworkId: string | undefined, size: ArtworkSize = 'thumb'): string | undefined {
  if (!artworkId) return undefined;
  const key = `${artworkId}:${size}`;
  const cached = urlCache.get(key);
  if (cached) {
    // refresh LRU position
    urlCache.delete(key);
    urlCache.set(key, cached);
    return cached;
  }
  return undefined;
}

/**
 * Resolve (and cache) an artwork object URL. Safe to call repeatedly.
 * Returns undefined when the artwork doesn't exist.
 */
export async function ensureArtworkUrl(artworkId: string | undefined, size: ArtworkSize = 'thumb'): Promise<string | undefined> {
  if (!artworkId) return undefined;
  const sync = artworkUrl(artworkId, size);
  if (sync) return sync;
  const record = await db.artworks.get(artworkId).catch(() => undefined);
  if (!record) return undefined;
  const key = `${artworkId}:${size}`;
  const existing = urlCache.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(size === 'full' ? record.full : record.thumb);
  cachePut(key, url);
  return url;
}

/** Synchronously available placeholder gradient hue for missing art. */
export { hueFromString } from '@/utils/misc';

/**
 * Store artwork: dedupe by content hash, generate a thumbnail so library
 * lists decode tiny images instead of full-resolution embedded covers.
 */
export async function saveArtwork(source: Blob): Promise<string | undefined> {
  try {
    const hash = await hashBlob(source);
    const existingId = `aw:${hash.slice(0, 32)}`;
    const existing = await db.artworks.get(existingId);
    if (existing) return existingId;

    const resized = await resizeImage(source, FULL_MAX_EDGE, 0.86);
    const thumb = await resizeImage(source, THUMB_EDGE, 0.82);
    await db.artworks.put({
      id: existingId,
      full: resized?.blob ?? source,
      thumb: thumb?.blob ?? resized?.blob ?? source,
      width: resized?.width ?? 0,
      height: resized?.height ?? 0,
    });
    return existingId;
  } catch (err) {
    console.warn('[ArtworkStorage] failed to store artwork', err);
    return undefined;
  }
}

interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

async function resizeImage(
  source: Blob,
  maxEdge: number,
  quality: number
): Promise<ResizedImage | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return undefined; // Browser can't decode this image — keep original bytes.
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    let blob: Blob | undefined;
    if ('OffscreenCanvas' in globalThis && typeof (globalThis as Record<string, unknown>).OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      }
    }
    if (!blob && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await canvasToBlob(canvas, quality);
    }
    if (!blob) return undefined;
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | undefined> {
  // JPEG: universally encodable/decodable across browsers (unlike webp encoding).
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? undefined), 'image/jpeg', quality);
  });
}

export async function deleteArtwork(artworkId: string): Promise<void> {
  for (const size of ['thumb', 'full'] as const) {
    const key = `${artworkId}:${size}`;
    const url = urlCache.get(key);
    if (url) URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
  await db.artworks.delete(artworkId);
}

/** Remove artworks no longer referenced by any track/playlist. */
export async function pruneOrphanArtworks(): Promise<number> {
  const [tracks, playlists] = await Promise.all([db.tracks.toArray(), db.playlists.toArray()]);
  const referenced = new Set<string>();
  for (const t of tracks) if (t.artworkId) referenced.add(t.artworkId);
  for (const p of playlists) if (p.artworkId) referenced.add(p.artworkId);

  const orphans: string[] = [];
  await db.artworks.each((record) => {
    if (!referenced.has(record.id)) orphans.push(record.id);
  });
  await db.artworks.bulkDelete(orphans);
  return orphans.length;
}
