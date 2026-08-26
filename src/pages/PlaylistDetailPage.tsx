import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ListMusic, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { MenuSection } from '@/components/ui/ContextMenu';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Artwork } from '@/components/ui/Artwork';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeroPlayControls } from '@/components/library/Shelf';
import { TrackRow } from '@/components/library/TrackRow';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useUiStore } from '@/stores/uiStore';
import type { Track } from '@/types';

const REORDER_LIMIT = 300;

export default function PlaylistDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const playlist = useLibraryStore((s) => s.playlists.find((p) => p.id === id));
  const trackMap = useLibraryStore((s) => s.trackMap);
  const moveTrack = useLibraryStore((s) => s.playlistMoveTrack);
  const removeTrackAt = useLibraryStore((s) => s.playlistRemoveTrackAt);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const openDialog = useUiStore((s) => s.openDialog);

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number }>();

  const tracks: Track[] = useMemo(
    () =>
      (playlist?.trackIds ?? [])
        .map((tid) => trackMap.get(tid))
        .filter((t): t is Track => !!t),
    [playlist, trackMap]
  );

  const artworkId = playlist?.artworkId ?? tracks[0]?.artworkId;
  const ids = useMemo(() => tracks.map((t) => t.id), [tracks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const canReorder = !!playlist && tracks.length > 1 && tracks.length <= REORDER_LIMIT;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!playlist || !over || active.id === over.id) return;
    const from = playlist.trackIds.indexOf(String(active.id));
    const to = playlist.trackIds.indexOf(String(over.id));
    if (from !== -1 && to !== -1) void moveTrack(playlist.id, from, to);
  };

  if (!playlist) {
    return (
      <EmptyState
        icon={ListMusic}
        title="Playlist not found"
        detail="It may have been deleted on this device."
        actions={
          <Link to="/playlists" className="text-sm text-accent hover:underline">
            Back to playlists
          </Link>
        }
      />
    );
  }

  const startRename = () => {
    setNameDraft(playlist.name);
    setDescDraft(playlist.description ?? '');
    setRenaming(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <IconButton label="Back" size="sm" variant="solid" onClick={() => window.history.back()}>
          <ArrowLeft />
        </IconButton>
        <IconButton
          label="Playlist options"
          size="sm"
          onClick={(e) => {
            setMenuAnchor({ x: e.clientX - 180, y: e.clientY + 10 });
            setMenuOpen(true);
          }}
        >
          <MoreVertical />
        </IconButton>
      </div>

      <header className="mb-5 flex items-end gap-5 sm:gap-6">
        <span className="size-28 shrink-0 overflow-hidden rounded-xl shadow-xl sm:size-40">
          <Artwork artworkId={artworkId} name={playlist.name} size="full" rounded="xl" iconFallback />
        </span>
        <div className="min-w-0 pb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-faint">Playlist</p>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-balance sm:text-4xl">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="mt-1 truncate text-[13px] text-fg-muted">{playlist.description}</p>
          )}
          <p className="mt-1.5 text-[13px] text-fg-muted">
            {tracks.length} song{tracks.length === 1 ? '' : 's'} · created{' '}
            {new Date(playlist.createdAt).toLocaleDateString()}
          </p>
          <div className="mt-4">
            <HeroPlayControls ids={ids} label={playlist.name} />
          </div>
        </div>
      </header>

      {tracks.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="This playlist is empty"
          detail='Use the ⋮ menu on any song and choose "Add to playlist".'
          actions={
            <Button variant="surface" onClick={() => navigate('/library/songs')}>
              Find songs
            </Button>
          }
        />
      ) : canReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul role="list" aria-label={`Songs in ${playlist.name}`} className="space-y-0.5 pb-24">
              {tracks.map((track, index) => (
                <SortablePlaylistRow
                  key={`${track.id}-${index}`}
                  track={track}
                  index={index}
                  queueIds={ids}
                  onRemove={() => void removeTrackAt(playlist.id, index)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul role="list" aria-label={`Songs in ${playlist.name}`} className="space-y-0.5 pb-24">
          {tracks.map((track, index) => (
            <li key={`${track.id}-${index}`}>
              <TrackRow
                track={track}
                index={index}
                showIndex
                isCurrent={false}
                onPlay={() => void usePlaybackStore.getState().playTracks(ids, index)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Rename dialog */}
      <Modal open={renaming} onClose={() => setRenaming(false)} title="Edit playlist">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nameDraft.trim()) return;
            void useLibraryStore.getState().renamePlaylist(playlist.id, nameDraft.trim(), descDraft.trim());
            setRenaming(false);
          }}
          className="space-y-3"
        >
          <input
            aria-label="Playlist name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={120}
            autoFocus
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            aria-label="Playlist description"
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="Description (optional)"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-fg-faint focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={!nameDraft.trim()}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <ContextMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorPosition={menuAnchor}
        sections={[
          {
            id: 'playlist-menu',
            items: [
              {
                id: 'rename',
                label: 'Rename / describe',
                icon: <Pencil />,
                onSelect: startRename,
              },
              {
                id: 'delete',
                label: 'Delete playlist',
                icon: <Trash2 />,
                danger: true,
                onSelect: () =>
                  openDialog({
                    type: 'confirm',
                    title: `Delete “${playlist.name}”?`,
                    detail: 'The playlist disappears, but the songs stay in your library.',
                    confirmLabel: 'Delete',
                    danger: true,
                    onConfirm: () => {
                      void deletePlaylist(playlist.id).then(() => navigate('/playlists'));
                    },
                  }),
              },
            ],
          },
        ]}
      />
    </div>
  );
}

function SortablePlaylistRow({
  track,
  index,
  queueIds,
  onRemove,
}: {
  track: Track;
  index: number;
  queueIds: string[];
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const extraSections: MenuSection[] = useMemo(
    () => [
      {
        id: 'playlist-actions',
        items: [
          {
            id: 'remove-from-playlist',
            label: 'Remove from this playlist',
            icon: <Trash2 />,
            danger: true,
            onSelect: onRemove,
          },
        ],
      },
    ],
    [onRemove]
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/row relative ${isDragging ? 'z-10 opacity-90' : ''}`}
    >
      <TrackRow
        track={track}
        index={index}
        showIndex
        onPlay={() => void usePlaybackStore.getState().playTracks(queueIds, index)}
        menuExtraSections={extraSections}
        dragHandle={{ attributes: attributes as unknown as Record<string, unknown>, listeners }}
      />
    </li>
  );
}
