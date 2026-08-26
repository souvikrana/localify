import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListMusic,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Artwork } from '@/components/ui/Artwork';
import { IconButton } from '@/components/ui/IconButton';
import { Slider } from '@/components/ui/Slider';
import { LikeButton } from '@/components/library/LikeButton';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * Persistent player. Desktop: full bar pinned above the bottom edge.
 * Mobile: compact strip above the tab bar; tapping the metadata opens the
 * full-screen Now Playing view.
 */
export function PlayerBar() {
  const currentTrack = usePlaybackStore((s) => s.currentTrack);
  const playing = usePlaybackStore((s) => s.playing);
  const loading = usePlaybackStore((s) => s.loading);
  const position = usePlaybackStore((s) => s.position);
  const duration = usePlaybackStore((s) => s.duration);
  const volume = usePlaybackStore((s) => s.volume);
  const muted = usePlaybackStore((s) => s.muted);
  const shuffle = usePlaybackStore((s) => s.shuffle);
  const repeat = usePlaybackStore((s) => s.repeat);

  const store = usePlaybackStore;
  const navigate = useNavigate();
  const openNowPlaying = useUiStore((s) => s.openNowPlaying);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const queueOpen = useUiStore((s) => s.queueOpen);

  const handleSeek = useCallback((v: number) => void store.getState().seek(v), [store]);

  if (!currentTrack) return <div className="hidden md:block" aria-hidden />;

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <footer className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+56px)] z-40 md:bottom-0">
      {/* Mobile compact player */}
      <div className="mx-2 mb-1 flex items-center gap-3 rounded-xl border border-line bg-surface-2/95 p-2 shadow-lg backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Open full screen player"
          onClick={openNowPlaying}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="size-10 shrink-0 overflow-hidden rounded-md">
            <Artwork artworkId={currentTrack.artworkId} name={currentTrack.title} size="thumb" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium">{currentTrack.title}</span>
            <span className="block truncate text-xs text-fg-muted">{currentTrack.artist}</span>
          </span>
        </button>
        <IconButton
          label={playing ? 'Pause' : 'Play'}
          onClick={() => void store.getState().togglePlay()}
          size="md"
        >
          {playing ? (
            <Pause fill="currentColor" />
          ) : (
            <Play fill={loading ? 'none' : 'currentColor'} className={loading ? 'animate-pulse' : undefined} />
          )}
        </IconButton>
        <IconButton label="Next track" onClick={() => void store.getState().next()} size="md">
          <SkipForward />
        </IconButton>
      </div>

      {/* Desktop full bar */}
      <div className="hidden h-[84px] grid-cols-[minmax(200px,1fr)_minmax(340px,2fr)_minmax(220px,1fr)] items-center gap-4 border-t border-line bg-surface-1/90 px-5 backdrop-blur-xl md:grid">
        {/* Track info */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={openNowPlaying}
            aria-label={`Open now playing: ${currentTrack.title}`}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <span className="size-12 shrink-0 overflow-hidden rounded-md shadow">
              <Artwork artworkId={currentTrack.artworkId} name={currentTrack.title} size="thumb" />
            </span>
            <span className="min-w-0 group">
              <span className="block truncate text-sm font-medium group-hover:underline">
                {currentTrack.title}
              </span>
              <span className="block truncate text-xs text-fg-muted">
                {currentTrack.artist}
                {currentTrack.album ? ` · ${currentTrack.album}` : ''}
              </span>
            </span>
          </button>
          <LikeButton trackId={currentTrack.id} className="ml-auto shrink-0 opacity-80 hover:opacity-100" />
        </div>

        {/* Controls + seek */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <IconButton
              label="Shuffle"
              active={shuffle}
              onClick={() => store.getState().setShuffle(!shuffle)}
              size="sm"
              className="hidden lg:inline-flex"
            >
              <Shuffle />
            </IconButton>
            <IconButton label="Previous track" onClick={() => void store.getState().previous()} size="md">
              <SkipBack fill="currentColor" />
            </IconButton>
            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => void store.getState().togglePlay()}
              className="mx-1 flex size-10 items-center justify-center rounded-full bg-fg text-bg transition-transform hover:scale-[1.06] active:scale-95"
            >
              {playing ? (
                <Pause className="size-5" fill="currentColor" />
              ) : (
                <Play
                  className={'size-5 translate-x-[1px]' + (loading ? ' animate-pulse' : '')}
                  fill="currentColor"
                />
              )}
            </button>
            <IconButton label="Next track" onClick={() => void store.getState().next()} size="md">
              <SkipForward fill="currentColor" />
            </IconButton>
            <IconButton
              label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat queue' : 'Repeat off'}
              active={repeat !== 'off'}
              onClick={() => store.getState().cycleRepeat()}
              size="sm"
              className="hidden lg:inline-flex"
            >
              {repeat === 'one' ? <Repeat1 /> : <Repeat />}
            </IconButton>
          </div>
          <Slider
            value={position}
            max={duration > 0 ? duration : currentTrack.duration || 1}
            onChange={handleSeek}
            showTimes
            ariaLabel="Seek"
          />
        </div>

        {/* Right controls */}
        <div className="flex items-center justify-end gap-1">
          <IconButton
            label="View artist"
            size="sm"
            className="hidden xl:inline-flex"
            onClick={() => navigate(`/artists/${encodeURIComponent(currentTrack.artistId)}`)}
          >
            <Mic2 />
          </IconButton>
          <div className="mr-1 hidden items-center gap-1.5 lg:flex">
            <IconButton
              label={muted ? 'Unmute' : 'Mute'}
              onClick={() => store.getState().setMuted(!muted)}
              size="sm"
            >
              <VolumeIcon />
            </IconButton>
            <div className="w-24">
              <Slider
                value={muted ? 0 : volume * 100}
                max={100}
                onChange={(v) => store.getState().setVolume(v / 100)}
                ariaLabel="Volume"
              />
            </div>
          </div>
          <IconButton
            label={queueOpen ? 'Close queue' : 'Open queue'}
            variant={queueOpen ? 'solid' : 'ghost'}
            active={queueOpen}
            className="hidden lg:inline-flex"
            onClick={() => setQueueOpen(!queueOpen)}
          >
            <ListMusic />
          </IconButton>
        </div>
      </div>
    </footer>
  );
}
