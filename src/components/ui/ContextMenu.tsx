import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from '@/utils/clsx';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  hidden?: boolean;
  onSelect: () => void;
}

export interface MenuSection {
  id: string;
  items: MenuItem[];
}

/**
 * Context menu. Desktop: anchored dropdown. Mobile: bottom sheet.
 * Rendered through a portal to escape overflow containers.
 */
export function ContextMenu({
  open,
  onClose,
  anchorPosition,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  /** Anchor point (viewport coords). Required on desktop; ignored on mobile. */
  anchorPosition?: { x: number; y: number };
  sections: MenuSection[];
}) {
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Defer so the opening click doesn't immediately close the menu.
    const timer = setTimeout(() => document.addEventListener('mousedown', onClick), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        key="menu"
        initial={{ opacity: 0, scale: isMobile ? 1 : 0.96, y: isMobile ? 12 : -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
        transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
        style={
          !isMobile && anchorPosition
            ? {
                left: clampToViewportX(anchorPosition.x),
                top: clampToViewportY(anchorPosition.y),
              }
            : undefined
        }
        className={clsx(
          'z-[60] border border-line bg-surface-2 shadow-xl',
          isMobile ? 'fixed inset-x-3 bottom-3 rounded-2xl' : 'fixed min-w-52 rounded-xl py-1.5'
        )}
      >
        <div ref={ref}>
          {sections.map((section, si) => (
            <div key={section.id} className={clsx(si > 0 && 'my-1.5 border-t border-line pt-1.5')}>
              {section.items
                .filter((item) => !item.hidden)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      item.onSelect();
                    }}
                    className={clsx(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      item.danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-surface-3'
                    )}
                  >
                    {item.icon && <span className="[&_svg]:size-4 opacity-80">{item.icon}</span>}
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
          ))}
          {isMobile && (
            <div className="mx-3 my-2 rounded-xl bg-surface-3 py-2.5 text-center text-sm font-medium">
              Cancel
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

function clampToViewportX(x: number): number {
  return Math.min(x, window.innerWidth - 230);
}

function clampToViewportY(y: number): number {
  return Math.min(y, window.innerHeight - 200);
}
