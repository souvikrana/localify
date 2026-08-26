import { useUiStore } from '@/stores/uiStore';
import { WelcomeDialog } from './WelcomeDialog';
import { AddMusicDialog } from './AddMusicDialog';
import { CreatePlaylistDialog } from './CreatePlaylistDialog';
import { EditMetadataDialog } from './EditMetadataDialog';
import { AddToPlaylistDialog } from './AddToPlaylistDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ShortcutsDialog } from './ShortcutsDialog';

/** Single mount point that renders whichever dialog is active. */
export function DialogHost() {
  const dialog = useUiStore((s) => s.dialog);
  // All dialogs self-gate on dialog.type; mounting them all keeps this simple
  // and lets each manage its own local state lifecycle.
  void dialog;
  return (
    <>
      <WelcomeDialog />
      <AddMusicDialog />
      <CreatePlaylistDialog />
      <EditMetadataDialog />
      <AddToPlaylistDialog />
      <ConfirmDialog />
      <ShortcutsDialog />
    </>
  );
}
