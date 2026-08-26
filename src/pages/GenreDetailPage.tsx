import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AudioLines } from 'lucide-react';
import type { Track } from '@/types';
import { useLibraryStore } from '@/stores/libraryStore';
import { groupTracksByGenre } from '@/services/library/LibraryService';
import { CollectionPage } from '@/components/library/CollectionPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';

export default function GenreDetailPage() {
  const { key = '' } = useParams();
  const tracks = useLibraryStore((s) => s.tracks);

  const genre = useMemo(() => groupTracksByGenre(tracks).find((g) => g.key === decodeURIComponent(key)), [tracks, key]);

  const genreTracks: Track[] = useMemo(() => {
    if (!genre) return [];
    return genre.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t)
      .sort((a, b) => b.playCount - a.playCount);
  }, [genre, tracks]);

  if (!genre) {
    return (
      <EmptyState
        icon={AudioLines}
        title="Genre not found"
        detail="It may no longer contain any songs."
        actions={
          <Link to="/library/genres" className="text-sm text-accent hover:underline">
            Browse genres
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
      title={genre.label}
      lines={['Genre']}
      artworkId={genre.artworkId}
      name={genre.label}
      tracks={genreTracks}
    >
    </CollectionPage>
    </>
  );
}
