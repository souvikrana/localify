import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';

export function CreatePlaylistDialog() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  if (dialog.type !== 'createPlaylist') return null;

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await useLibraryStore.getState().createPlaylist(name, description);
      closeDialog();
      if (created) navigate(`/playlists/${created.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={closeDialog} title="Create playlist">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="playlist-name" className="mb-1.5 block text-[13px] font-medium text-fg-muted">
            Name
          </label>
          <input
            id="playlist-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Late Night Coding"
            autoFocus
            maxLength={120}
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm outline-none placeholder:text-fg-faint focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="playlist-desc" className="mb-1.5 block text-[13px] font-medium text-fg-muted">
            Description <span className="font-normal text-fg-faint">(optional)</span>
          </label>
          <textarea
            id="playlist-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deep focus music"
            rows={3}
            maxLength={400}
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-fg-faint focus:border-accent"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={!name.trim() || busy}>
            Create playlist
          </Button>
        </div>
      </form>
    </Modal>
  );
}
