import type { PlaybackSnapshot, RepeatMode, Track } from '@/types';
import { db, SETTINGS_KEYS } from '@/db/database';
import { AudioStorage } from '@/services/storage/AudioStorage';
import { LibraryService } from '@/services/library/LibraryService';
import { Emitter } from '@/utils/emitter';
import { AppError } from '@/utils/errors';
import { throttle } from '@/utils/misc';
import { QueueManager } from './QueueManager';

export interface PlaybackEvents {
  'track-change': Track | undefined;
  'play-state': { playing: boolean; loading: boolean };
  'queue-change': void;
  'settings-change': { shuffle: boolean; repeat: RepeatMode };
  'volume-change': { volume: number; muted: boolean };
  /** Emitted ~4x/sec while playing (audio timeupdate). */
  time: { position: number; duration: number };
  error: AppError;
}

const SNAPSHOT_SAVE_INTERVAL_MS = 5000;

/**
 * The single source of truth for playback. UI components never touch the
 * <audio> element — they subscribe to this service's events and call methods.
 *
 * Responsibilities: loading local audio blobs into object URLs, driving the
 * media element, owning the queue, persisting position/queue across reloads,
 * recording plays, and pre-fetching the next track for fast transitions.
 */
export class PlaybackServiceClass {
  readonly events = new Emitter<PlaybackEvents>();
  private queue = new QueueManager();
  private el: HTMLAudioElement | null = null;
  private currentTrack: Track | undefined;
  private currentUrl: string | undefined;
  private loading = false;
  private _playing = false;
  private _volume = 1;
  private _muted = false;
  private _rate = 1;
  private playRecordedFor: string | null = null;
  private prefetchUrl = new Map<string, string>();

  get playing(): boolean {
    return this._playing;
  }

  get isLoading(): boolean {
    return this.loading;
  }

  get current(): Track | undefined {
    return this.currentTrack;
  }

  get currentTime(): number {
    return this.el?.currentTime ?? 0;
  }

  get duration(): number {
    return this.el?.duration && Number.isFinite(this.el.duration) ? this.el.duration : this.currentTrack?.duration ?? 0;
  }

  get volume(): number {
    return this._volume;
  }

  get muted(): boolean {
    return this._muted;
  }

  get rate(): number {
    return this._rate;
  }

  get shuffle(): boolean {
    return this.queue.shuffle;
  }

  get repeat(): RepeatMode {
    return this.queue.repeat;
  }

  get upcomingTrackIds(): readonly string[] {
    const ids = this.queue.trackIds;
    return ids.slice(this.queue.currentIndex + 1);
  }

  get queueSize(): number {
    return this.queue.size;
  }

  private ensureElement(): HTMLAudioElement {
    if (!this.el) {
      const el = new Audio();
      el.preload = 'auto';
      this.attachElementListeners(el);
      this.el = el;
      void this.restoreSettings();
    }
    return this.el;
  }

  private attachElementListeners(el: HTMLAudioElement): void {
    el.addEventListener('play', () => {
      this._playing = true;
      this.events.emit('play-state', { playing: true, loading: false });
    });
    el.addEventListener('pause', () => {
      this._playing = false;
      this.events.emit('play-state', { playing: false, loading: false });
      this.persistSnapshot();
    });
    el.addEventListener('ended', () => this.handleEnded());
    el.addEventListener('error', () => {
      if (!el.src) return;
      this.loading = false;
      this.events.emit('play-state', { playing: false, loading: false });
      this.events.emit(
        'error',
        new AppError(
          'Unable to play this file — the audio format may not be supported by this browser',
          'unsupported-format'
        )
      );
    });
    el.addEventListener('waiting', () => {
      this.loading = true;
      this.events.emit('play-state', { playing: this._playing, loading: true });
    });
    el.addEventListener('canplay', () => {
      if (this.loading) {
        this.loading = false;
        this.events.emit('play-state', { playing: this._playing, loading: false });
      }
    });
    const emitTime = throttle(() => {
      const duration = Number.isFinite(el.duration) ? el.duration : (this.currentTrack?.duration ?? 0);
      this.events.emit('time', { position: el.currentTime || 0, duration });
    }, 250);
    el.addEventListener('timeupdate', () => emitTime());
    window.addEventListener('pagehide', () => this.persistSnapshot());
  }

