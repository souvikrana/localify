import { useMemo, useState } from 'react';
import type { Track } from '@/types';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Gauge,
  Heart,
  ListMusic,
  ListPlus,
  MoreVertical,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { Artwork } from '@/components/ui/Artwork';
import { IconButton } from '@/components/ui/IconButton';
import { Slider } from '@/components/ui/Slider';
import { ContextMenu, type MenuSection } from '@/components/ui/ContextMenu';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { QueuePanel } from './QueuePanel';
import { useTrackMenuSections } from '@/components/library/useTrackMenuSections';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useUiStore } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { formatDuration } from '@/utils/format';
import { hueFromString } from '@/utils/misc';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Immersive full-screen player: large artwork, ambient background derived
 * from the track's identity, complete transport controls and playback speed.
 */
export function NowPlayingOverlay() {
  const open = useUiStore((s) => s.nowPlayingOpen);
  const close = useUiStore((s) => s.closeNowPlaying);
  const store = usePlaybackStore;
  const currentTrack = usePlaybackStore((s) => s.currentTrack);
  const playing = usePlaybackStore((s) => s.playing);
  const position = usePlaybackStore((s) => s.position);
  const duration = usePlaybackStore((s) => s.duration);
  const volume = usePlaybackStore((s) => s.volume);
  const muted = usePlaybackStore((s) => s.muted);
  const shuffle = usePlaybackStore((s) => s.shuffle);
  const repeat = usePlaybackStore((s) => s.repeat);
  const rate = usePlaybackStore((s) => s.rate);

  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const openDialog = useUiStore((s) => s.openDialog);
  const navigate = useNavigate();
  const liked = useLibraryStore((s) =>
    currentTrack ? (s.trackMap.get(currentTrack.id)?.liked ?? false) : false
  );
  const setLiked = useLibraryStore((s) => s.setLiked);
  const sections = useTrackMenuSections(currentTrack ?? EMPTY_TRACK);

  const [speedOpen, setSpeedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileQueue, setMobileQueue] = useState(false);

  const hue = useMemo(() => hueFromString(currentTrack?.title ?? 'localify'), [currentTrack?.title]);
  if (!open || !currentTrack) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="now-playing"
        role="dialog"
        aria-label="Now playing"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[55] flex flex-col overflow-hidden"
        style={{
          background: `radial-gradient(120% 90% at 50% -10%, hsl(${hue} 45% 22%) 0%, var(--bg-deep) 62%)`,
        }}
      >
        {/* Header */}
        <header className="safe-top flex items-center justify-between px-4 py-3 sm:px-6">
          <IconButton label="Close player" onClick={close}>
            <ChevronDown />
          </IconButton>
          <div className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/60">
              Playing from album
            </p>
            <button
              type="button"
              className="max-w-52 truncate text-sm text-white/90 hover:underline"
              onClick={() => {
                close();
                navigate(`/albums/${encodeURIComponent(currentTrack.albumId)}`);
              }}
              title={currentTrack.album}
            >
              {currentTrack.album}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="relative xl:hidden">
              <IconButton
                label={`Playback speed ${rate}x`}
                active={rate !== 1}
                onClick={() => setSpeedOpen(!speedOpen)}
              >
                <Gauge />
              </IconButton>
            </span>
            <IconButton label={menuOpen ? 'Close menu' : 'More options'} onClick={() => setMenuOpen(true)}>
              <MoreVertical />
            </IconButton>
          </div>
        </header>

        {/* Speed popover */}
        <AnimatePresence>
          {speedOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-4 top-16 z-10 w-36 overflow-hidden rounded-xl border border-line bg-surface-2 p-1 shadow-xl"
            >
              {SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => {
                    store.getState().setRate(speed);
                    setSpeedOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-3 ${
                    rate === speed ? 'text-accent' : ''
                  }`}
                >
                  {speed}×{rate === speed && <span aria-hidden>✓</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-8 max-lg:pb-24">
          <div className="flex w-full max-w-md flex-col items-center gap-7">
            <motion.div
              animate={{ scale: playing ? 1 : 0.955 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="aspect-square w-full max-w-[min(72vw,340px)] overflow-hidden rounded-2xl shadow-2xl"
            >
              <Artwork
                artworkId={currentTrack.artworkId}
                name={currentTrack.title}
                size="full"
                rounded="none"
                iconFallback
              />
            </motion.div>

            <div className="w-full text-center">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{currentTrack.title}</h1>
              <p className="mt-1 truncate text-[15px] text-fg-muted">{currentTrack.artist}</p>
            </div>

            {/* Seek */}
            <div className="w-full">
              <Slider
                value={position}
                max={duration > 0 ? duration : currentTrack.duration || 1}
                onChange={(v) => void store.getState().seek(v)}
                showTimes
                ariaLabel="Seek"
              />
            </div>

            {/* Transport */}
            <div className="flex w-full items-center justify-center gap-3 sm:gap-5">
              <IconButton
                label="Shuffle"
                active={shuffle}
                size="lg"
                onClick={() => store.getState().setShuffle(!shuffle)}
              >
                <Shuffle />
              </IconButton>
              <IconButton label="Previous track" size="lg" onClick={() => void store.getState().previous()}>
                <SkipBack className="size-7" fill="currentColor" />
              </IconButton>
              <button
                type="button"
                aria-label={playing ? 'Pause' : 'Play'}
                onClick={() => void store.getState().togglePlay()}
                className="flex size-16 items-center justify-center rounded-full bg-fg text-bg shadow-xl transition-transform hover:scale-105 active:scale-95"
              >
                {playing ? (
                  <Pause className="size-7" fill="currentColor" />
                ) : (
                  <Play className="size-7 translate-x-[2px]" fill="currentColor" />
                )}
              </button>
              <IconButton label="Next track" size="lg" onClick={() => void store.getState().next()}>
                <SkipForward className="size-7" fill="currentColor" />
              </IconButton>
              <IconButton
                label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat queue' : 'Repeat off'}
                active={repeat !== 'off'}
                size="lg"
                onClick={() => store.getState().cycleRepeat()}
              >
                {repeat === 'one' ? <Repeat1 /> : <Repeat />}
              </IconButton>
            </div>

            {/* Secondary row */}
            <div className="flex w-full items-center justify-between px-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.82 }}
                aria-label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                aria-pressed={liked}
                onClick={() => void setLiked(currentTrack.id, !liked).catch(() => undefined)}
                className={liked ? 'text-accent' : 'text-fg-muted hover:text-fg'}
              >
                <Heart className="size-5" fill={liked ? 'currentColor' : 'none'} />
              </motion.button>

              <div className="hidden w-44 items-center gap-2 lg:flex">
                <Volume2 className="size-4 shrink-0 text-fg-faint" />
                <Slider
                  value={muted ? 0 : volume * 100}
                  max={100}
                  onChange={(v) => store.getState().setVolume(v / 100)}
                  ariaLabel="Volume"
                />
              </div>

              <span className="hidden text-xs text-fg-faint xl:block">
                {formatDuration(duration)} · {currentTrack.format.toUpperCase()}
                {currentTrack.bitrateKbps ? ` · ${currentTrack.bitrateKbps}kbps` : ''}
              </span>

              <div className="flex items-center gap-1 xl:hidden">
                <IconButton label="Add to playlist" onClick={() => openDialog({ type: 'addToPlaylist', trackIds: [currentTrack.id] })}>
                  <ListPlus />
                </IconButton>
              </div>

              <IconButton
                label="Open queue"
                onClick={() => {
                  setMobileQueue(true);
                  setQueueOpen(true);
                }}
              >
                <ListMusic />
              </IconButton>
            </div>
          </div>
        </div>

        {/* Track menu (desktop dropdown / mobile sheet) */}
        <ContextMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorPosition={{ x: window.innerWidth - 240, y: 64 }}
          sections={sections as MenuSection[]}
        />

        <BottomSheet open={mobileQueue} onClose={() => setMobileQueue(false)} label="Queue">
          <div className="h-[70dvh]">
            <QueuePanel onClose={() => setMobileQueue(false)} />
          </div>
        </BottomSheet>
      </motion.div>
    </AnimatePresence>
  );
}

const EMPTY_TRACK: Track = {
  id: '',
  title: '',
  artist: '',
  artistId: '',
  albumId: '',
  album: '',
  duration: 0,
  format: '',
  mimeType: '',
  fileSize: 0,
  source: 'local',
  dateAdded: 0,
  playCount: 0,
  liked: false,
  storageKey: '',
  hash: '',
};
