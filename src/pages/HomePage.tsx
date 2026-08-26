import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Heart, Plus, Sparkles } from 'lucide-react';
import type { Track } from '@/types';
import { useLibraryStore } from '@/stores/libraryStore';
import { LibraryService } from '@/services/library/LibraryService';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import {
  ShelfRow,
  albumCard,
  artistCard,
  playlistCard,
  MediaCard,
} from '@/components/library/Shelf';
import { useUiStore } from '@/stores/uiStore';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const loaded = useLibraryStore((s) => s.loaded);
  const tracks = useLibraryStore((s) => s.tracks);
  const albums = useLibraryStore((s) => s.albums);
  const artists = useLibraryStore((s) => s.artists);
  const playlists = useLibraryStore((s) => s.playlists);
  const openDialog = useUiStore((s) => s.openDialog);

  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  useEffect(() => {
    void LibraryService.getRecentlyPlayed(12).then(setRecentTracks);
  }, [tracks]);

  const recentlyAdded = useMemo(
    () => [...tracks].sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 12),
    [tracks]
  );
  const mostPlayed = useMemo(
    () =>
      [...tracks]
        .filter((t) => t.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 12),
    [tracks]
  );
  const liked = useMemo(() => tracks.filter((t) => t.liked), [tracks]);

  if (!loaded) {
    return (
      <div className="space-y-6 pt-2">
        <div className="h-9 w-56 skeleton rounded-lg" />
        <SkeletonCardGrid count={5} />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Welcome to Localify"
        detail="Your music lives on your device and plays completely offline. Add your first song to get started."
        actions={
          <>
            <Button variant="accent" size="lg" onClick={() => openDialog({ type: 'addMusic' })}>
              <Plus className="size-[18px]" /> Import music
            </Button>
            <Button variant="outline" size="lg" onClick={() => openDialog({ type: 'addMusic' })}>
              Download from YouTube
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="pt-1">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting()}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {tracks.length.toLocaleString()} song{tracks.length === 1 ? '' : 's'} on this device · works offline
          </p>
        </div>
        <Button variant="surface" onClick={() => openDialog({ type: 'addMusic' })}>
          <Plus className="size-4" /> Add music
        </Button>
      </div>

      {/* Quick access cards */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink
          to="/library/liked"
          icon={<Heart className="size-5" />}
          title="Liked Songs"
          sub={`${liked.length} song${liked.length === 1 ? '' : 's'}`}
          accent
        />
        <QuickLink
          to="/library/recent"
          icon={<Clock3 className="size-5" />}
          title="Recently Played"
          sub="Pick up where you left off"
        />
        <QuickLink
          to="/playlists"
          icon={<Plus className="size-5" />}
          title="Playlists"
          sub={`${playlists.length} playlist${playlists.length === 1 ? '' : 's'}`}
        />
      </div>

      {recentTracks.length > 0 && (
        <ShelfRow title="Recently played">
          {recentTracks.map((track) => (
            <MediaCard
              key={track.id}
              to={`/albums/${encodeURIComponent(track.albumId)}`}
              artworkId={track.artworkId}
              name={track.title}
              sub={track.artist}
            />
          ))}
        </ShelfRow>
      )}

      <ShelfRow title="Recently added" subtitle="Fresh imports on this device">
        {recentlyAdded.map((track) => (
          <MediaCard
            key={track.id}
            to={`/albums/${encodeURIComponent(track.albumId)}`}
            artworkId={track.artworkId}
            name={track.title}
            sub={track.artist}
          />
        ))}
      </ShelfRow>

      {mostPlayed.length > 0 && (
        <ShelfRow title="Most played" subtitle="Your repeat-worthy rotation">
          {mostPlayed.map((track) => (
            <MediaCard
              key={track.id}
              to={`/albums/${encodeURIComponent(track.albumId)}`}
              artworkId={track.artworkId}
              name={track.title}
              sub={`${track.playCount} play${track.playCount === 1 ? '' : 's'}`}
            />
          ))}
        </ShelfRow>
      )}

      {playlists.length > 0 && (
        <ShelfRow
          title="Your playlists"
          action={
            <Button variant="ghost" size="sm" onClick={() => openDialog({ type: 'createPlaylist' })}>
              <Plus className="size-4" /> New
            </Button>
          }
        >
          {playlists.slice(0, 12).map((playlist) => {
            const artTrack = tracks.find((t) => t.id === playlist.trackIds[0]);
            return playlistCard(playlist, artTrack?.artworkId);
          })}
        </ShelfRow>
      )}

      {albums.length > 0 && (
        <ShelfRow title="Albums">
          {albums.slice(0, 16).map(albumCard)}
        </ShelfRow>
      )}

      {artists.length > 0 && (
        <ShelfRow title="Artists">
          {artists.slice(0, 16).map(artistCard)}
        </ShelfRow>
      )}
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  sub,
  accent,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-4 rounded-xl border p-4 transition-transform hover:-translate-y-0.5 ${
        accent
          ? 'border-transparent bg-gradient-to-br from-accent/25 to-accent/5'
          : 'border-line bg-surface-1 hover:bg-surface-2'
      }`}
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${accent ? 'bg-accent text-accent-contrast' : 'bg-surface-3'}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-fg-muted">{sub}</span>
      </span>
    </Link>
  );
}