  // -- Public API -----------------------------------------------------------

  /** Play a list of tracks starting at startIndex. */
  async playTracks(tracks: Pick<Track, 'id'>[], startIndex = 0): Promise<void> {
    if (tracks.length === 0) return;
    this.queue.setQueue(tracks.map((t) => t.id), startIndex);
    this.events.emit('queue-change');
    const id = this.queue.currentId();
    if (id) await this.loadAndPlay(id);
  }

  async playTrack(track: Pick<Track, 'id'>): Promise<void> {
    const inQueue = this.queue.jumpToId(track.id);
    if (inQueue) {
      await this.loadAndPlay(this.queue.currentId()!);
      this.events.emit('queue-change');
      return;
    }
    await this.playTracks([track], 0);
  }

  async togglePlay(): Promise<void> {
    if (!this.currentTrack) return;
    const el = this.ensureElement();
    if (el.paused) {
      try {
        await el.play();
      } catch (err) {
        this.events.emit('error', new AppError('Playback was blocked by the browser', 'unknown', err));
      }
    } else {
      el.pause();
    }
  }

  pause(): void {
    this.el?.pause();
  }

  /** Skip to the next track honouring repeat/shuffle. Returns false when the queue ended. */
  async next(_userInitiated = true): Promise<boolean> {
    void _userInitiated;
    // Repeat-one loops are handled directly in handleEnded.
    const id = this.queue.advanceSkippingRepeatOne();
    if (!id) {
      this.pause();
      return false;
    }
    this.events.emit('queue-change');
    await this.loadAndPlay(id);
    return true;
  }

  async previous(): Promise<boolean> {
    // Standard behaviour: restart the current track first.
    if (this.currentTime > 3) {
      await this.seekTo(0);
      return true;
    }
    const id = this.queue.previous();
    if (!id) return false;
    this.events.emit('queue-change');
    await this.loadAndPlay(id);
    return true;
  }

  async seekTo(seconds: number): Promise<void> {
    const el = this.el;
    if (!el || !Number.isFinite(el.duration)) return;
    const clamped = Math.max(0, Math.min(seconds, el.duration));
    try {
      el.currentTime = clamped;
      this.persistSnapshot();
    } catch {
      /* seeking before metadata is ready is harmless */
    }
  }

  async seekBy(deltaSeconds: number): Promise<void> {
    await this.seekTo(this.currentTime + deltaSeconds);
  }

  async jumpInQueue(position: number): Promise<void> {
    const id = this.queue.jumpToPosition(position);
    if (!id) return;
    this.events.emit('queue-change');
    await this.loadAndPlay(id);
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this.ensureElement().volume = this._volume;
    if (this._volume > 0 && this._muted) this.setMuted(false);
    this.events.emit('volume-change', { volume: this._volume, muted: this._muted });
    void LibraryService.setSetting(SETTINGS_KEYS.DEFAULT_VOLUME, this._volume);
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.ensureElement().muted = muted;
    this.events.emit('volume-change', { volume: this._volume, muted: this._muted });
  }

  setRate(rate: number): void {
    this._rate = Math.max(0.25, Math.min(4, rate));
    if (this.el) this.el.playbackRate = this._rate;
  }

  setShuffle(enabled: boolean): void {
    this.queue.setShuffle(enabled);
    this.events.emit('settings-change', { shuffle: enabled, repeat: this.queue.repeat });
    this.events.emit('queue-change');
    void this.prefetchNext();
  }

  cycleRepeat(): RepeatMode {
    const mode = this.queue.cycleRepeat();
    this.events.emit('settings-change', { shuffle: this.queue.shuffle, repeat: mode });
    void this.prefetchNext();
    return mode;
  }

  enqueueNext(ids: string[]): void {
    this.queue.addNext(ids);
    this.events.emit('queue-change');
    void this.prefetchNext();
  }

  enqueueLast(ids: string[]): void {
    this.queue.addToEnd(ids);
    this.events.emit('queue-change');
  }

