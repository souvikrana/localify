import { ListMusic, Plus } from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useUiStore } from '@/stores/uiStore';
import { playlistCard } from '@/components/library/Shelf';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function PlaylistsPage() {
  const playlists = useLibraryStore((s) => s.playlists);
  const tracks = useLibraryStore((s) => s.tracks);
  const openDialog = useUiStore((s) => s.openDialog);

  if (playlists.length === 0) {
    return (
      <EmptyState
        icon={ListMusic}
        title="No playlists yet"
        detail="Create one for your next mood. Playlists are stored locally and sync nowhere unless you say so."
        actions={
          <Button variant="accent" onClick={() => openDialog({ type: 'createPlaylist' })}>
            <Plus className="size-4" /> Create playlist
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Playlists</h1>
        <Button variant="surface" onClick={() => openDialog({ type: 'createPlaylist' })}>
          <Plus className="size-4" /> New playlist
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {playlists.map((playlist) => {
          const artTrack = tracks.find((t) => t.id === playlist.trackIds[0]);
          return playlistCard(playlist, artTrack?.artworkId);
        })}
      </div>
    </div>
  );
}
