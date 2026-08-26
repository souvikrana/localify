import { create } from 'zustand';
import type { RepeatMode, Track } from '@/types';
import { PlaybackService } from '@/services/audio/PlaybackService';

/**
 * Reactive projection of PlaybackService for React. The service owns the
 * audio element and queue; this store simply mirrors events into state so
 * components re-render at the right granularity.
 *
 * `position` updates ~4x/sec (audio timeupdate) — only the progress bar and
 * time labels select it.
 */
interface PlaybackState {
  currentTrack: Track | undefined;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Full queue ids + index of the playing track. */
  queueIds: string[];
  currentIndex: number;

  connect: () => () => void;
  tickPosition: (position: number, duration: number) => void;

  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  setVolume: (v: number) => void;
  setMuted: (muted: boolean) => void;
  setRate: (rate: number) => void;
  setShuffle: (enabled: boolean) => void;
  cycleRepeat: () => void;

  playTracks: (ids: string[], startIndex?: number) => Promise<void>;
  enqueueNext: (ids: string[]) => void;
  enqueueLast: (ids: string[]) => void;
  removeFromQueue: (position: number) => void;
  reorderQueue: (from: number, to: number) => void;
  clearUpcoming: () => void;
  jumpInQueue: (position: number) => Promise<void>;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  currentTrack: undefined,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  volume: 1,
  muted: false,
  rate: 1,
  shuffle: false,
  repeat: 'off',
  queueIds: [],
  currentIndex: -1,

  connect: () => {
    const offTrack = PlaybackService.events.on('track-change', (track) =>
      set({ currentTrack: track, duration: track?.duration ?? 0, position: 0 })
    );
    const offPlay = PlaybackService.events.on('play-state', ({ playing, loading }) =>
      set({ playing, loading })
    );
    const offQueue = PlaybackService.events.on('queue-change', () => {
      const { ids, currentIndex } = PlaybackService.getQueueState();
      set({ queueIds: [...ids], currentIndex });
    });
    const offSettings = PlaybackService.events.on('settings-change', ({ shuffle, repeat }) =>
      set({ shuffle, repeat })
    );
    const offVolume = PlaybackService.events.on('volume-change', ({ volume, muted }) =>
      set({ volume, muted })
    );
    const offTime = PlaybackService.events.on('time', ({ position, duration }) =>
      set({ position, duration })
    );

    return () => {
      offTrack();
      offPlay();
      offQueue();
      offSettings();
      offVolume();
      offTime();
    };
  },

  tickPosition: (_position, _duration) => {
    void _position;
    void _duration;
    // Position arrives via the 'time' event subscription in connect().
  },

  togglePlay: () => PlaybackService.togglePlay(),
  next: async () => {
    await PlaybackService.next();
  },
  previous: async () => {
    await PlaybackService.previous();
  },
  seek: (seconds) => PlaybackService.seekTo(seconds),
  setVolume: (v) => PlaybackService.setVolume(v),
  setMuted: (muted) => PlaybackService.setMuted(muted),
  setRate: (rate) => PlaybackService.setRate(rate),
  setShuffle: (enabled) => PlaybackService.setShuffle(enabled),
  cycleRepeat: () => PlaybackService.cycleRepeat(),

  playTracks: async (ids, startIndex = 0) => {
    if (ids.length === 0) return;
    await PlaybackService.playTracks(ids.map((id) => ({ id })), startIndex);
  },
  enqueueNext: (ids) => PlaybackService.enqueueNext(ids),
  enqueueLast: (ids) => PlaybackService.enqueueLast(ids),
  removeFromQueue: (position) => PlaybackService.removeFromQueue(position),
  reorderQueue: (from, to) => PlaybackService.reorderQueue(from, to),
  clearUpcoming: () => PlaybackService.clearUpcoming(),
  jumpInQueue: (position) => PlaybackService.jumpInQueue(position),
}));
