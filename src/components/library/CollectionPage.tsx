import { useMemo, type ReactNode } from 'react';
import type { Track } from '@/types';
import { Artwork } from '@/components/ui/Artwork';
import { TrackListVirtual } from './TrackListVirtual';
import { HeroPlayControls } from './Shelf';
import { formatLongDuration } from '@/utils/format';

export interface CollectionPageProps {
  title: string;
  /** First line = kind label ("Album", "Artist", "Genre"); rest joined as meta. */
  lines: string[];
  artworkId?: string;
  name: string;
  round?: boolean;
  tracks: Track[];
  children?: ReactNode;
}

/**
 * Shared "hero + virtualized track list" layout used by album, artist and
 * genre detail pages.
 */
export function CollectionPage({
  title,
  lines,
  artworkId,
  name,
  round,
  tracks,
  children,
}: CollectionPageProps) {
  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks]);
  const totalDuration = useMemo(() => tracks.reduce((sum, t) => sum + t.duration, 0), [tracks]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-5 flex items-end gap-5 sm:gap-6">
        <span
          className={`size-28 shrink-0 overflow-hidden shadow-xl sm:size-40 ${
            round ? 'rounded-full' : 'rounded-xl'
          }`}
        >
          <Artwork
            artworkId={artworkId}
            name={name}
            size="full"
            rounded={round ? 'full' : 'xl'}
            iconFallback
          />
        </span>
        <div className="min-w-0 pb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-faint">{lines[0]}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
          <p className="mt-2 truncate text-[13px] text-fg-muted">
            {[...lines.slice(1).filter(Boolean), `${tracks.length} songs`, formatLongDuration(totalDuration)].join(' · ')}
          </p>
          <div className="mt-4">
            <HeroPlayControls ids={trackIds} label={title} />
          </div>
        </div>
      </header>
      {children}
      <div className="flex min-h-0 flex-1 flex-col">
        <TrackListVirtual tracks={tracks} showIndex rowHeight={60} />
      </div>
    </div>
  );
}
