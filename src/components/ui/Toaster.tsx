import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useUiStore, type ToastVariant } from '@/stores/uiStore';

const ICONS: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: TriangleAlert,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: 'text-fg-muted',
  success: 'text-emerald-400',
  error: 'text-danger',
};

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3 sm:left-auto sm:right-4 sm:items-end"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-line bg-surface-2/95 p-3.5 shadow-lg backdrop-blur"
            >
              <Icon className={`mt-0.5 size-[18px] shrink-0 ${VARIANT_STYLES[toast.variant]}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{toast.title}</p>
                {toast.detail && (
                  <p className="mt-0.5 line-clamp-2-fix text-[13px] text-fg-muted">{toast.detail}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="-m-1 rounded-full p-1 text-fg-faint hover:text-fg"
                onClick={() => dismiss(toast.id)}
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
