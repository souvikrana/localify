import { Modal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/uiStore';
import { isMacLike } from '@/utils/platform';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Playback',
    items: [
      ['Space', 'Play / pause'],
      ['Shift + →', 'Next track'],
      ['Shift + ←', 'Previous track'],
      ['→', 'Seek forward 10s'],
      ['←', 'Seek back 10s'],
    ],
  },
  {
    title: 'General',
    items: [
      ['Ctrl/⌘ K', 'Open search'],
      ['M', 'Mute / unmute'],
      ['↑ / ↓', 'Volume up / down'],
    ],
  },
];

export function ShortcutsDialog() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  if (dialog.type !== 'shortcuts') return null;

  const modKey = isMacLike() ? '⌘' : 'Ctrl';

  return (
    <Modal open onClose={closeDialog} title="Keyboard shortcuts" wide>
      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-fg-faint">
              {group.title}
            </h3>
            <ul className="space-y-2">
              {group.items.map(([keys, description]) => (
                <li key={keys} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-fg-muted">{description.replace('Ctrl/⌘', modKey)}</span>
                  <kbd className="shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs">
                    {keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
