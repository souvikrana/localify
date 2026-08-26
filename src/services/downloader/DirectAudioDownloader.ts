import type { DownloadProgress, TrackMetadata } from '@/types';
import { AppError } from '@/utils/errors';
import { sanitizeText } from '@/utils/text';
import type { DownloadedAudio, MusicDownloader } from './MusicDownloader';

const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm|weba|m4b)(\?.*)?$/i;

/**
 * Downloads any directly reachable, CORS-enabled audio file — podcasts,
 * archive.org items, personal servers, S3 buckets. This is the downloader
 * that genuinely works with zero backend infrastructure.
 */
export class DirectAudioDownloader implements MusicDownloader {
  readonly id = 'direct';
  readonly label = 'Direct audio link';

  canHandle(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  async getMetadata(url: string): Promise<TrackMetadata> {
    const parsed = this.parseUrl(url);
    // A ranged GET avoids downloading whole files just to show a preview.
    const response = await fetch(url, { headers: { Range: 'bytes=0-0' } }).catch(() => null);
    if (!response) throw new AppError('Could not reach that link', 'network');
    const contentType = response.headers.get('content-type') ?? '';
    if (
      response.ok &&
      contentType &&
      !contentType.startsWith('audio/') &&
      !AUDIO_EXTENSIONS.test(url)
    ) {
      // Not conclusive (many servers omit audio types), so only warn via title.
      console.info('[DirectAudioDownloader] content-type:', contentType);
    }
    return {
      title: sanitizeText(parsed.filename.replace(AUDIO_EXTENSIONS, '')) || parsed.filename,
      artist: parsed.hostname,
    };
  }

  async download(
    url: string,
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<DownloadedAudio> {
    const response = await fetch(url, { signal }).catch((err) => {
      if (signal?.aborted) throw err;
      throw new AppError(
        'Could not reach that link. It may be offline or block cross-origin downloads (CORS).',
        'network'
      );
    });
    if (!response.ok) {
      throw new AppError(`The server responded with ${response.status}`, 'network');
    }

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0] ?? '';
    const declaredLength = Number(response.headers.get('content-length') ?? 0);

    onProgress?.({ phase: 'downloading', progress: 0 });

    let blob: Blob;
    if (response.body && typeof response.body.getReader === 'function') {
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
            progress: declaredLength > 0 ? Math.min(99, (received / declaredLength) * 100) : 50,
            receivedBytes: received,
            totalBytes: declaredLength || undefined,
          });
        }
      }
      blob = new Blob(chunks, { type: contentType || 'application/octet-stream' });
    } else {
      blob = await response.blob();
    }

    const plausible = await isPlausibleAudio(contentType, url, blob);
    if (!plausible) {
      throw new AppError(
        'That link did not return an audio file. Direct links to .mp3/.m4a/.flac/… work best.',
        'unsupported-format'
      );
    }

    const parsed = this.parseUrl(url);
    onProgress?.({ phase: 'done', progress: 100 });
    return {
      blob,
      suggestedFilename: parsed.filename,
      sourceUrl: url,
      metadata: {
        title: sanitizeText(parsed.filename.replace(AUDIO_EXTENSIONS, '')) || parsed.filename,
        artist: parsed.hostname,
        sourceUrl: url,
      },
    };
  }

  private parseUrl(url: string): { filename: string; hostname: string } {
    try {
      const parsed = new URL(url);
      const lastSegment = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '');
      return {
        filename: lastSegment || parsed.hostname,
        hostname: parsed.hostname,
      };
    } catch {
      throw new AppError('That link does not look right', 'invalid-url');
    }
  }
}

const AUDIO_MAGIC = [
  [0x49, 0x44, 0x33], // "ID3" (MP3)
  [0x66, 0x4c, 0x61, 0x43], // "fLaC"
  [0x4f, 0x67, 0x67, 0x53], // "OggS"
];

function isPlausibleAudio(contentType: string, url: string, blob: Blob): Promise<boolean> {
  if (contentType.startsWith('audio/') || contentType === 'application/ogg') return Promise.resolve(true);
  if (AUDIO_EXTENSIONS.test(url)) return Promise.resolve(true);
  return blob.slice(0, 16).arrayBuffer().then((buffer) => {
    const head = new Uint8Array(buffer);
    if (head.length >= 8) {
      // MP4/M4A "ftyp"
      if (
        head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70
      ) {
        return true;
      }
      // WAV/RIFF
      if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
        return true;
      }
      // WebM/Matroska EBML header
      if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
        return true;
      }
    }
    return AUDIO_MAGIC.some((magic) =>
      magic.every((byte, i) => head[i] === byte)
    );
  });
}
