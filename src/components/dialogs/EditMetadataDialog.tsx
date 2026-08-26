import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Track } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Artwork } from '@/components/ui/Artwork';
import { useUiStore, showErrorToast } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';

interface FormState {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year: string;
}

export function EditMetadataDialog() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const track = useLibraryStore((s) =>
    dialog.type === 'editMetadata' ? s.trackMap.get(dialog.trackId) : undefined
  );

  if (dialog.type !== 'editMetadata') return null;

  // Keyed by track id so the form state resets cleanly per target.
  return (
    <Modal open onClose={closeDialog} title="Edit song">
      {track ? (
        <EditForm key={track.id} track={track} onDone={closeDialog} />
      ) : (
        <p className="text-sm text-fg-muted">This song is no longer in your library.</p>
      )}
    </Modal>
  );
}

function EditForm({ track, onDone }: { track: Track; onDone: () => void }) {
  const updateTrackMetadata = useLibraryStore((s) => s.updateTrackMetadata);

  const [form, setForm] = useState<FormState>(() => ({
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist ?? '',
    genre: track.genre ?? '',
    year: track.year ? String(track.year) : '',
  }));
  const [artworkBlob, setArtworkBlob] = useState<Blob>();
  const [artworkPreview, setArtworkPreview] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickArtwork = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setArtworkBlob(file);
    if (artworkPreview) URL.revokeObjectURL(artworkPreview);
    setArtworkPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    try {
      await updateTrackMetadata(track.id, {
        title: form.title,
        artist: form.artist,
        album: form.album,
        albumArtist: form.albumArtist,
        genre: form.genre,
        year: form.year ? Number(form.year) : undefined,
        artworkBlob,
      });
      onDone();
    } catch (err) {
      showErrorToast(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative size-24 shrink-0 overflow-hidden rounded-xl"
          aria-label="Change artwork"
        >
          {artworkPreview ? (
            <img src={artworkPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Artwork artworkId={track.artworkId} name={track.title} size="thumb" rounded="none" iconFallback />
          )}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ImagePlus className="size-5" />
            Change art
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pickArtwork(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="text-xs leading-relaxed text-fg-faint">
          Edits apply to your library only — the original audio file is never modified.
        </p>
      </div>

      <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Artist" value={form.artist} onChange={(v) => setForm({ ...form, artist: v })} />
        <Field label="Album" value={form.album} onChange={(v) => setForm({ ...form, album: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Genre" value={form.genre} onChange={(v) => setForm({ ...form, genre: v })} />
        <Field
          label="Year"
          value={form.year}
          inputMode="numeric"
          onChange={(v) => setForm({ ...form, year: v.replace(/[^\d]/g, '').slice(0, 4) })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="accent" onClick={() => void submit()} disabled={!form.title.trim()}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  autoFocus,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  inputMode?: 'text' | 'numeric';
}) {
  const id = `edit-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-fg-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        inputMode={inputMode}
        maxLength={300}
        className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
