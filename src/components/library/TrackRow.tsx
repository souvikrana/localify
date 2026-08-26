import { memo, useState, type MouseEvent } from 'react';
import { GripVertical, MoreVertical, Play } from 'lucide-react';
import type { Track } from '@/types';
import type { MenuSection } from '@/components/ui/ContextMenu';
import { Artwork } from '@/components/ui/Artwork';
import { LikeButton } from './LikeButton';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { useTrackMenuSections } from './useTrackMenuSections';
import { formatDuration } from '@/utils/format';
import { clsx } from '@/utils/clsx';

export interface TrackRowProps {
  track: Track;
  /** Position within the playing context. */
  index?: number;
  showAlbum?: boolean;
  showIndex?: boolean;
  isCurrent?: boolean;
  onPlay: () => void;
  subtitleExtra?: string;
  /** Extra context-menu sections (e.g. "Remove from playlist"). */
  menuExtraSections?: MenuSection[];
  /** dnd-kit drag activation for reorderable lists. */
  dragHandle?: {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown> | undefined;
  };
}

/**
 * The universal song row: artwork, title, artist, album, duration, like and
 * context menu. Used by every list in the app (songs, albums, playlists,
 * search results).
 */
export const TrackRow = memo(function TrackRow({
  track,
  index,
  showAlbum = true,
  showIndex = false,
  isCurrent,
  onPlay,
  subtitleExtra,
  menuExtraSections,
  dragHandle,
}: TrackRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number }>();
  const sections = useTrackMenuSections(track, { extraSections: menuExtraSections });

  const openMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchor({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Play ${track.title} by ${track.artist}`}
        onClick={onPlay}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onPlay();
        }}
        onContextMenu={openMenu}
        className={clsx(
          'group grid w-full cursor-pointer grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors sm:gap-4',
          menuOpen ? 'bg-surface-2' : 'hover:bg-surface-1',
          isCurrent && 'bg-surface-1',
          !showIndex && 'grid-cols-[auto_1fr_auto]'
        )}
      >
        {dragHandle && (
          <button
            type="button"
            aria-label={`Reorder ${track.title}`}
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab touch-none self-stretch text-fg-faint opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 active:cursor-grabbing max-md:opacity-60"
            tabIndex={-1}
          >
            <GripVertical className="size-4" />
          </button>
        )}

        {showIndex && typeof index === 'number' && (
          <span className="relative w-6 shrink-0 text-right" aria-hidden>
            <span className="text-xs tabular-nums text-fg-faint group-hover:opacity-0">{index + 1}</span>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              {isCurrent ? <EqualizerBars /> : <Play className="size-3.5 fill-fg text-fg" />}
            </span>
          </span>
        )}

        <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-2">
          <Artwork artworkId={track.artworkId} name={track.title} size="thumb" />
          <span
            className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          >
            {isCurrent ? (
              <EqualizerBars />
            ) : (
              <Play className="size-5 fill-white text-white" />
            )}
          </span>
        </div>

        <div className="min-w-0">
          <p className={clsx('truncate text-sm font-medium', isCurrent && 'text-accent')}>
            {track.title}
          </p>
          <p className="truncate text-[13px] text-fg-muted">
            {track.artist}
            {showAlbum && track.album ? ` · ${track.album}` : ''}
            {subtitleExtra ? ` · ${subtitleExtra}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <LikeButton trackId={track.id} liked={track.liked} size="sm" className="opacity-70 hover:opacity-100" />
          <span className="ml-1 hidden min-w-10 text-right text-xs tabular-nums text-fg-faint sm:block">
            {formatDuration(track.duration)}
          </span>
          <button
            type="button"
            aria-label={`More options for ${track.title}`}
            onClick={openMenu}
            className="rounded-full p-2 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <MoreVertical className="size-[18px]" />
          </button>
        </div>
      </div>

      <ContextMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorPosition={anchor}
        sections={sections}
      />
    </>
  );
});

/** Three animated bars indicating the currently playing track. */
export function EqualizerBars({ paused }: { paused?: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[2.5px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          style={{
            height: `${[60, 100, 40][i]}%`,
            animation: `eq 900ms ease-in-out ${i * 160}ms infinite alternate`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      ))}
      <style>{`@keyframes eq { from { transform: scaleY(0.4);} to { transform: scaleY(1.15);} }`}</style>
    </span>
  );
}
