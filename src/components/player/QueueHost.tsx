import { AnimatePresence, motion } from 'framer-motion';
import { useUiStore } from '@/stores/uiStore';
import { QueuePanel } from './QueuePanel';

/** Desktop-only right drawer hosting the queue panel. */
export function QueueHost() {
  const open = useUiStore((s) => s.queueOpen);
  const setOpen = useUiStore((s) => s.setQueueOpen);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="queue"
          aria-label="Play queue"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 340 }}
          className="fixed bottom-[84px] right-0 top-0 z-40 hidden w-[340px] border-l border-line bg-surface-1/95 backdrop-blur-xl lg:block"
        >
          <QueuePanel onClose={() => setOpen(false)} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
