import { useMemo } from 'react';
import type { Track } from '@/types';
import { useLibraryStore } from '@/stores/libraryStore';

/**
 * Resolves a list of track ids into Track objects using the library cache,
 * preserving order and dropping deleted tracks. Cheap because the whole
 * library metadata already lives in memory.
 */
export function useResolvedTracks(ids: readonly string[] | undefined): Track[] {
  const trackMap = useLibraryStore((s) => s.trackMap);
  return useMemo(() => {
    if (!ids) return [];
    const out: Track[] = [];
    for (const id of ids) {
      const track = trackMap.get(id);
      if (track) out.push(track);
    }
    return out;
  }, [ids, trackMap]);
}
