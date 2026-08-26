import { useMemo, useState } from 'react';
import { ArrowDownUp, ListMusic, Plus } from 'lucide-react';
import type { DefaultSort } from '@/services/library/LibraryService';
import { LibraryService } from '@/services/library/LibraryService';
import { useLibraryStore } from '@/stores/libraryStore';
import { useUiStore } from '@/stores/uiStore';
import { TrackListVirtual } from '@/components/library/TrackListVirtual';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { groupTracksByGenre } from '@/services/library/LibraryService';
import { useNavigate } from 'react-router-dom';

const SORTS: { id: DefaultSort; label: string }[] = [
  { id: 'dateAdded-desc', label: 'Recently added' },
  { id: 'title-asc', label: 'Title A–Z' },
  { id: 'artist-asc', label: 'Artist A–Z' },
  { id: 'playCount-desc', label: 'Most played' },
];

export default function SongsPage() {
  const tracks = useLibraryStore((s) => s.tracks);
  const loaded = useLibraryStore((s) => s.loaded);
  const openDialog = useUiStore((s) => s.openDialog);
  const navigate = useNavigate();
  const [sort, setSort] = useState<DefaultSort>('dateAdded-desc');

  const sorted = useMemo(() => {
    const list = [...tracks];
    switch (sort) {
      case 'dateAdded-desc':
        return list.sort((a, b) => b.dateAdded - a.dateAdded);
      case 'dateAdded-asc':
        return list.sort((a, b) => a.dateAdded - b.dateAdded);
      case 'title-asc':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'artist-asc':
        return list.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album));
      case 'playCount-desc':
        return list.sort((a, b) => b.playCount - a.playCount || b.dateAdded - a.dateAdded);
      default:
        return list;
    }
  }, [tracks, sort]);

  if (!loaded) {
    return <div className="min-h-48 flex-1 skeleton rounded-xl" />;
  }

  if (tracks.length === 0) {
    return (
      <EmptyState
        icon={ListMusic}
        title="Your library is empty"
        detail="Import audio files or add songs from a link. Everything stays on this device."
        actions={
          <Button variant="accent" onClick={() => openDialog({ type: 'addMusic' })}>
            <Plus className="size-4" /> Import music
          </Button>
        }
      />
    );
  }

  void navigate;
  void groupTracksByGenre;

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[13px] text-fg-muted">
          {tracks.length.toLocaleString()} song{tracks.length === 1 ? '' : 's'}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          <ArrowDownUp className="size-3.5" />
          <span className="sr-only">Sort songs</span>
          <select
            aria-label="Sort songs"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as DefaultSort);
              void LibraryService.setSetting('library.defaultSort', e.target.value);
            }}
            className="rounded-lg border border-line bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TrackListVirtual tracks={sorted} showIndex rowHeight={60} />
    </>
  );
}
