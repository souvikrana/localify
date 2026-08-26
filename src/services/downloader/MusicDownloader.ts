import type { DownloadProgress, TrackMetadata } from '@/types';

export interface DownloadedAudio {
  blob: Blob;
  suggestedFilename: string;
  metadata: TrackMetadata;
  sourceUrl: string;
}

/**
 * Pluggable contract for acquiring music from the internet. Implementations:
 *
 *  - DirectAudioDownloader — downloads any CORS-accessible direct audio URL
 *    (podcasts, archive.org, personal servers). Fully functional offline-first.
 *  - YouTubeDownloader — resolves public video metadata client-side; actual
 *    media extraction is blocked by YouTube's CORS + signature protections,
 *    which is reported honestly instead of hidden behind a server.
 *
 * Future providers can be registered without touching UI code.
 */
export interface MusicDownloader {
  readonly id: string;
  readonly label: string;
  canHandle(url: string): boolean;
  getMetadata(url: string): Promise<TrackMetadata>;
  download(
    url: string,
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<DownloadedAudio>;
}
