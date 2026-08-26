import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Artwork } from '@/components/ui/Artwork';
import { useUiStore, showErrorToast } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';

/** Pick a playlist for the given tracks (or create a new one inline). */
export function AddToPlaylistDialog() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const openDialog = useUiStore((s) => s.openDialog);
  const playlists = useLibraryStore((s) => s.playlists);
  const trackMap = useLibraryStore((s) => s.trackMap);
  const addTracks = useLibraryStore((s) => s.playlistAddTracks);
  const toast = useUiStore((s) => s.toast);

  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  if (dialog.type !== 'addToPlaylist') return null;

  const trackIds = dialog.trackIds;
  const firstTrack = trackMap.get(trackIds[0] ?? '');

  const addTo = async (playlistId: string, name: string) => {
    try {
      const addedCount = await addTracks(playlistId, trackIds);
      toast({
        title:
          addedCount > 0
            ? `Added ${addedCount} song${addedCount === 1 ? '' : 's'} to “${name}”`
            : `Already in “${name}”`,
        variant: addedCount > 0 ? 'success' : 'info',
      });
      setJustAdded(new Set([...justAdded, playlistId]));
      setTimeout(closeDialog, 550);
    } catch (err) {
      showErrorToast(err);
    }
  };

  return (
    <Modal open onClose={closeDialog} title={`Add ${trackIds.length === 1 ? 'song' : `${trackIds.length} songs`} to playlist`}>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => openDialog({ type: 'createPlaylist' })}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong p-3 text-left transition-colors hover:border-accent"
        >
          <span className="flex size-12 items-center justify-center rounded-lg bg-surface-2">
            <Plus className="size-5 text-fg-muted" />
          </span>
          <span>
            <span className="block text-sm font-medium">New playlist</span>
            <span className="block text-xs text-fg-muted">Create one with these songs in mind</span>
          </span>
        </button>

        {playlists.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-faint">
            No playlists yet — create your first one above.
          </p>
        ) : (
          <ul className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto">
            {playlists.map((playlist) => {
              const artworkTrack = trackMap.get(playlist.trackIds[0] ?? '');
              return (
                <li key={playlist.id}>
                  <button
                    type="button"
                    onClick={() => void addTo(playlist.id, playlist.name)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                      <Artwork
                        artworkId={playlist.artworkId ?? artworkTrack?.artworkId}
                        name={playlist.name}
                        size="thumb"
                        rounded="none"
                        iconFallback
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{playlist.name}</span>
                      <span className="block text-xs text-fg-muted">
                        {playlist.trackIds.length} song{playlist.trackIds.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    {justAdded.has(playlist.id) && (
                      <Check className="size-5 shrink-0 text-emerald-400" aria-label="Added" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {firstTrack && (
          <p className="pt-1 text-center text-[11px] text-fg-faint truncate">
            Adding: {[...new Set(trackIds)].slice(0, 3).map((id) => trackMap.get(id)?.title).filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </Modal>
  );
}
