import { create } from 'zustand';
import type { Track } from '@/types';
import { db } from '@/db/database';
import {
  LibraryService,
  type DuplicateCandidate,
  type ImportProgress,
  type ImportSummary,
} from '@/services/library/LibraryService';
import { useLibraryStore } from './libraryStore';
import { useUiStore } from './uiStore';

interface ImportState {
  active: boolean;
  progress: ImportProgress | null;
  /** Set when a duplicate needs a decision; the dialog reacts to this. */
  pendingDuplicate: DuplicateCandidate | null;
  resolveDuplicate: ((choice: 'keep' | 'skip') => void) | null;

  runImport: (files: File[]) => Promise<void>;
  answerDuplicate: (choice: 'keep' | 'skip') => void;
}

/**
 * Drives the multi-file import pipeline with live progress and duplicate
 * decisions. The UI never calls LibraryService.importFiles directly.
 */
export const useImportStore = create<ImportState>((set, get) => ({
  active: false,
  progress: null,
  pendingDuplicate: null,
  resolveDuplicate: null,

  runImport: async (files) => {
    const ui = useUiStore.getState();
    if (get().active) {
      ui.toast({ title: 'An import is already running', variant: 'info' });
      return;
    }
    set({ active: true, progress: { completed: 0, total: files.length, currentFile: files[0]?.name ?? '' } });

    try {
      const summary: ImportSummary = await LibraryService.importFiles(files, {
        onProgress: (progress) => set({ progress }),
        onDuplicate: (candidate) =>
          new Promise<'keep' | 'skip'>((resolve) => {
            set({ pendingDuplicate: candidate, resolveDuplicate: resolve });
          }),
      });

      if (summary.added.length > 0) {
        useLibraryStore.getState().addTracks(summary.added as Track[]);
        // Album/artist aggregates changed too — refresh them cheaply.
        const [albums, artists] = await Promise.all([db.albums.toArray(), db.artists.toArray()]);
        useLibraryStore.setState({ albums, artists });
      }

      if (summary.added.length > 0) {
        ui.toast({
          title:
            summary.added.length === 1
              ? `Added “${truncate(summary.added[0]!.title)}”`
              : `Added ${summary.added.length} songs`,
          variant: 'success',
        });
      }
      if (summary.skipped > 0) {
        ui.toast({ title: `${summary.skipped} duplicate${summary.skipped === 1 ? '' : 's'} skipped`, variant: 'info' });
      }
      for (const failure of summary.failed.slice(0, 3)) {
        ui.toast({ title: failure.filename, detail: failure.reason, variant: 'error' });
      }
      if (summary.failed.length > 3) {
        ui.toast({ title: `${summary.failed.length - 3} more files failed to import`, variant: 'error' });
      }
    } catch (err) {
      console.error('[importStore] import crashed', err);
      ui.toast({ title: 'Import failed unexpectedly', variant: 'error' });
    } finally {
      set({ active: false, progress: null });
    }
  },

  answerDuplicate: (choice) => {
    const { resolveDuplicate } = get();
    set({ pendingDuplicate: null, resolveDuplicate: null });
    resolveDuplicate?.(choice);
  },
}));

function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
