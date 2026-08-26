import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';

export function ConfirmDialog() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  if (dialog.type !== 'confirm') return null;

  return (
    <Modal open onClose={closeDialog} hideClose={false}>
      <h2 className="text-lg font-semibold">{dialog.title}</h2>
      {dialog.detail && <p className="mt-2 text-sm leading-relaxed text-fg-muted">{dialog.detail}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button
          variant={dialog.danger ? 'danger' : 'accent'}
          onClick={() => {
            dialog.onConfirm();
            closeDialog();
          }}
        >
          {dialog.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Modal>
  );
}
