import { create } from 'zustand';
import { SETTINGS_KEYS } from '@/db/database';
import { LibraryService } from '@/services/library/LibraryService';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ToastVariant = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  title: string;
  detail?: string;
  variant: ToastVariant;
}

export type DialogState =
  | { type: 'none' }
  | { type: 'welcome' }
  | { type: 'addMusic' }
  | { type: 'createPlaylist' }
  | { type: 'editMetadata'; trackId: string }
  | { type: 'addToPlaylist'; trackIds: string[] }
  | { type: 'confirm'; title: string; detail?: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }
  | { type: 'shortcuts' };

interface UiState {
  theme: ThemePreference;
  accent: string;
  nowPlayingOpen: boolean;
  queueOpen: boolean;
  dialog: DialogState;
  toasts: Toast[];

  initTheme: () => Promise<void>;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: string) => void;

  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  setQueueOpen: (open: boolean) => void;
  openDialog: (dialog: DialogState) => void;
  closeDialog: () => void;

  toast: (toast: Omit<Toast, 'id'> & { id?: string }) => void;
  dismissToast: (id: string) => void;
}

export const ACCENTS = [
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Teal', value: '#2dd4bf' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#fb7185' },
  { name: 'Sky', value: '#38bdf8' },
];

const systemDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

function applyTheme(theme: ThemePreference, accent?: string): void {
  const dark = theme === 'dark' || (theme === 'system' && systemDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (accent) {
    document.documentElement.style.setProperty('--accent', accent);
  } else {
    document.documentElement.style.removeProperty('--accent');
  }
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'dark',
  accent: '',
  nowPlayingOpen: false,
  queueOpen: false,
  dialog: { type: 'none' },
  toasts: [],

  initTheme: async () => {
    const [theme, accent] = await Promise.all([
      LibraryService.getSetting<ThemePreference>(SETTINGS_KEYS.THEME, 'dark'),
      LibraryService.getSetting<string>(SETTINGS_KEYS.ACCENT, ''),
    ]);
    set({ theme, accent });
    applyTheme(theme, accent || undefined);

    if (theme === 'system') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (get().theme === 'system') applyTheme('system');
      });
    }
  },

  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    void LibraryService.setSetting(SETTINGS_KEYS.THEME, theme);
  },

  setAccent: (accent) => {
    set({ accent });
    applyTheme(get().theme, accent || undefined);
    void LibraryService.setSetting(SETTINGS_KEYS.ACCENT, accent);
  },

  openNowPlaying: () => set({ nowPlayingOpen: true }),
  closeNowPlaying: () => set({ nowPlayingOpen: false }),
  setQueueOpen: (open) => set({ queueOpen: open }),

  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: { type: 'none' } }),

  toast: ({ id, title, detail, variant = 'info' }) => {
    toastSeq += 1;
    const toastId = id ?? `toast-${Date.now()}-${toastSeq}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { id: toastId, title, detail, variant }],
    }));
    setTimeout(() => get().dismissToast(toastId), variant === 'error' ? 6500 : 4200);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** One-liner for services/components that just want to show a friendly error. */
export function showErrorToast(err: unknown): void {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Something went wrong';
  useUiStore.getState().toast({ title: message, variant: 'error' });
}
