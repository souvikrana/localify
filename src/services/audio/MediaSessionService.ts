import { PlaybackService } from './PlaybackService';
import type { Track } from '@/types';
import { ensureArtworkUrl } from '@/services/storage/ArtworkStorage';

const SEEK_SECONDS = 10;

/**
 * Wires the playback engine into the browser Media Session API so hardware
 * keys, lock screens, Bluetooth headsets and OS media flyouts work.
 * Every call is guarded — browsers without the API simply do nothing.
 */
export function setupMediaSession(): () => void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return () => undefined;
  }
  const session = navigator.mediaSession;

  const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      /* unsupported action on this browser */
    }
  };

  safeSet('play', async () => PlaybackService.togglePlay());
  safeSet('pause', () => PlaybackService.pause());
  safeSet('nexttrack', () => void PlaybackService.next());
  safeSet('previoustrack', () => void PlaybackService.previous());
  safeSet('seekforward', (details) =>
    void PlaybackService.seekBy(details.seekOffset ?? SEEK_SECONDS)
  );
  safeSet('seekbackward', (details) =>
    void PlaybackService.seekBy(-(details.seekOffset ?? SEEK_SECONDS))
  );
  try {
    safeSet('seekto', (details) => {
      if (typeof details.seekTime === 'number') void PlaybackService.seekTo(details.seekTime);
    });
  } catch {
    /* not supported */
  }

  const offTrack = PlaybackService.events.on('track-change', (track) => {
    void updateMetadata(track);
    session.playbackState = 'paused';
  });
  const offState = PlaybackService.events.on('play-state', ({ playing }) => {
    session.playbackState = playing ? 'playing' : 'paused';
    if (!playing && PlaybackService.current) {
      // Some platforms only refresh position artwork/state on metadata updates.
      void updateMetadata(PlaybackService.current);
    }
  });

  if (PlaybackService.current) void updateMetadata(PlaybackService.current);

  return () => {
    offTrack();
    offState();
    for (const action of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekforward', 'seekbackward', 'seekto'] as MediaSessionAction[]) {
      safeSet(action, null);
    }
  };
}

async function updateMetadata(track: Track | undefined): Promise<void> {
  if (!navigator.mediaSession) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  try {
    const artwork = await ensureArtworkUrl(track.artworkId, 'thumb');
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  } catch (err) {
    console.warn('[MediaSession] failed to set metadata', err);
  }
}
