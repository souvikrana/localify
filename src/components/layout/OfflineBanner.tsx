import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** Reassures users that offline mode is a first-class state, not an error. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden border-b border-amber-500/20 bg-amber-500/10"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-[13px] text-amber-300">
            <CloudOff className="size-4" />
            <span>
              You're offline — your local library, search and playback all still work.
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
