import { motion } from 'framer-motion';
import { Download, FolderOpen, HardDrive, Heart, ShieldCheck, WifiOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';
import { db, SETTINGS_KEYS } from '@/db/database';

const POINTS = [
  { icon: HardDrive, text: 'Your library is stored locally on this device' },
  { icon: ShieldCheck, text: 'No account required — nothing leaves your device' },
  { icon: WifiOff, text: 'Playback, search and playlists all work offline' },
  { icon: Heart, text: 'You control your data, always' },
] as const;

/** Short, warm first-launch experience. */
export function WelcomeDialog() {
  const dialog = useUiStore((s) => s.dialog);
  const openDialog = useUiStore((s) => s.openDialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  if (dialog.type !== 'welcome') return null;

  const finish = (next?: 'addMusic') => {
    void db.settings.put({ key: SETTINGS_KEYS.ONBOARDED, value: Date.now() });
    closeDialog();
    if (next) openDialog({ type: next });
  };

  return (
    <Modal open onClose={finish} hideClose>
      <div className="pb-1 pt-2 text-center sm:text-left">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          aria-hidden
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl sm:mx-0"
          style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 40%, #38e8c6))' }}
        >
          <span className="text-3xl">🎧</span>
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Localify</h1>
        <p className="mt-1.5 text-[15px] text-fg-muted">
          Your music. Your device. Your library.
        </p>

        <ul className="mt-6 space-y-3">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-fg-muted">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                <Icon className="size-4 text-accent" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <Button variant="accent" size="lg" onClick={() => finish('addMusic')} className="flex-1">
            <FolderOpen className="size-[18px]" /> Import Music
          </Button>
          <Button variant="outline" size="lg" onClick={() => finish('addMusic')} className="flex-1">
            <Download className="size-[18px]" /> From a Link
          </Button>
        </div>
        <button
          type="button"
          onClick={() => finish()}
          className="mt-4 w-full py-1 text-center text-[13px] text-fg-faint hover:text-fg-muted"
        >
          I'll explore on my own
        </button>
      </div>
    </Modal>
  );
}
