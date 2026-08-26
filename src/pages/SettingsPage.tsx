import { useEffect, useState } from 'react';
import {
  Check,
  CloudUpload,
  Database,
  HardDrive,
  Info,
  Keyboard,
  Palette,
  Settings2,
  Trash2,
} from 'lucide-react';
import type { AudioQuality } from '@/types';
import type { ThemePreference } from '@/stores/uiStore';
import { ACCENTS, useUiStore, showErrorToast } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { LibraryService } from '@/services/library/LibraryService';
import { StorageManager } from '@/services/storage/StorageManager';
import { pruneOrphanArtworks } from '@/services/storage/ArtworkStorage';
import { isTranscodingSupported, opusEncoderSupported } from '@/services/audio/Transcoder';
import { SETTINGS_KEYS } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/utils/format';

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const accent = useUiStore((s) => s.accent);
  const setAccent = useUiStore((s) => s.setAccent);
  const toast = useUiStore((s) => s.toast);
  const openDialog = useUiStore((s) => s.openDialog);

  const tracks = useLibraryStore((s) => s.tracks);
  const deleteTracks = useLibraryStore((s) => s.deleteTracks);

  const [quality, setQuality] = useState<AudioQuality>('balanced');
  const [autoConvert, setAutoConvert] = useState(true);
  const [canEncode, setCanEncode] = useState(false);
  const [persistence, setPersistence] = useState<'granted' | 'denied' | 'unsupported'>('unsupported');
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof StorageManager.getUsage>>>();

  useEffect(() => {
    void (async () => {
      setQuality(await LibraryService.getSetting<AudioQuality>(SETTINGS_KEYS.AUDIO_QUALITY, 'balanced'));
      setAutoConvert(await LibraryService.getSetting(SETTINGS_KEYS.AUTO_TRANSCODE_LOSSLESS, true));
      setPersistence(await StorageManager.persistenceState());
      setUsage(await StorageManager.getUsage(true));
    })();
  }, []);

  useEffect(() => {
    if (isTranscodingSupported()) void opusEncoderSupported().then(setCanEncode);
  }, []);

  const largest = [...tracks].sort((a, b) => b.fileSize - a.fileSize).slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>

      <Section icon={Palette} title="Appearance">
        <Row label="Theme">
          <SegmentedControl
            value={theme}
            onChange={(v) => setTheme(v as ThemePreference)}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Row>
        <Row label="Accent color">
          <div className="flex gap-2" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map(({ name, value }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={accent === value}
                aria-label={`${name} accent`}
                title={name}
                onClick={() => setAccent(value)}
                className={`flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                  accent === value ? 'ring-2 ring-fg ring-offset-2 ring-offset-bg' : ''
                }`}
                style={{ background: value }}
              >
                {accent === value && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section icon={HardDrive} title="Storage">
        <div className="rounded-xl border border-line bg-surface-1 p-4">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
            <dt className="text-fg-muted">Music ({tracks.length.toLocaleString()} songs)</dt>
            <dd className="text-right font-medium tabular-nums">{formatBytes(usage?.audioBytes ?? 0)}</dd>
            <dt className="text-fg-muted">Artwork</dt>
            <dd className="text-right font-medium tabular-nums">{formatBytes(usage?.artworkBytes ?? 0)}</dd>
            {usage && usage.quotaBytes > 0 && (
              <>
                <dt className="border-t border-line pt-2 text-fg-muted">Device allowance used</dt>
                <dd className="border-t border-line pt-2 text-right font-medium tabular-nums">
                  {formatBytes(usage.usageBytes)} of {formatBytes(usage.quotaBytes)}
                  {usage.quotaBytes > 0 && (
                    <span className="ml-2 text-xs text-fg-faint">
                      {Math.min(100, (usage.usageBytes / usage.quotaBytes) * 100).toFixed(1)}%
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
            <span className="text-fg-muted">Protect library from browser cleanup</span>
            {persistence === 'granted' ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="size-4" /> Granted
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void StorageManager.requestPersistence().then((ok) => {
                    setPersistence(ok ? 'granted' : 'denied');
                    toast({
                      title: ok ? 'Storage will be kept safe' : 'Browser declined — data still works normally',
                      variant: ok ? 'success' : 'info',
                    });
                  })
                }
              >
                Request
              </Button>
            )}
          </div>
        </div>

        <Row label="Audio quality for converted files">
          <SegmentedControl
            value={quality}
            onChange={(v) => {
              const next = v as AudioQuality;
              setQuality(next);
              void LibraryService.setSetting(SETTINGS_KEYS.AUDIO_QUALITY, next);
            }}
            options={[
              { value: 'high', label: 'High' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'saver', label: 'Saver' },
            ]}
          />
        </Row>
        <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
          <span>
            <span className="block text-sm">Convert lossless imports to Opus</span>
            <span className="block text-xs leading-relaxed text-fg-faint">
              WAV / FLAC / AIFF → Opus {quality === 'high' ? '192' : quality === 'balanced' ? '128' : '96'} kbps.{' '}
              {canEncode
                ? 'Verified by decode round-trip; original kept if conversion fails.'
                : 'This browser cannot encode audio — originals are always kept.'}
            </span>
          </span>
          <Toggle
            checked={autoConvert && canEncode}
            disabled={!canEncode}
            onChange={(checked) => {
              setAutoConvert(checked);
              void LibraryService.setSetting(SETTINGS_KEYS.AUTO_TRANSCODE_LOSSLESS, checked);
            }}
            label="Convert lossless imports to Opus"
          />
        </label>

        <Row label="Maintenance">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="surface"
              size="sm"
              onClick={() =>
                openDialog({
                  type: 'confirm',
                  title: 'Clear playback history?',
                  detail: 'Recently played lists will reset. Likes and playlists are not affected.',
                  confirmLabel: 'Clear',
                  onConfirm: () => {
                    void StorageManager.clearPlaybackHistory().then(() =>
                      toast({ title: 'Playback history cleared', variant: 'success' })
                    );
                  },
                })
              }
            >
              <Trash2 className="size-4" /> Clear history
            </Button>
            <Button
              variant="surface"
              size="sm"
              onClick={() =>
                pruneOrphanArtworks()
                  .then((n) =>
                    toast({
                      title:
                        n > 0
                          ? `${n} unused artwork image${n === 1 ? '' : 's'} removed`
                          : 'No unused artwork found',
                      variant: 'success',
                    })
                  )
                  .catch(showErrorToast)
              }
            >
              <Database className="size-4" /> Clean artwork cache
            </Button>
          </div>
        </Row>

        {largest.length > 0 && (
          <details className="rounded-xl border border-line bg-surface-1 p-4">
            <summary className="cursor-pointer text-sm font-medium">Largest songs</summary>
            <ul className="mt-3 space-y-2">
              {largest.map(
                (track) =>
                  track && (
                    <li key={track.id} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">
                        {track.title} <span className="text-fg-faint">· {track.artist}</span>
                      </span>
                      <span className="tabular-nums text-fg-muted">{formatBytes(track.fileSize)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() =>
                          openDialog({
                            type: 'confirm',
                            title: `Delete “${track.title}”?`,
                            detail: 'This permanently removes the song and its audio from this device.',
                            confirmLabel: 'Delete',
                            danger: true,
                            onConfirm: () => void deleteTracks([track.id]),
                          })
                        }
                      >
                        Delete
                      </Button>
                    </li>
                  )
              )}
            </ul>
          </details>
        )}
      </Section>

      <Section icon={Settings2} title="Library & downloads">
        <p className="py-2 text-sm leading-relaxed text-fg-muted">
          Imports run entirely on this device. Direct audio links download fully in-browser when the
          source allows cross-origin requests; YouTube streams require an external step because no
          server exists here to extract them.
        </p>
        <Row label="Add music">
          <Button variant="surface" size="sm" onClick={() => openDialog({ type: 'addMusic' })}>
            Import / download
          </Button>
        </Row>
      </Section>

      <Section icon={CloudUpload} title="Cloud backup">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-line-strong bg-surface-1 p-4">
          <div>
            <p className="text-sm font-medium">Google Drive backup</p>
            <p className="mt-0.5 max-w-md text-[13px] text-fg-muted">
              Back up your library to your own cloud storage. Designed into the architecture and
              arriving in a future phase — your data never touches our servers, because there are none.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-surface-3 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-faint">
            Phase 2
          </span>
        </div>
      </Section>

      <Section icon={Info} title="About">
        <Row label="Keyboard shortcuts">
          <Button variant="surface" size="sm" onClick={() => openDialog({ type: 'shortcuts' })}>
            <Keyboard className="size-4" /> View
          </Button>
        </Row>
        <p className="pt-2 text-[13px] leading-relaxed text-fg-faint">
          Localify v1.0 · local-first music player. Your listening history, likes, playlists and
          audio live only in this browser's storage unless you explicitly export or back them up.
        </p>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fg-faint">
        <Icon className="size-4" />
        {title}
      </h2>
      <div className="space-y-1 rounded-2xl border border-line bg-surface-1/60 p-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 py-2">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
            value === option.value ? 'bg-accent text-accent-contrast' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-surface-3'
      } disabled:opacity-40`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
