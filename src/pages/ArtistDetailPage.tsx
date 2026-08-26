import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mic2 } from 'lucide-react';
import type { Track } from '@/types';
import { useLibraryStore } from '@/stores/libraryStore';
import { CollectionPage } from '@/components/library/CollectionPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShelfRow, albumCard } from '@/components/library/Shelf';
import { IconButton } from '@/components/ui/IconButton';

export default function ArtistDetailPage() {
  const { id = '' } = useParams();
  const artist = useLibraryStore((s) => s.artists.find((a) => a.id === decodeURIComponent(id)));
  const tracks = useLibraryStore((s) => s.tracks);
  const albums = useLibraryStore((s) => s.albums);

  const artistTracks: Track[] = useMemo(() => {
    if (!artist) return [];
    return tracks
      .filter((t) => t.artistId === artist.id)
      .sort(
        (a, b) =>
          a.album.localeCompare(b.album) ||
          (a.trackNumber ?? 9999) - (b.trackNumber ?? 9999)
      );
  }, [artist, tracks]);

  const artistAlbums = useMemo(() => {
    if (!artist) return [];
    return albums.filter((a) =>
      artistTracks.some((t) => t.albumId === a.id)
    );
  }, [artist, albums, artistTracks]);

  if (!artist) {
    return (
      <EmptyState
        icon={Mic2}
        title="Artist not found"
        detail="It may have been removed from your library."
        actions={
          <Link to="/library/artists" className="text-sm text-accent hover:underline">
            Browse artists
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
      title={artist.name}
      lines={['Artist']}
      artworkId={artist.artworkId}
      name={artist.name}
      round
      tracks={artistTracks}
    >
      {artistAlbums.length > 1 && (
        <div className="-mx-1 mt-2">
          <ShelfRow title="Albums">{artistAlbums.map(albumCard)}</ShelfRow>
        </div>
      )}
    </CollectionPage>
    </>
  );
}
