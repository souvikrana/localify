import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import { useImportStore } from '@/stores/importStore';

/**
 * App-wide drop target: dropping audio files anywhere imports them.
 * A full-screen overlay confirms the target while dragging.
 */
export function GlobalDropZone() {
  const [dragDepth, setDragDepth] = useState(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean => [...(e.dataTransfer?.types ?? [])].includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragDepth((d) => d + 1);
    };
    const onDragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      setDragDepth((d) => Math.max(0, d - 1));
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragDepth(0);
      if (e.dataTransfer) void useImportStore.getState().runImport(Array.from(e.dataTransfer.files));
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return (
    <AnimatePresence>
      {dragDepth > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-accent/70 bg-surface-1/90 px-14 py-12">
            <UploadCloud className="size-14 text-accent" strokeWidth={1.25} />
            <p className="text-lg font-semibold">Drop your music here</p>
            <p className="text-sm text-fg-muted">
              MP3, FLAC, WAV, M4A, OGG… they'll be added to your library
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
