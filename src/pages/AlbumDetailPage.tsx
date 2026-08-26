import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Disc3 } from 'lucide-react';
import type { Track } from '@/types';
import { useLibraryStore } from '@/stores/libraryStore';
import { CollectionPage } from '@/components/library/CollectionPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShelfRow, albumCard } from '@/components/library/Shelf';
import { IconButton } from '@/components/ui/IconButton';

export default function AlbumDetailPage() {
  const { id = '' } = useParams();
  const album = useLibraryStore((s) => s.albums.find((a) => a.id === decodeURIComponent(id)));
  const trackMap = useLibraryStore((s) => s.trackMap);
  const allAlbums = useLibraryStore((s) => s.albums);

  const tracks: Track[] = useMemo(() => {
    if (!album) return [];
    const resolved = album.trackIds
      .map((tid) => trackMap.get(tid))
      .filter((t): t is Track => !!t);
    return resolved.sort((a, b) => (a.trackNumber ?? 9999) - (b.trackNumber ?? 9999));
  }, [album, trackMap]);

  const moreByArtist = useMemo(() => {
    if (!album) return [];
    return allAlbums.filter((a) => a.artist === album.artist && a.id !== album.id).slice(0, 12);
  }, [album, allAlbums]);

  if (!album) {
    return (
      <EmptyState
        icon={Disc3}
        title="Album not found"
        detail="It may have been removed from your library."
        actions={
          <Link to="/library/albums" className="text-sm text-accent hover:underline">
            Browse albums
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4">
        <IconButton label="Back" size="sm" variant="solid" onClick={() => window.history.back()}>
          <ArrowLeft />
        </IconButton>
      </div>
      <CollectionPage
      title={album.name}
      lines={['Album', album.artist, album.year ? String(album.year) : '', album.genre ?? '']}
      artworkId={album.artworkId}
      name={album.name}
      tracks={tracks}
    >
      {moreByArtist.length > 0 && (
        <div className="-mx-1 mt-2">
          <ShelfRow title={`More by ${album.artist}`}>{moreByArtist.map(albumCard)}</ShelfRow>
        </div>
      )}
    </CollectionPage>
    </>
  );
}
