import { Link } from 'react-router-dom';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Music2, Pause, Play, Shuffle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Album, Artist, Playlist } from '@/types';
import { Artwork } from '@/components/ui/Artwork';
import { IconButton } from '@/components/ui/IconButton';
import { usePlaybackStore } from '@/stores/playbackStore';

/** Horizontally scrollable shelf with arrow controls on desktop. */
export function ShelfRow({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) => {
    scrollerRef.current?.scrollBy({ left: dir * 480, behavior: 'smooth' });
  };

  return (
    <section className="group/shelf mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <div className="hidden gap-1 sm:flex">
            <IconButton label={`Scroll ${title} left`} size="sm" onClick={() => scrollBy(-1)}>
              <ChevronLeft />
            </IconButton>
            <IconButton label={`Scroll ${title} right`} size="sm" onClick={() => scrollBy(1)}>
              <ChevronRight />
            </IconButton>
          </div>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1"
      >
        {children}
      </div>
    </section>
  );
}

export function MediaCard({
  to,
  artworkId,
  name,
  sub,
  round,
}: {
  to: string;
  artworkId?: string;
  name: string;
  sub: string;
  round?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group w-40 shrink-0 snap-start rounded-xl p-2.5 transition-colors hover:bg-surface-1 sm:w-44 md:w-48"
    >
      <div className={`relative aspect-square overflow-hidden bg-surface-2 shadow ${round ? 'rounded-full' : 'rounded-lg'}`}>
        <Artwork artworkId={artworkId} name={name} size="thumb" rounded={round ? 'full' : 'lg'} iconFallback />
      </div>
      <p className="mt-2.5 truncate text-sm font-semibold">{name}</p>
      <p className="truncate text-xs text-fg-muted">{sub}</p>
    </Link>
  );
}

export function albumCard(album: Album) {
  return (
    <MediaCard
      key={album.id}
      to={`/albums/${encodeURIComponent(album.id)}`}
      artworkId={album.artworkId}
      name={album.name}
      sub={`${album.year ? `${album.year} · ` : ''}${album.artist}`}
    />
  );
}

export function artistCard(artist: Artist) {
  return (
    <MediaCard
      key={artist.id}
      to={`/artists/${encodeURIComponent(artist.id)}`}
      artworkId={artist.artworkId}
      name={artist.name}
      sub={`${artist.trackCount} song${artist.trackCount === 1 ? '' : 's'}`}
      round
    />
  );
}

export function playlistCard(playlist: Playlist, fallbackArtworkId?: string) {
  return (
    <MediaCard
      key={playlist.id}
      to={`/playlists/${playlist.id}`}
      artworkId={playlist.artworkId ?? fallbackArtworkId}
      name={playlist.name}
      sub={playlist.description || `${playlist.trackIds.length} songs`}
    />
  );
}

/**
 * Circular play / shuffle control used in page heroes.
 */
export function HeroPlayControls({ ids, label }: { ids: string[]; label: string }) {
  const playing = usePlaybackStore((s) => s.playing);
  const currentId = usePlaybackStore((s) => s.currentTrack?.id);
  const playTracks = usePlaybackStore((s) => s.playTracks);
  const setShuffle = usePlaybackStore((s) => s.setShuffle);
  const isPlayingThis = playing && ids.includes(currentId ?? '');

  if (ids.length === 0) {
    return (
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 opacity-50" aria-hidden>
        <Music2 className="size-6" />
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={isPlayingThis ? `Pause ${label}` : `Play ${label}`}
        onClick={() => {
          if (isPlayingThis) {
            usePlaybackStore.getState().togglePlay();
            return;
          }
          void playTracks(ids, 0);
        }}
        className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {isPlayingThis ? (
          <Pause className="size-6" fill="currentColor" />
        ) : (
          <Play className="ml-0.5 size-6" fill="currentColor" />
        )}
      </button>
      <IconButton
        label={`Shuffle play ${label}`}
        onClick={() => {
          setShuffle(true);
          const start = Math.floor(Math.random() * ids.length);
          void playTracks(ids, start);
        }}
        variant="solid"
        size="lg"
      >
        <Shuffle />
      </IconButton>
    </div>
  );
}
