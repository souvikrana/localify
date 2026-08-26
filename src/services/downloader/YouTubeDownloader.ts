import type { DownloadProgress, TrackMetadata } from '@/types';
import { AppError } from '@/utils/errors';
import { sanitizeText, sanitizeUrl } from '@/utils/text';
import type { MusicDownloader } from './MusicDownloader';

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
    // /shorts/<id>, /embed/<id>, /live/<id>
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

/**
 * YouTube support in a purely local app — the honest version.
 *
 * Metadata (title/author/thumbnail) resolves client-side through YouTube's
 * public oEmbed endpoint, which permits cross-origin requests. The actual
 * audio stream cannot be fetched by a browser page: googlevideo.com URLs are
 * CORS-restricted and their signatures are generated for YouTube's own web
 * player. Working around that requires a server-side extractor, which this
 * application intentionally does not have.
 *
 * download() therefore fails with a clear, actionable explanation instead of
 * pretending. The interface stays identical to working providers, so a legal,
 * user-authorized extraction backend can be plugged in later without UI
 * changes.
 */
export class YouTubeDownloader implements MusicDownloader {
  readonly id = 'youtube';
  readonly label = 'YouTube';

  canHandle(url: string): boolean {
    return extractYouTubeId(url) !== null;
  }

  async getMetadata(url: string): Promise<TrackMetadata> {
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new AppError('That does not look like a YouTube link', 'invalid-url');

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
      const thumbnailUrl = sanitizeUrl(data.thumbnail_url) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      return {
        title: sanitizeText(data.title) || 'YouTube Video',
        artist: sanitizeText(data.author_name) || undefined,
        thumbnailUrl,
      };
    }
    // Offline or oEmbed unavailable: still show a minimal preview.
    return {
      title: `YouTube Video (${videoId})`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  async download(
    _url: string,
    _onProgress?: (progress: DownloadProgress) => void,
    _signal?: AbortSignal
  ): Promise<never> {
    throw new AppError(
      'YouTube audio cannot be downloaded directly by a browser app',
      'unsupported-format'
    );
  }
}