  removeFromQueue(position: number): void {
    this.queue.removeAt(position);
    this.events.emit('queue-change');
  }

  reorderQueue(from: number, to: number): void {
    this.queue.reorder(from, to);
    this.events.emit('queue-change');
  }

  clearUpcoming(): void {
    this.queue.clearUpcoming();
    this.events.emit('queue-change');
  }

  // -- Internals ------------------------------------------------------------

  private async loadAndPlay(id: string): Promise<void> {
    const track = await db.tracks.get(id);
    if (!track) {
      // Stale queue entry — skip forward rather than dying here.
      const fallback = this.queue.next();
      this.events.emit('queue-change');
      if (fallback && fallback !== id) await this.loadAndPlay(fallback);
      return;
    }

    this.loading = true;
    this.events.emit('play-state', { playing: this._playing, loading: true });

    let loaded: { blob: Blob; url: string };
    try {
      loaded = await this.getAudioBlob(track);
    } catch (err) {
      this.loading = false;
      this.events.emit('play-state', { playing: false, loading: false });
      this.events.emit('error', err instanceof AppError ? err : new AppError('Could not load audio data'));
      return;
    }

    if (this.currentUrl && this.currentUrl !== loaded.url) URL.revokeObjectURL(this.currentUrl);
    this.currentUrl = loaded.url;

    const el = this.ensureElement();
    el.src = loaded.url;
    el.playbackRate = this._rate;
    el.volume = this._volume;
    el.muted = this._muted;

    const previousId = this.currentTrack?.id;
    this.currentTrack = track;
    this.playRecordedFor = null;
    this.events.emit('track-change', track);

    // Record a "play" once meaningful listening has happened.
    setTimeout(() => {
      if (this.currentTrack?.id === track.id && (this._playing || !el.paused)) {
        void LibraryService.recordPlay(track.id).catch(() => undefined);
        this.playRecordedFor = track.id;
      }
    }, 8000);

    if (previousId !== track.id) void this.prefetchNext();

    try {
      await el.play();
      this.loading = false;
      this.events.emit('play-state', { playing: true, loading: false });
      this.persistSnapshot();
    } catch (err) {
      this.loading = false;
      this.events.emit('play-state', { playing: false, loading: false });
      // Autoplay policy rejections surface as AbortError — stay paused quietly.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        this.events.emit('error', new AppError('Playback failed to start', 'unknown', err));
      }
    }
  }

  /**
   * Fetch the audio blob for a track, reusing the prefetch cache so switching
   * to an already-queued song feels instant.
   */
  private async getAudioBlob(track: Track): Promise<{ blob: Blob; url: string }> {
    const cachedUrl = this.prefetchUrl.get(track.id);
    if (cachedUrl) {
      this.prefetchUrl.delete(track.id);
      const cachedBlob = await AudioStorage.getTrackAudio(track.storageKey);
      if (cachedBlob) return { blob: cachedBlob, url: cachedUrl };
      URL.revokeObjectURL(cachedUrl);
    }
    const fresh = await AudioStorage.getTrackAudio(track.storageKey);
    if (!fresh) throw new AppError('The audio data for this track is missing on this device', 'not-found');
    return { blob: fresh, url: URL.createObjectURL(fresh) };
  }

  /** Preload the next track's blob as an object URL for near-instant transitions. */
  private async prefetchNext(): Promise<void> {
    const nextId = this.queue.peekNext();
    if (!nextId || this.prefetchUrl.has(nextId)) return;
    const track = await db.tracks.get(nextId);
    if (!track) return;
    try {
      const blob = await AudioStorage.getTrackAudio(track.storageKey);
      if (!blob) return;
      if (this.prefetchUrl.size > 2) {
        const oldest = this.prefetchUrl.entries().next().value;
        if (oldest) {
          const [oldId, oldUrl] = oldest;
          this.prefetchUrl.delete(oldId);
          URL.revokeObjectURL(oldUrl);
        }
      }
      this.prefetchUrl.set(nextId, URL.createObjectURL(blob));
    } catch {
      /* prefetching is best-effort */
    }
  }

  private async handleEnded(): Promise<void> {
    this._playing = false;
    if (this.playRecordedFor !== this.currentTrack?.id && this.currentTrack) {
      void LibraryService.recordPlay(this.currentTrack.id).catch(() => undefined);
    }
    // Repeat-one: loop the same element without reloading.
    if (this.queue.repeat === 'one') {
      const el = this.el;
      if (el) {
        try {
          el.currentTime = 0;
          await el.play();
          return;
        } catch {
          /* fall through to normal advance */
        }
      }
    }
    void this.next(false);
  }

  private persistSnapshot = throttle((): void => {
    if (!this.currentTrack) return;
    const snapshot: PlaybackSnapshot = {
      trackId: this.currentTrack.id,
      positionSec: this.currentTime,
      queueTrackIds: [...this.queue.trackIds],
      currentIndex: this.queue.currentIndex,
      shuffle: this.queue.shuffle,
      repeat: this.queue.repeat,
      savedAt: Date.now(),
    };
    void db.settings.put({ key: SETTINGS_KEYS.PLAYBACK_SNAPSHOT, value: snapshot }).catch(() => undefined);
  }, SNAPSHOT_SAVE_INTERVAL_MS);

  /** Restore last session's queue + position (paused). Called at app start. */
  async restoreSession(): Promise<void> {
    this.ensureElement();
    await this.restoreSettings();
    const record = await db.settings.get(SETTINGS_KEYS.PLAYBACK_SNAPSHOT);
    const snapshot = record?.value as PlaybackSnapshot | undefined;
    if (!snapshot?.trackId) return;
    const track = await db.tracks.get(snapshot.trackId);
    if (!track) return;

    this.queue.restore(snapshot.queueTrackIds ?? [snapshot.trackId], snapshot.currentIndex ?? 0, snapshot.shuffle, snapshot.repeat ?? 'off');
    await this.loadPaused(track, snapshot.positionSec ?? 0);
    this.events.emit('queue-change');
    this.events.emit('settings-change', { shuffle: this.queue.shuffle, repeat: this.queue.repeat });
    this.events.emit('track-change', track);
  }

  private async loadPaused(track: Track, positionSec: number): Promise<void> {
    try {
      const { url } = await this.getAudioBlob(track);
      if (this.currentUrl) URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = url;
      const el = this.ensureElement();
      el.src = url;
      el.volume = this._volume;
      el.muted = this._muted;
      el.playbackRate = this._rate;
      this.currentTrack = track;
      const applyPosition = () => {
        try {
          el.currentTime = Math.min(positionSec, Math.max(0, (el.duration || positionSec) - 0.5));
        } catch {
          /* metadata not ready yet */
        }
        el.removeEventListener('loadedmetadata', applyPosition);
      };
      if (el.readyState >= 1) applyPosition();
      else el.addEventListener('loadedmetadata', applyPosition);
    } catch (err) {
      console.warn('[PlaybackService] could not restore session:', err);
    }
  }

  private async restoreSettings(): Promise<void> {
    const volume = await LibraryService.getSetting<number>(SETTINGS_KEYS.DEFAULT_VOLUME, 1);
    this._volume = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1;
    if (this.el) {
      this.el.volume = this._volume;
    }
    this.events.emit('volume-change', { volume: this._volume, muted: this._muted });
  }

  /** For tests / teardown. */
  dispose(): void {
    this.removeAllObjectUrls();
    this.el?.pause();
    this.el?.removeAttribute('src');
    this.el = null;
    this.queue = new QueueManager();
    this.currentTrack = undefined;
    this.events.removeAllListeners();
  }

  private removeAllObjectUrls(): void {
    if (this.currentUrl) URL.revokeObjectURL(this.currentUrl);
    this.currentUrl = undefined;
    for (const [, url] of this.prefetchUrl) URL.revokeObjectURL(url);
    this.prefetchUrl.clear();
  }

  /** Exposed read-only view of queue state for UI rendering. */
  getQueueState(): { ids: readonly string[]; currentIndex: number } {
    return { ids: this.queue.trackIds, currentIndex: this.queue.currentIndex };
  }
}

export const PlaybackService = new PlaybackServiceClass();
