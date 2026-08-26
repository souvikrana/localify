import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, SearchX } from 'lucide-react';
import { searchLibrary } from '@/services/library/searchService';
import { useLibraryStore } from '@/stores/libraryStore';
import { TrackListVirtual } from '@/components/library/TrackListVirtual';
import { MediaCard, albumCard, artistCard, playlistCard } from '@/components/library/Shelf';
import { ShelfRow } from '@/components/library/Shelf';

/**
 * Instant, fully offline search across songs, artists, albums and playlists.
 * Results update as you type with a tiny debounce for very fast typists.
 */
export default function SearchPage() {
  const tracks = useLibraryStore((s) => s.tracks);
  const albums = useLibraryStore((s) => s.albums);
  const artists = useLibraryStore((s) => s.artists);
  const playlists = useLibraryStore((s) => s.playlists);

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(
    () =>
      query.trim()
        ? searchLibrary(query, { tracks, albums, artists, playlists })
        : null,
    [query, tracks, albums, artists, playlists]
  );

  return (
    <div className="flex min-h-0 flex-col" style={{ height: 'calc(100dvh - 190px)' }}>
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-fg-faint" />
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label="Search your library"
          placeholder="Songs, artists, albums, playlists…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="h-12 w-full rounded-xl border border-line bg-surface-1 pl-11 pr-4 text-[15px] outline-none transition-colors placeholder:text-fg-faint focus:border-accent"
        />
      </div>

      {!results && <BrowseAll />}

      {results?.isEmpty && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <SearchX className="size-10 text-fg-faint" strokeWidth={1.5} />
          <p className="text-base font-medium">No matches for “{results.query}”</p>
          <p className="max-w-xs text-sm text-fg-muted">
            Search covers song titles, artists, albums, genres, playlist names and filenames — all offline.
          </p>
        </div>
      )}

      {results && !results.isEmpty && (
        <div className="min-h-0 flex-1 overflow-hidden">
          {results.artists.length > 0 && (
            <ShelfRow title="Artists">{results.artists.map(artistCard)}</ShelfRow>
          )}
          {results.albums.length > 0 && (
            <ShelfRow title="Albums">{results.albums.slice(0, 12).map(albumCard)}</ShelfRow>
          )}
          {results.playlists.length > 0 && (
            <ShelfRow title="Playlists">
              {results.playlists.map((playlist) => {
                const artTrack = tracks.find((t) => t.id === playlist.trackIds[0]);
                return playlistCard(playlist, artTrack?.artworkId);
              })}
            </ShelfRow>
          )}
          {results.tracks.length > 0 && (
            <>
              <h2 className="mb-2 mt-1 text-lg font-bold tracking-tight">Songs</h2>
              <TrackListVirtual
                tracks={results.tracks}
                showIndex
                rowHeight={60}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BrowseAll() {
  const albums = useLibraryStore((s) => s.albums);
  const artists = useLibraryStore((s) => s.artists);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      {artists.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Artists</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {artists.slice(0, 16).map((artist) => (
              <MediaCard
                key={artist.id}
                to={`/artists/${encodeURIComponent(artist.id)}`}
                artworkId={artist.artworkId}
                name={artist.name}
                sub={`${artist.trackCount} songs`}
                round
              />
            ))}
          </div>
        </section>
      )}
      {albums.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold tracking-tight">Albums</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {albums.slice(0, 18).map((album) => (
              <MediaCard
                key={album.id}
                to={`/albums/${encodeURIComponent(album.id)}`}
                artworkId={album.artworkId}
                name={album.name}
                sub={album.artist}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
