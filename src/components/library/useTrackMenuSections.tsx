import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3,
  Download,
  Heart,
  ListPlus,
  Mic2,
  Pencil,
  PlayCircle,
  Plus,
  ListStart,
  Trash2,
} from 'lucide-react';
import type { Track } from '@/types';
import type { MenuSection } from '@/components/ui/ContextMenu';
import { PlaybackService } from '@/services/audio/PlaybackService';
import { LibraryService } from '@/services/library/LibraryService';
import { useLibraryStore } from '@/stores/libraryStore';
import { useUiStore, showErrorToast } from '@/stores/uiStore';

export interface TrackMenuOptions {
  /** Extra sections supplied by the host view (e.g. "Remove from playlist"). */
  extraSections?: MenuSection[];
}

/**
 * Builds the shared context-menu content for a track — used by rows on
 * desktop (dropdown) and mobile (bottom sheet) so behaviour stays consistent.
 */
export function useTrackMenuSections(
  track: Track,
  options: TrackMenuOptions = {}
): MenuSection[] {
  const navigate = useNavigate();
  const setLiked = useLibraryStore((s) => s.setLiked);
  const openDialog = useUiStore((s) => s.openDialog);
  const toast = useUiStore((s) => s.toast);

  return useMemo(() => {
    const playNow = () => void PlaybackService.playTrack(track).catch(showErrorToast);
    const playNext = () => PlaybackService.enqueueNext([track.id]);
    const addQueue = () => {
      PlaybackService.enqueueLast([track.id]);
      toast({ title: 'Added to queue', variant: 'success' });
    };
    const toggleLike = () => void setLiked(track.id, !track.liked).catch(showErrorToast);
    const addToPlaylist = () => openDialog({ type: 'addToPlaylist', trackIds: [track.id] });
    const goToArtist = () => navigate(`/artists/${encodeURIComponent(track.artistId)}`);
    const goToAlbum = () => navigate(`/albums/${encodeURIComponent(track.albumId)}`);
    const editMetadata = () => openDialog({ type: 'editMetadata', trackId: track.id });
    const exportFile = async () => {
      try {
        await LibraryService.exportTrack(track);
        toast({ title: 'Exported audio file', variant: 'success' });
      } catch (err) {
        showErrorToast(err);
      }
    };
    const confirmDelete = () =>
      openDialog({
        type: 'confirm',
        title: `Delete “${track.title}”?`,
        detail: 'This permanently removes the song and its stored audio from this device.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: () => {
          useLibraryStore
            .getState()
            .deleteTracks([track.id])
            .then(() => toast({ title: 'Song deleted', variant: 'success' }))
            .catch(showErrorToast);
        },
      });

    const primary: MenuSection['items'] = [
      { id: 'play', label: 'Play now', icon: <PlayCircle />, onSelect: playNow },
      { id: 'next', label: 'Play next', icon: <ListStart />, onSelect: playNext },
      { id: 'queue', label: 'Add to queue', icon: <ListPlus />, onSelect: addQueue },
    ];
    const collect: MenuSection['items'] = [
      {
        id: 'like',
        label: track.liked ? 'Remove from Liked Songs' : 'Add to Liked Songs',
        icon: <Heart fill={track.liked ? 'currentColor' : 'none'} />,
        onSelect: toggleLike,
      },
      { id: 'playlist', label: 'Add to playlist', icon: <Plus />, onSelect: addToPlaylist },
    ];
    const info: MenuSection['items'] = [
      { id: 'artist', label: 'Go to artist', icon: <Mic2 />, hidden: track.artist === 'Unknown Artist', onSelect: goToArtist },
      { id: 'album', label: 'Go to album', icon: <Disc3 />, hidden: track.album === 'Unknown Album', onSelect: goToAlbum },
      { id: 'edit', label: 'Edit metadata', icon: <Pencil />, onSelect: editMetadata },
    ];
    const destructive: MenuSection['items'] = [
      { id: 'export', label: 'Export file', icon: <Download />, onSelect: () => void exportFile() },
      { id: 'delete', label: 'Delete from library', icon: <Trash2 />, danger: true, onSelect: confirmDelete },
    ];

    const sections: MenuSection[] = [
      { id: 'primary', items: primary },
      { id: 'collect', items: collect },
      { id: 'info', items: info },
      { id: 'destructive', items: destructive },
    ];
    if (options.extraSections?.length) {
      sections.splice(1, 0, ...options.extraSections);
    }
    return sections;
  }, [track, options.extraSections, navigate, setLiked, openDialog, toast]);
}
