import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { groupTracksByGenre } from '@/services/library/LibraryService';
import { Artwork } from '@/components/ui/Artwork';
import { EmptyState } from '@/components/ui/EmptyState';

export default function GenresPage() {
  const tracks = useLibraryStore((s) => s.tracks);
  const loaded = useLibraryStore((s) => s.loaded);

  const genres = useMemo(() => groupTracksByGenre(tracks), [tracks]);

  if (!loaded || genres.length === 0) {
    return (
      <EmptyState
        icon={AudioLines}
        title="No genres yet"
        detail="Genres are read from your files' tags. Songs without a genre land in “Unknown Genre”."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {genres.map((genre) => (
        <Link
          key={genre.key}
          to={`/genres/${encodeURIComponent(genre.key)}`}
          className="group relative overflow-hidden rounded-xl border border-line transition-transform hover:-translate-y-0.5"
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-90"
            style={{
              background: `linear-gradient(135deg, hsl(${(genre.key.length * 47) % 360} 45% 24%), hsl(${(genre.key.length * 47 + 70) % 360} 50% 12%))`,
            }}
          />
          <div className="relative p-4">
            <p className="text-[15px] font-bold text-white drop-shadow">{genre.label}</p>
            <p className="mt-0.5 text-xs text-white/75">
              {genre.trackCount} song{genre.trackCount === 1 ? '' : 's'}
            </p>
            <span className="mt-3 block h-14 w-14 overflow-hidden rounded-lg shadow-lg">
              <Artwork artworkId={genre.artworkId} name={genre.label} size="thumb" rounded="none" iconFallback />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
