import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { Track } from '@/types';
import { LibraryService } from '@/services/library/LibraryService';
import { useLibraryStore } from '@/stores/libraryStore';
import { TrackListVirtual } from '@/components/library/TrackListVirtual';
import { EmptyState } from '@/components/ui/EmptyState';

/** Playback history — the last distinct tracks you listened to. */
export default function RecentlyPlayedPage() {
  const loaded = useLibraryStore((s) => s.loaded);
  const tracks = useLibraryStore((s) => s.tracks);
  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (!loaded) return;
    void LibraryService.getRecentlyPlayed(200).then(setHistoryTracks);
  }, [loaded, tracks]);

  if (historyTracks.length === 0) {
    return (
      <EmptyState
        icon={Clock3}
        title="Nothing played yet"
        detail="Songs you listen to will show up here. Your history never leaves this device."
      />
    );
  }

  return (
    <>
      <p className="mb-2 text-[13px] text-fg-muted">
        Your last {historyTracks.length} played song{historyTracks.length === 1 ? '' : 's'} · stored
        locally only
      </p>
      <TrackListVirtual tracks={historyTracks} rowHeight={60} />
    </>
  );
}
