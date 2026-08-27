import type { Album, Artist, Track } from '@/types';
import { db, SETTINGS_KEYS } from '@/db/database';
import { AudioStorage } from '@/services/storage/AudioStorage';
import { saveArtwork } from '@/services/storage/ArtworkStorage';
import {
  detectFormat,
  guessMime,
  isLossless,
  looksLikeAudio,
  probeDuration,
  readTags,
} from './MetadataService';
import { opusEncoderSupported, transcodeToOpus } from '@/services/audio/Transcoder';
import { createId } from '@/utils/id';
import { hashBlob } from '@/utils/hash';
import { groupKey, sanitizeText } from '@/utils/text';
import { albumIdOf, artistIdOf, genreKeyOf } from '@/utils/grouping';
import { AppError } from '@/utils/errors';
import { yieldToMain } from '@/utils/misc';

export interface ImportProgress {
  completed: number;
  total: number;
  currentFile: string;
}

export interface DuplicateCandidate {
  incomingTitle: string;
  incomingArtist: string;
  existing: Track;
  reason: 'identical-file' | 'same-title-and-length';
}

export interface ImportOptions {
  onProgress?: (progress: ImportProgress) => void;
  /** Called when a probable duplicate is found; resolves the user's choice. */
  onDuplicate?: (candidate: DuplicateCandidate) => Promise<'keep' | 'skip'>;
  signal?: AbortSignal;
}

export interface FailedImport {
  filename: string;
  reason: string;
}

export interface ImportSummary {
  added: Track[];
  skipped: number;
  failed: FailedImport[];
}

export type DefaultSort =
  | 'dateAdded-desc'
  | 'dateAdded-asc'
  | 'title-asc'
  | 'artist-asc'
  | 'playCount-desc';

export class LibraryServiceClass {
  async getTrack(id: string): Promise<Track | undefined> {
    return db.tracks.get(id);
  }

  /**
   * Add an in-memory audio blob (from the downloader) through the same
   * pipeline as file imports: hash → dedupe → tags → artwork → persist.
   * Returns the created track, or null when it was skipped as a duplicate.
   */
  async addFromBlob(
    blob: Blob,
    info: {
      filename: string;
      title?: string;
      artist?: string;
      source: Track['source'];
      sourceUrl?: string;
      thumbnailUrl?: string;
      onDuplicate?: ImportOptions['onDuplicate'];
    }
  ): Promise<Track | null> {
    const hash = await hashBlob(blob);
    const duplicate = await this.findDuplicate(hash, null);
    if (duplicate) {
      if (!info.onDuplicate) return null;
      const choice = await info.onDuplicate({
        incomingTitle: info.title ?? info.filename,
        incomingArtist: info.artist ?? '',
        existing: duplicate.existing,
        reason: duplicate.reason,
      });
      if (choice === 'skip') return null;
    }

    const { metadata, picture } = await readTags(blob, info.filename);
    if (info.title) metadata.title = sanitizeText(info.title) || metadata.title;
    if (info.artist) metadata.artist = sanitizeText(info.artist) || metadata.artist;

    let artworkId: string | undefined;
    if (picture) {
      artworkId = (await saveArtwork(picture)) ?? undefined;
    } else if (info.thumbnailUrl) {
      try {
        const resp = await fetch(info.thumbnailUrl, { signal: AbortSignal.timeout(10000) });
        if (resp.ok) {
          const blob = await resp.blob();
          artworkId = (await saveArtwork(blob)) ?? undefined;
        }
      } catch {
        // thumbnail fetch failed — non-fatal
      }
    }

    const format = detectFormat({ filename: info.filename, mimeType: blob.type });
    const duration = metadata.duration ?? (await probeDuration(blob, blob.type)) ?? 0;

    const track = this.buildTrack({
      id: createId(),
      metadata,
      duration,
      format,
      mimeType: blob.type || guessMime(format),
      fileSize: blob.size,
      artworkId,
      bitrateKbps: metadata.bitrateKbps,
      source: info.source,
      sourceUrl: info.sourceUrl,
      originalFilename: info.filename,
      hash,
    });
    await AudioStorage.saveTrackAudio(track.storageKey, blob);
    await this.persistNewTrack(track);
    return track;
  }

