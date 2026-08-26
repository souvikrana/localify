import { useMemo } from 'react';
import { Disc3 } from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { albumCard } from '@/components/library/Shelf';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';

export default function AlbumsPage() {
  const albums = useLibraryStore((s) => s.albums);
  const loaded = useLibraryStore((s) => s.loaded);

  const sorted = useMemo(() => [...albums].sort((a, b) => a.name.localeCompare(b.name)), [albums]);

  if (!loaded) return <SkeletonCardGrid count={10} />;
  if (sorted.length === 0) {
    return <EmptyState icon={Disc3} title="No albums yet" detail="Albums appear here once you import music with album tags." />;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {sorted.map(albumCard)}
    </div>
  );
}
