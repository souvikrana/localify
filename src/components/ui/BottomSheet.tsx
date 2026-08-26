import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from '@/utils/clsx';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  /** Max height as a fraction of viewport. */
  maxHeightVh?: number;
}

/** Mobile-style bottom sheet with drag-to-dismiss feel (tap backdrop closes). */
export function BottomSheet({ open, onClose, children, label, maxHeightVh = 80 }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 90 && onClose()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            style={{ maxHeight: `${maxHeightVh}dvh` }}
            className={clsx(
              'relative w-full overflow-y-auto rounded-t-2xl border-t border-line bg-surface-1 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]'
            )}
          >
            <div className="sticky top-0 z-10 flex justify-center bg-gradient-to-b from-surface-1 to-transparent pt-2.5 pb-2">
              <span className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
