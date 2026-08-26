import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListMusic, Plus, X } from 'lucide-react';
import { Artwork } from '@/components/ui/Artwork';
import { IconButton } from '@/components/ui/IconButton';
import { EqualizerBars } from '@/components/library/TrackRow';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useUiStore } from '@/stores/uiStore';
import { PlaylistService } from '@/services/library/PlaylistService';
import { formatDuration } from '@/utils/format';

/**
 * The play queue: current track + drag-reorderable upcoming list.
 * Desktop: right-side panel. Mobile: bottom sheet (rendered by parent).
 */
export function QueuePanel({ onClose }: { onClose?: () => void }) {
  const store = usePlaybackStore;
  const queueIds = usePlaybackStore((s) => s.queueIds);
  const currentIndex = usePlaybackStore((s) => s.currentIndex);
  const playing = usePlaybackStore((s) => s.playing);
  const currentTrack = usePlaybackStore((s) => s.currentTrack);
  const trackMap = useLibraryStore((s) => s.trackMap);
  const toast = useUiStore((s) => s.toast);

  const upcoming = useMemo(
    () => queueIds.slice(currentIndex + 1).map((id) => trackMap.get(id)).filter(Boolean),
    [queueIds, currentIndex, trackMap]
  ) as NonNullable<ReturnType<typeof trackMap.get>>[];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = upcoming.findIndex((t) => t.id === active.id);
    const newIndex = upcoming.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    // Upcoming slice starts right after the current track.
    store.getState().reorderQueue(currentIndex + 1 + oldIndex, currentIndex + 1 + newIndex);
  };

  const saveAsPlaylist = async () => {
    const name = window.prompt('Save this queue as a playlist named:', 'My Queue');
    if (!name?.trim()) return;
    const playlist = await PlaylistService.create(name.trim());
    await PlaylistService.addTracks(playlist.id, queueIds.filter(Boolean));
    await useLibraryStore.getState().refreshPlaylists();
    toast({ title: `Saved “${playlist.name}”`, variant: 'success' });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ListMusic className="size-4" /> Queue
        </h2>
        <div className="flex items-center gap-1">
          {queueIds.length > 0 && (
            <button
              type="button"
              onClick={() => void saveAsPlaylist()}
              className="mr-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Plus className="size-3.5" /> Save as playlist
            </button>
          )}
          {upcoming.length > 0 && (
            <button
              type="button"
              onClick={() => store.getState().clearUpcoming()}
              className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              Clear
            </button>
          )}
          {onClose && (
            <IconButton label="Close queue" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          )}
        </div>
      </div>

      {/* Now playing */}
      {currentTrack && (
        <div className="border-b border-line px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
            Now playing
          </p>
          <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-2">
            <span className="size-10 shrink-0 overflow-hidden rounded-md">
              <Artwork artworkId={currentTrack.artworkId} name={currentTrack.title} size="thumb" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{currentTrack.title}</span>
              <span className="block truncate text-xs text-fg-muted">{currentTrack.artist}</span>
            </span>
            <EqualizerBars paused={!playing} />
          </div>
        </div>
      )}

      {/* Up next */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
          Next up {upcoming.length > 0 && `(${upcoming.length})`}
        </p>
        {upcoming.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-fg-faint">
            Nothing queued. Play an album or add songs from any ⋮ menu.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={upcoming.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {upcoming.map((track) => (
                    <SortableQueueRow
                      key={track.id}
                      id={track.id}
                      title={track.title}
                      artist={track.artist}
                      artworkId={track.artworkId}
                      duration={formatDuration(track.duration)}
                      onRemove={() => {
                        const absoluteIndex = queueIds.indexOf(track.id);
                        if (absoluteIndex >= 0) store.getState().removeFromQueue(absoluteIndex);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

interface SortableRowProps {
  id: string;
  title: string;
  artist: string;
  artworkId?: string;
  duration: string;
  onRemove: () => void;
}

function SortableQueueRow({ id, title, artist, artworkId, duration, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <motion.li
      layout
      exit={{ opacity: 0, x: -12 }}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        'group flex touch-none items-center gap-3 rounded-lg px-2 py-1.5 ' +
        (isDragging ? 'relative z-10 bg-surface-3 shadow-lg' : 'hover:bg-surface-1')
      }
    >
      <button
        type="button"
        aria-label={`Reorder ${title}`}
        {...attributes}
        {...listeners}
        className="-ml-1 cursor-grab touch-none rounded p-1 text-fg-faint opacity-60 hover:text-fg group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="pointer-events-none size-9 shrink-0 overflow-hidden rounded-md">
        <Artwork artworkId={artworkId} name={title} size="thumb" />
      </span>
      <span className="min-w-0 flex-1 pointer-events-none">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="block truncate text-xs text-fg-muted">{artist}</span>
      </span>
      <span className="text-xs tabular-nums text-fg-faint pointer-events-none">{duration}</span>
      <IconButton label={`Remove ${title} from queue`} size="xs" onClick={onRemove} className="opacity-0 group-hover:opacity-100 max-md:opacity-100">
        <X />
      </IconButton>
    </motion.li>
  );
}