  async getAllTracks(): Promise<Track[]> {
    return db.tracks.toArray();
  }

  /**
   * Full local-import pipeline:
   * validate → hash/dedupe → parse tags → extract artwork → optionally
   * transcode lossless sources to Opus → persist blob + row → update indexes.
   */
  async importFiles(files: File[], options: ImportOptions = {}): Promise<ImportSummary> {
    const summary: ImportSummary = { added: [], skipped: 0, failed: [] };
    const total = files.length;

    const transcodeSetting = await this.getSetting<boolean>(SETTINGS_KEYS.AUTO_TRANSCODE_LOSSLESS, true);
    const quality = await this.getSetting<'high'|'balanced'|'saver'>(SETTINGS_KEYS.AUDIO_QUALITY, 'balanced');
    let losslessTranscodingAvailable = false;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (!file) continue;
      options.signal?.throwIfAborted();
      options.onProgress?.({ completed: index, total, currentFile: file.name });

      try {
        if (!looksLikeAudio(file)) {
          summary.failed.push({ filename: file.name, reason: 'Unsupported file type' });
          continue;
        }
        await yieldToMain();

        const hash = await hashBlob(file);
        let keepSeparate = false;
        const duplicate = await this.findDuplicate(hash, null);
        if (duplicate) {
          if (options.onDuplicate) {
            const choice = await options.onDuplicate({
              incomingTitle: sanitizeText(file.name),
              incomingArtist: '',
              existing: duplicate.existing,
              reason: duplicate.reason,
            });
            if (choice === 'skip') {
              summary.skipped++;
              continue;
            }
            keepSeparate = true;
          } else {
            summary.skipped++;
            continue;
          }
        }

        const { metadata, picture } = await readTags(file, file.name);
        await yieldToMain();

        let artworkId: string | undefined;
        if (picture) artworkId = (await saveArtwork(picture)) ?? undefined;

        // Format detection before any conversion.
        let format = detectFormat({
          filename: file.name,
          mimeType: file.type,
          container: undefined,
          codec: undefined,
        });
        let blob: Blob = file;
        let mimeType = file.type || guessMime(format);
        let bitrateKbps = metadata.bitrateKbps;

        const shouldConvert = transcodeSetting && isLossless(format);
        if (shouldConvert) {
          if (!losslessTranscodingAvailable) {
            losslessTranscodingAvailable = await opusEncoderSupported();
          }
          if (losslessTranscodingAvailable) {
            options.onProgress?.({ completed: index, total, currentFile: `${file.name} — converting…` });
            try {
              const result = await transcodeToOpus(file, quality, { signal: options.signal });
              blob = result.blob;
              format = result.format;
              mimeType = result.mimeType;
              bitrateKbps = result.bitrateKbps;
            } catch (err) {
              if (err instanceof AppError && err.code === 'cancelled') throw err;
              console.warn('[LibraryService] transcoding failed, keeping original:', err);
              // Deliberate fallback: the original file is always safe.
            }
          }
        }

        const duration =
          metadata.duration ?? (await probeDuration(blob, mimeType)) ?? 0;

        const track = this.buildTrack({
          id: keepSeparate ? createId() : createId(),
          metadata,
          duration,
          format,
          mimeType,
          fileSize: blob.size,
          artworkId,
          bitrateKbps,
          source: 'local',
          originalFilename: file.name,
          hash,
        });

        await AudioStorage.saveTrackAudio(track.storageKey, blob);
        await this.persistNewTrack(track);
        summary.added.push(track);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') break;
        console.error('[LibraryService] import failed for', file.name, err);
        const reason = err instanceof AppError ? err.message : 'Could not read this file';
        summary.failed.push({ filename: file.name, reason });
      }
    }
    options.onProgress?.({ completed: total, total, currentFile: '' });
    return summary;
  }

  private buildTrack(input: {
    id: string;
    metadata: Awaited<ReturnType<typeof readTags>>['metadata'];
    duration: number;
    format: string;
    mimeType: string;
    fileSize: number;
    artworkId?: string;
    bitrateKbps?: number;
    source: Track['source'];
    sourceUrl?: string;
    originalFilename?: string;
    hash: string;
  }): Track {
    const album = input.metadata.album || 'Unknown Album';
    const artist = input.metadata.artist || 'Unknown Artist';
    const albumArtist = input.metadata.albumArtist || artist;
    return {
      id: input.id,
      title: input.metadata.title || input.originalFilename || 'Unknown Title',
      artist,
      artistId: artistIdOf(artist),
      album,
      albumId: albumIdOf(albumArtist, album),
      albumArtist: input.metadata.albumArtist,
      genre: input.metadata.genre,
      year: input.metadata.year,
      trackNumber: input.metadata.trackNumber,
      duration: Math.max(0, input.duration),
      format: input.format,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      artworkId: input.artworkId,
      source: input.source,
      sourceUrl: input.sourceUrl,
      originalFilename: input.originalFilename,
      dateAdded: Date.now(),
      playCount: 0,
      liked: false,
      storageKey: `audio:${input.id}`,
      hash: input.hash,
      bitrateKbps: input.bitrateKbps,
      sampleRateHz: input.metadata.sampleRateHz,
    };
  }

  async findDuplicate(
    hash: string,
    candidate: { title: string; artist: string; duration: number } | null
  ): Promise<{ existing: Track; reason: DuplicateCandidate['reason'] } | null> {
    const byHash = await db.tracks.where('hash').equals(hash).first();
    if (byHash) return { existing: byHash, reason: 'identical-file' };
    if (candidate) {
      const sameArtist = await db.tracks.where('artistId').equals(artistIdOf(candidate.artist)).toArray();
      const match = sameArtist.find(
        (t) =>
          groupKey(t.title) === groupKey(candidate.title) &&
          t.duration > 0 &&
          candidate.duration > 0 &&
          Math.abs(t.duration - candidate.duration) <= 3
      );
      if (match) return { existing: match, reason: 'same-title-and-length' };
    }
    return null;
  }

  /** Persist a track and its aggregate rows atomically. */
  private async persistNewTrack(track: Track): Promise<void> {
    await db.transaction('rw', db.tracks, db.albums, db.artists, async () => {
      await db.tracks.put(track);
      await this.upsertAlbum(track);
      await this.upsertArtist(track);
    });
  }

  private async upsertAlbum(track: Track): Promise<void> {
    const album = await db.albums.get(track.albumId);
    if (album) {
      if (!album.trackIds.includes(track.id)) album.trackIds.push(track.id);
      album.artworkId = album.artworkId ?? track.artworkId;
      album.year = album.year ?? track.year;
      album.genre = album.genre ?? track.genre;
      album.totalDuration += track.duration;
      await db.albums.put(album);
    } else {
      await db.albums.put({
        id: track.albumId,
        name: track.album,
        artist: track.albumArtist || track.artist,
        year: track.year,
        genre: track.genre,
        artworkId: track.artworkId,
        trackIds: [track.id],
        totalDuration: track.duration,
      });
    }
  }

  private async upsertArtist(track: Track): Promise<void> {
    const artist = await db.artists.get(track.artistId);
    if (artist) {
      artist.trackCount += 1;
      artist.artworkId = artist.artworkId ?? track.artworkId;
      await db.artists.put(artist);
    } else {
      await db.artists.put({
        id: track.artistId,
        name: track.artist,
        artworkId: track.artworkId,
        trackCount: 1,
        albumCount: 0,
      });
    }
    await this.refreshArtistAlbumCounts(track.artistId);
  }

  private async refreshArtistAlbumCounts(artistId: string): Promise<void> {
    const [artist, artistTracks] = await Promise.all([
      db.artists.get(artistId),
      db.tracks.where('artistId').equals(artistId).toArray(),
    ]);
    if (!artist) return;
    artist.albumCount = new Set(artistTracks.map((t) => t.albumId)).size;
    await db.artists.put(artist);
  }

  async setLiked(trackId: string, liked: boolean): Promise<void> {
    await db.tracks.update(trackId, { liked });
  }

  async toggleLiked(trackId: string): Promise<boolean> {
    const track = await db.tracks.get(trackId);
    if (!track) return false;
    const liked = !track.liked;
    await this.setLiked(trackId, liked);
    return liked;
  }

  /** User-editable metadata fields only. */
  async updateMetadata(
    trackId: string,
    patch: Partial<Pick<Track, 'title' | 'artist' | 'album' | 'albumArtist' | 'genre' | 'year'>> & {
      artworkBlob?: Blob;
    }
  ): Promise<Track | undefined> {
    const track = await db.tracks.get(trackId);
    if (!track) return undefined;

    let artworkId = track.artworkId;
    if (patch.artworkBlob) {
      artworkId = (await saveArtwork(patch.artworkBlob)) ?? artworkId;
    }

    const next: Track = {
      ...track,
      title: sanitizeText(patch.title ?? track.title, 300) || track.title,
      artist: sanitizeText(patch.artist ?? track.artist, 200) || track.artist,
      album: sanitizeText(patch.album ?? track.album, 200) || track.album,
      albumArtist: patch.albumArtist !== undefined ? sanitizeText(patch.albumArtist, 200) : track.albumArtist,
      genre: patch.genre !== undefined ? sanitizeText(patch.genre, 80) : track.genre,
      year: patch.year !== undefined ? clampYear(patch.year) : track.year,
      artworkId,
    };

    const oldAlbumId = track.albumId;
    const oldArtistId = track.artistId;
    next.artistId = artistIdOf(next.artist);
    next.albumId = albumIdOf(next.albumArtist || next.artist, next.album);

    await db.transaction('rw', db.tracks, db.albums, db.artists, async () => {
      await db.tracks.put(next);
      if (oldAlbumId !== next.albumId) {
        await removeFromAlbum(oldAlbumId, track.id);
        await this.upsertAlbum(next);
      }
      if (oldArtistId !== next.artistId) {
        await removeFromArtist(oldArtistId, track.id);
        await this.upsertArtist(next);
      }
      if (oldAlbumId !== next.albumId || oldArtistId !== next.artistId) {
        await LibraryService.rebuildAggregates();
      }
    });
    return next;
  }

  async deleteTracks(trackIds: string[]): Promise<void> {
    for (const id of trackIds) {
      const track = await db.tracks.get(id);
      if (!track) continue;
      await db.transaction('rw', db.tracks, db.albums, db.artists, db.playlists, db.history, async () => {
        await db.tracks.delete(id);
        await removeFromAlbum(track.albumId, id);
        await removeFromArtist(track.artistId, id);
        // Strip from playlists.
        const playlists = await db.playlists.toArray();
        for (const playlist of playlists) {
          if (playlist.trackIds.includes(id)) {
            await db.playlists.update(playlist.id, {
              trackIds: playlist.trackIds.filter((t) => t !== id),
              updatedAt: Date.now(),
            });
          }
        }
        await db.history.where('trackId').equals(id).delete();
      });
      await AudioStorage.deleteTrackAudio(track.storageKey).catch(() => undefined);
    }
  }

  /**
   * Rebuild album/artist tables from scratch. Used after bulk structural
   * edits; O(n) over tracks.
   */
  async rebuildAggregates(): Promise<void> {
    const tracks = await db.tracks.toArray();
    const albums = new Map<string, Album>();
    const artists = new Map<string, Artist>();

    for (const track of tracks) {
      let album = albums.get(track.albumId);
      if (!album) {
        album = {
          id: track.albumId,
          name: track.album,
          artist: track.albumArtist || track.artist,
          year: track.year,
          genre: track.genre,
          artworkId: track.artworkId,
          trackIds: [],
          totalDuration: 0,
        };
        albums.set(album.id, album);
      }
      album.trackIds.push(track.id);
      album.totalDuration += track.duration;
      album.artworkId = album.artworkId ?? track.artworkId;
      album.year = album.year ?? track.year;

      let artist = artists.get(track.artistId);
      if (!artist) {
        artist = { id: track.artistId, name: track.artist, artworkId: track.artworkId, trackCount: 0, albumCount: 0 };
        artists.set(artist.id, artist);
      }
      artist.trackCount += 1;
      artist.artworkId = artist.artworkId ?? track.artworkId;
    }

    const albumArtistIds = new Map<string, string>();
    for (const track of tracks) {
      if (!albumArtistIds.has(track.albumId)) albumArtistIds.set(track.albumId, track.artistId);
    }
    for (const album of albums.values()) {
      const owner = albumArtistIds.get(album.id);
      const ownerArtist = owner !== undefined ? artists.get(owner) : undefined;
      if (ownerArtist) ownerArtist.albumCount += 1;
    }

    await db.transaction('rw', db.albums, db.artists, async () => {
      await db.albums.clear();
      await db.artists.clear();
      await db.albums.bulkPut([...albums.values()]);
      await db.artists.bulkPut([...artists.values()]);
    });
  }

  async recordPlay(trackId: string, playedAt = Date.now()): Promise<void> {
    const track = await db.tracks.get(trackId);
    if (!track) return;
    await db.tracks.update(trackId, {
      playCount: track.playCount + 1,
      lastPlayedAt: playedAt,
    });
    await db.history.add({ trackId, playedAt });
    const count = await db.history.count();
    if (count > HISTORY_LIMIT) {
      const overflow = count - HISTORY_LIMIT;
      const oldest = await db.history.orderBy('playedAt').limit(overflow).toArray();
      await db.history.bulkDelete(oldest.map((h) => h.id!).filter(Boolean));
    }
  }

  async getRecentlyPlayed(limit: number): Promise<Track[]> {
    const entries = await db.history.orderBy('playedAt').reverse().limit(limit * 4).toArray();
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const entry of entries) {
      if (!seen.has(entry.trackId)) {
        seen.add(entry.trackId);
        ids.push(entry.trackId);
        if (ids.length >= limit) break;
      }
    }
    const tracks = await db.tracks.bulkGet(ids);
    return compact(tracks);
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const record = await db.settings.get(key);
    return (record?.value as T | undefined) ?? fallback;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value });
  }

  /** Export the stored audio back out of the app ("Download" in menus). */
  async exportTrack(track: Track): Promise<void> {
    const blob = await AudioStorage.getTrackAudio(track.storageKey);
    if (!blob) throw new AppError('Audio data missing', 'not-found');
    const safeName = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]/g, '_');
    const ext = track.format === 'opus' ? 'opus' : track.format;
    triggerDownload(new File([blob], `${safeName}.${ext}`, { type: track.mimeType }));
  }
}

