import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { clsx } from '@/utils/clsx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  /** Extra width for content-heavy dialogs. */
  wide?: boolean;
  hideClose?: boolean;
}

/**
 * Centered modal with backdrop blur, escape handling and basic focus
 * containment. Mobile-friendly: becomes a near-full-height card on small
 * screens.
 */
export function Modal({ open, onClose, title, children, wide, hideClose }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const t = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('input, button')?.focus();
    }, 60);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className={clsx(
              'relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface-1 p-5 shadow-2xl sm:max-h-[86vh] sm:rounded-2xl',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
            )}
          >
            {(title || !hideClose) && (
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">{title}</h2>
                {!hideClose && (
                  <IconButton label="Close dialog" size="sm" onClick={onClose}>
                    <X />
                  </IconButton>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
