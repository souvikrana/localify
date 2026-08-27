import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileAudio,
  FolderUp,
  Info,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { X, Link2 } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useImportStore } from '@/stores/importStore';
import { resolveDownloader, explainYouTubeLimitation } from '@/services/downloader';
import { useLibraryStore } from '@/stores/libraryStore';
import { LibraryService } from '@/services/library/LibraryService';
import { looksLikeAudio, SUPPORTED_EXTENSIONS } from '@/services/library/MetadataService';
import type { DownloadProgress, TrackMetadata } from '@/types';
import { AppError } from '@/utils/errors';
import { formatBytes } from '@/utils/format';

type Tab = 'files' | 'link';

interface LinkState {
  url: string;
  phase: 'idle' | 'previewing' | 'preview' | 'downloading' | 'done' | 'error' | 'blocked';
  metadata?: TrackMetadata;
  progress?: DownloadProgress;
  error?: string;
}

/**
 * Add Music: local file import (picker + drag-drop + folder) and the URL
 * downloader with honest capability handling.
 */
export function AddMusicDialog() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const importActive = useImportStore((s) => s.active);
  const importProgress = useImportStore((s) => s.progress);

  const [tab, setTab] = useState<Tab>('files');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [link, setLink] = useState<LinkState>({ url: '', phase: 'idle' });

  if (dialog.type !== 'addMusic') return null;

  const startFilePicker = () => fileInputRef.current?.click();
  const startFolderPicker = () => folderInputRef.current?.click();

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const audioFiles = Array.from(files).filter(looksLikeAudio);
    void useImportStore.getState().runImport(audioFiles);
  };

  return (
    <Modal open wide onClose={closeDialog} title="Add music">
      {/* Tabs */}
      <div className="mb-4 flex rounded-xl bg-surface-2 p-1" role="tablist">
        {(
          [
            { id: 'files', label: 'Import files', icon: UploadCloud },
            { id: 'link', label: 'From a link', icon: Link2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              if (id !== 'link') setLink({ url: '', phase: 'idle' });
            }}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === id ? 'text-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {tab === id && (
              <motion.span
                layoutId="addmusic-tab"
                className="absolute inset-0 rounded-lg bg-surface-3 shadow"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative size-4" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'files' ? (
        <>
          <DropZone onFiles={handleFiles} dragOver={dragOver} setDragOver={setDragOver} onStartPicker={startFilePicker} />

          <div className="mt-3 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={startFolderPicker} className="text-fg-muted">
              <FolderUp className="size-4" /> Import a whole folder
            </Button>
            <p className="hidden text-xs text-fg-faint sm:block">
              Large libraries: imports run in the background — keep this tab open.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.oga,.opus,.webm,.weba,.aif,.aiff"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            hidden
            multiple
            // @ts-expect-error non-standard but widely supported directory picker
            webkitdirectory=""
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <AnimatePresence>
            {(importActive || importProgress) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Importing music… {importProgress ? `${importProgress.completed}/${importProgress.total}` : ''}
                    </span>
                    {importActive && <Loader2 className="size-4 animate-spin text-accent" />}
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      animate={{
                        width: `${
                          importProgress && importProgress.total > 0
                            ? (importProgress.completed / importProgress.total) * 100
                            : 0
                        }%`,
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                  {importProgress?.currentFile && (
                    <p className="mt-2 truncate text-xs text-fg-faint">
                      Currently processing: {importProgress.currentFile}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <LinkTab link={link} setLink={setLink} onSwitchToFiles={() => setTab('files')} />
      )}
    </Modal>
  );
}

function DropZone({
  onFiles,
  dragOver,
  setDragOver,
  onStartPicker,
}: {
  onFiles: (files: FileList | null) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onStartPicker: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStartPicker}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition-colors ${
        dragOver ? 'border-accent bg-accent/10' : 'border-line-strong hover:border-fg-faint'
      }`}
    >
      <UploadCloud
        className={`size-10 ${dragOver ? 'text-accent' : 'text-fg-faint'}`}
        strokeWidth={1.5}
      />
      <span className="text-base font-medium">Drop your music here</span>
      <span className="-mt-1.5 text-[13px] text-fg-muted">or click to choose files</span>
      <span className="mt-1 text-xs text-fg-faint">
        MP3 · FLAC · WAV · M4A · AAC · OGG · Opus — up to {SUPPORTED_EXTENSIONS.length} formats
      </span>
    </button>
  );
}

function LinkTab({
  link,
  setLink,
  onSwitchToFiles,
}: {
  link: LinkState;
  setLink: React.Dispatch<React.SetStateAction<LinkState>>;
  onSwitchToFiles: () => void;
}) {
  const toast = useUiStore((s) => s.toast);
  const abortRef = useRef<AbortController | null>(null);

  const preview = useCallback(async () => {
    const url = link.url.trim();
    const downloader = resolveDownloader(url);
    if (!url || !downloader) {
      setLink((s) => ({ ...s, phase: 'error', error: 'Paste a valid http(s) link to audio or a YouTube video.' }));
      return;
    }
    setLink((s) => ({ ...s, phase: 'previewing' }));
    try {
      const metadata = await downloader.getMetadata(url);
      const isBlocked = downloader.id === 'youtube' && !(metadata as { serverAvailable?: boolean }).serverAvailable;
      setLink((s) => ({ ...s, phase: isBlocked ? 'blocked' : 'preview', metadata }));
    } catch (err) {
      setLink((s) => ({
        ...s,
        phase: 'error',
        error: err instanceof Error ? err.message : 'Could not read that link.',
      }));
    }
  }, [link.url, setLink]);

  const startDownload = async () => {
    const url = link.url.trim();
    const downloader = resolveDownloader(url);
    if (!downloader) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLink((s) => ({ ...s, phase: 'downloading', progress: { phase: 'downloading', progress: 0 } }));
    try {
      const result = await downloader.download(
        url,
        (progress) => setLink((s) => ({ ...s, progress })),
        controller.signal
      );
      await finishDownload(result.blob, result.suggestedFilename, result.metadata, url);
      setLink((s) => ({ ...s, phase: 'done' }));
    } catch (err) {
      if (controller.signal.aborted) {
        setLink((s) => ({ ...s, phase: 'preview' }));
        return;
      }
      setLink((s) => ({
        ...s,
        phase: 'error',
        error:
          err instanceof AppError
            ? err.message
            : 'Download failed. The site may block cross-origin downloads.',
      }));
    }
  };

  const finishDownload = async (
    blob: Blob,
    filename: string,
    metadata: TrackMetadata,
    url: string
  ) => {
    const track = await LibraryService.addFromBlob(blob, {
      filename,
      title: metadata.title,
      artist: metadata.artist,
      source: 'url',
      sourceUrl: url,
    });
    if (!track) {
      toast({ title: 'Already in your library', variant: 'info' });
      return;
    }
    useLibraryStore.getState().addTracks([track]);
    toast({ title: `Added “${track.title}”`, variant: 'success' });
  };

  const isYouTube = /youtu\.?be/i.test(link.url);
  const limitation = explainYouTubeLimitation();
  const totalBytes =
    link.progress?.totalBytes ?? undefined;
  const receivedBytes = link.progress?.receivedBytes ?? undefined;

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void preview();
        }}
        className="flex gap-2"
      >
        <input
          type="url"
          value={link.url}
          onChange={(e) => setLink((s) => ({ ...s, url: e.target.value, phase: 'idle' }))}
          placeholder="https://… paste an audio file or YouTube link"
          aria-label="Audio or video URL"
          spellCheck={false}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 text-sm outline-none placeholder:text-fg-faint focus:border-accent"
        />
        <Button type="submit" variant="accent" disabled={!link.url.trim() || link.phase === 'previewing'}>
          {link.phase === 'previewing' ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Check
        </Button>
      </form>

      {link.phase === 'error' && (
        <Notice icon={AlertTriangle} tone="danger" text={link.error ?? 'Something went wrong.'} />
      )}

      {(link.phase === 'preview' || link.phase === 'blocked' || link.phase === 'downloading' || link.phase === 'done') && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-3">
            {link.metadata?.thumbnailUrl ? (
              <img src={link.metadata.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <FileAudio className="size-6 text-fg-faint" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{link.metadata?.title}</p>
            <p className="truncate text-xs text-fg-muted">{link.metadata?.artist ?? 'Unknown artist'}</p>
          </div>
          {link.phase === 'done' && (
            <span className="ml-auto shrink-0 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
              ✓ Added to library
            </span>
          )}
        </div>
      )}

      {link.phase === 'downloading' && (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Downloading…</span>
            <IconButton label="Cancel download" size="xs" onClick={() => abortRef.current?.abort()}>
              <X />
            </IconButton>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${Math.round(link.progress?.progress ?? 0)}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="mt-2 text-xs tabular-nums text-fg-faint">
            {receivedBytes !== undefined ? formatBytes(receivedBytes) : ''}
            {totalBytes !== undefined ? ` / ${formatBytes(totalBytes)}` : ''}
          </p>
        </div>
      )}

      {link.phase === 'blocked' && isYouTube && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Info className="size-4" /> {limitation.title}
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-amber-200/85">
            {limitation.detail.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="surface" size="sm" onClick={onSwitchToFiles}>
              <UploadCloud className="size-4" /> Import files instead
            </Button>
          </div>
        </div>
      )}

      {link.phase === 'preview' && (
        <Button variant="accent" onClick={() => void startDownload()} className="w-full">
          <Download className="size-4" /> Download to library
        </Button>
      )}

      <p className="px-1 text-xs leading-relaxed text-fg-faint">
        Direct links to audio files (.mp3, .m4a, .flac…) download fully in-browser when the source
        allows cross-origin requests. Everything you add is stored locally and plays offline forever.
      </p>
    </div>
  );
}

function Notice({
  icon: Icon,
  tone,
  text,
}: {
  icon: typeof Info;
  tone: 'danger' | 'info';
  text: string;
}) {
  return (
    <p
      className={`flex items-start gap-2 rounded-xl p-3.5 text-[13px] ${
        tone === 'danger'
          ? 'border border-danger/30 bg-danger/10 text-danger'
          : 'border border-line bg-surface-2 text-fg-muted'
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );
}