const HISTORY_LIMIT = 3000;

function compact<T>(items: (T | undefined)[]): T[] {
  return items.filter((item): item is T => item !== undefined);
}

export function triggerDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function removeFromAlbum(albumId: string, trackId: string): Promise<void> {
  const album = await db.albums.get(albumId);
  if (!album) return;
  album.trackIds = album.trackIds.filter((id) => id !== trackId);
  album.totalDuration = Math.max(0, album.totalDuration);
  if (album.trackIds.length === 0) await db.albums.delete(albumId);
  else await db.albums.put(album);
}

async function removeFromArtist(artistId: string, _trackId: string): Promise<void> {
  const artist = await db.artists.get(artistId);
  if (!artist) return;
  artist.trackCount = Math.max(0, artist.trackCount - 1);
  if (artist.trackCount === 0) await db.artists.delete(artistId);
  else await db.artists.put(artist);
}

function clampYear(year: number): number | undefined {
  const n = Number(year);
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  if (rounded < 1000 || rounded > 2200) return undefined;
  return rounded;
}

export const LibraryService = new LibraryServiceClass();

// ---------------------------------------------------------------------------
// Genres are derived on demand rather than persisted.
export interface GenreGroup {
  key: string;
  label: string;
  trackCount: number;
  artworkId?: string;
  trackIds: string[];
}

export function groupTracksByGenre(tracks: Track[]): GenreGroup[] {
  const map = new Map<string, GenreGroup>();
  for (const track of tracks) {
    const label = track.genre?.trim() || 'Unknown Genre';
    const key = genreKeyOf(label);
    let group = map.get(key);
    if (!group) {
      group = { key, label, trackCount: 0, trackIds: [], artworkId: track.artworkId };
      map.set(key, group);
    }
    group.trackCount++;
    group.trackIds.push(track.id);
    group.artworkId = group.artworkId ?? track.artworkId;
  }
  return [...map.values()].sort(
    (a, b) => b.trackCount - a.trackCount || a.label.localeCompare(b.label)
  );
}
