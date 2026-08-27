import type { DownloadProgress, TrackMetadata } from '@/types';
import type { DownloadedAudio, MusicDownloader } from './MusicDownloader';
import { AppError } from '@/utils/errors';
import { sanitizeText, sanitizeUrl } from '@/utils/text';
import { db } from '@/db/database';

/**
 * Built-in extractor server. Replace with your own Render/Fly.io URL after
 * deployment. Users can also override this in Settings → YouTube Server.
 */
const DEFAULT_SERVER = 'https://localify-extractor.onrender.com';

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!YT_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    if (parsed.hostname.toLowerCase().includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return isVideoId(id) ? id : null;
    }
    const vParam = parsed.searchParams.get('v');
    if (vParam && isVideoId(vParam)) return vParam;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const marker = segments.findIndex((s) => ['shorts', 'embed', 'live', 'v'].includes(s));
    if (marker !== -1 && segments[marker + 1] && isVideoId(segments[marker + 1]!)) {
      return segments[marker + 1]!;
    }
    return null;
  } catch {
    return null;
  }
}

function isVideoId(value: string | undefined): value is string {
  return !!value && /^[a-zA-Z0-9_-]{11}$/.test(value);
}

async function getServerUrl(): Promise<string> {
  try {
    const row = await db.settings.get('yt-server-url');
    if (row?.value && typeof row.value === 'string') return row.value;
  } catch {
    // ignore
  }
  return DEFAULT_SERVER;
}

export interface YouTubeMetadata extends TrackMetadata {
  serverAvailable?: boolean;
}

/**
 * YouTube downloader with server-side extraction support.
 *
 * If a local extractor server is configured (via Settings → YouTube Server),
 * metadata and audio are fetched through it. If no server is configured or
 * the server is unreachable, falls back to oEmbed metadata and a clear
 * explanation that audio extraction needs the server.
 */
export class YouTubeDownloader implements MusicDownloader {
  readonly id = 'youtube';
  readonly label = 'YouTube';

  canHandle(url: string): boolean {
    return extractYouTubeId(url) !== null;
  }

  async getMetadata(url: string): Promise<YouTubeMetadata> {
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new AppError('That does not look like a YouTube link', 'invalid-url');

    // Try the extractor server (richer metadata)
    const serverUrl = await getServerUrl();
    try {
      const response = await fetch(
        `${serverUrl}/metadata?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
        { signal: AbortSignal.timeout(8000) }
      );
        if (response.ok) {
          const data = (await response.json()) as {
            title?: string;
            artist?: string;
            duration?: number;
            thumbnail?: string;
            extractionAvailable?: boolean;
          };
          return {
            title: sanitizeText(data.title) || 'YouTube Video',
            artist: sanitizeText(data.artist) || undefined,
            duration: data.duration,
            thumbnailUrl: sanitizeUrl(data.thumbnail) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            serverAvailable: data.extractionAvailable ?? true,
          };
        }
    } catch {
      // Server unreachable — fall through to oEmbed
    }

    // Fallback: oEmbed (no audio extraction available)
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;

    const response = await fetch(endpoint).catch(() => null);
    if (response?.ok) {
      const data = (await response.json()) as {
        title?: unknown;
        author_name?: unknown;
        thumbnail_url?: unknown;
      };
      return {
        title: sanitizeText(data.title) || 'YouTube Video',
        artist: sanitizeText(data.author_name) || undefined,
        thumbnailUrl:
          sanitizeUrl(data.thumbnail_url) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        serverAvailable: false,
      };
    }
    return {
      title: `YouTube Video (${videoId})`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      serverAvailable: false,
    };
  }

  async download(
    url: string,
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<DownloadedAudio> {
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new AppError('That does not look like a YouTube link', 'invalid-url');

    const serverUrl = await getServerUrl();

    onProgress?.({ phase: 'downloading', progress: 0 });

    let response: Response;
    try {
      response = await fetch(
        `${serverUrl}/download?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=mp3&quality=192`,
        { signal }
      );
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new AppError(
        'Could not reach the extractor server. Make sure it is running and the URL is correct in Settings.',
        'network'
      );
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg = (body as { detail?: string }).detail ?? `Server error (${response.status})`;
      throw new AppError(msg, 'network');
    }

    const totalBytes = Number(response.headers.get('content-length') ?? 0);
    const title = response.headers.get('x-video-title') ?? 'YouTube Audio';
    const artist = response.headers.get('x-video-artist');
    const duration = Number(response.headers.get('x-video-duration') ?? 0);
    const thumbnail = response.headers.get('x-video-thumbnail');

    if (!response.body) {
      throw new AppError('Server returned an empty response', 'network');
    }

    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value as unknown as BlobPart);
        received += value.byteLength;
        onProgress?.({
          phase: 'downloading',
          progress: totalBytes > 0 ? Math.min(99, (received / totalBytes) * 100) : 50,
          receivedBytes: received,
          totalBytes: totalBytes || undefined,
        });
      }
    }

    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    onProgress?.({ phase: 'done', progress: 100 });

    return {
      blob,
      suggestedFilename: `${title}.mp3`,
      sourceUrl: url,
      metadata: {
        title: sanitizeText(title) || 'YouTube Audio',
        artist: artist ? sanitizeText(artist) : undefined,
        duration: duration || undefined,
        thumbnailUrl: thumbnail || undefined,
        sourceUrl: url,
      },
    } satisfies DownloadedAudio;
  }
}
