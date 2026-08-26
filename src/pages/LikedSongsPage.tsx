import { useMemo } from 'react';
import { Heart, Plus } from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useUiStore } from '@/stores/uiStore';
import { TrackListVirtual } from '@/components/library/TrackListVirtual';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function LikedSongsPage() {
  const tracks = useLibraryStore((s) => s.tracks);
  const openDialog = useUiStore((s) => s.openDialog);
  const liked = useMemo(
    () => [...tracks].filter((t) => t.liked).sort((a, b) => b.dateAdded - a.dateAdded),
    [tracks]
  );

  if (liked.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No liked songs yet"
        detail="Tap the heart on any song and it will be waiting for you here — stored only on this device."
        actions={
          <Button variant="accent" onClick={() => openDialog({ type: 'addMusic' })}>
            <Plus className="size-4" /> Add music
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <Heart className="size-4 text-accent" fill="currentColor" />
        <p className="text-[13px] text-fg-muted">
          {liked.length} liked song{liked.length === 1 ? '' : 's'}
        </p>
      </div>
      <TrackListVirtual tracks={liked} rowHeight={60} />
    </>
  );
}
