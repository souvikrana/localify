import { useMemo } from 'react';
import { Mic2 } from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { artistCard } from '@/components/library/Shelf';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';

export default function ArtistsPage() {
  const artists = useLibraryStore((s) => s.artists);
  const loaded = useLibraryStore((s) => s.loaded);

  const sorted = useMemo(
    () => [...artists].sort((a, b) => a.name.localeCompare(b.name)),
    [artists]
  );

  if (!loaded) return <SkeletonCardGrid count={10} />;
  if (sorted.length === 0) {
    return <EmptyState icon={Mic2} title="No artists yet" detail="Artists are grouped automatically from your imported songs." />;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {sorted.map(artistCard)}
    </div>
  );
}
