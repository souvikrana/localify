import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Track } from '@/types';
import { TrackRow } from './TrackRow';
import { usePlaybackStore } from '@/stores/playbackStore';

export interface TrackListVirtualProps {
  tracks: Track[];
  showIndex?: boolean;
  showAlbum?: boolean;
  /** Height of each row in px (must stay in sync with TrackRow layout). */
  rowHeight?: number;
  overscan?: number;
}

/**
 * Windowed track list — renders only visible rows so 10,000+ song libraries
 * scroll at 60fps. The container must have a bounded height.
 */
export function TrackListVirtual({
  tracks,
  showIndex = false,
  showAlbum = true,
  rowHeight = 60,
  overscan = 8,
}: TrackListVirtualProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const currentTrackId = usePlaybackStore((s) => s.currentTrack?.id);
  const playTracks = usePlaybackStore((s) => s.playTracks);

  const ids = useMemo(() => tracks.map((t) => t.id), [tracks]);

  // TanStack Virtual manages its own memoization internally.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Songs">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const track = tracks[item.index];
          if (!track) return null;
          return (
            <div
              key={track.id}
              ref={virtualizer.measureElement}
              data-index={item.index}
              role="listitem"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${item.start}px)`,
              }}
            >
              <TrackRow
                track={track}
                index={item.index}
                showIndex={showIndex}
                showAlbum={showAlbum}
                isCurrent={track.id === currentTrackId}
                onPlay={() => void playTracks(ids, item.index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
