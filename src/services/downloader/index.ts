import type { DownloadedAudio, MusicDownloader } from './MusicDownloader';
import { DirectAudioDownloader } from './DirectAudioDownloader';
import { YouTubeDownloader } from './YouTubeDownloader';

const direct = new DirectAudioDownloader();
const youtube = new YouTubeDownloader();

/** Ordered registry — first provider whose canHandle() matches wins. */
const providers: MusicDownloader[] = [youtube, direct];

export function resolveDownloader(url: string): MusicDownloader | undefined {
  const trimmed = url.trim();
  return providers.find((p) => p.canHandle(trimmed));
}

export function explainYouTubeLimitation(): { title: string; detail: string[] } {
  return {
    title: 'YouTube audio needs an extra step',
    detail: [
      'Browsers block direct downloads from YouTube (CORS + stream signatures), and Localify deliberately has no server.',
      'To add a song from YouTube: download the audio file yourself, then import it here — Import Files works fully offline afterwards.',
      'Direct links to audio files (.mp3, .m4a, .flac…) from any site that allows cross-origin requests work right here.',
    ],
  };
}

export type { DownloadedAudio, MusicDownloader };
