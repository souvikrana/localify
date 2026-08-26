import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { setupMediaSession } from '@/services/audio/MediaSessionService';
import { PlaybackService } from '@/services/audio/PlaybackService';
import { StorageManager } from '@/services/storage/StorageManager';
import { mirrorSettingsToLocalStorage, db, SETTINGS_KEYS } from '@/db/database';
import { useLibraryStore } from '@/stores/libraryStore';
import { useUiStore } from '@/stores/uiStore';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

import HomePage from '@/pages/HomePage';
import SearchPage from '@/pages/SearchPage';
import LibraryLayout from '@/pages/LibraryLayout';
import SongsPage from '@/pages/SongsPage';
import AlbumsPage from '@/pages/AlbumsPage';
import AlbumDetailPage from '@/pages/AlbumDetailPage';
import ArtistsPage from '@/pages/ArtistsPage';
import ArtistDetailPage from '@/pages/ArtistDetailPage';
import GenresPage from '@/pages/GenresPage';
import GenreDetailPage from '@/pages/GenreDetailPage';
import LikedSongsPage from '@/pages/LikedSongsPage';
import RecentlyPlayedPage from '@/pages/RecentlyPlayedPage';
import PlaylistsPage from '@/pages/PlaylistsPage';
import PlaylistDetailPage from '@/pages/PlaylistDetailPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { GlobalDropZone } from '@/components/library/GlobalDropZone';
import { DialogHost } from '@/components/dialogs/DialogHost';

export default function App() {
  useAppBootstrap();

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryLayout />}>
              <Route index element={<Navigate to="songs" replace />} />
              <Route path="songs" element={<SongsPage />} />
              <Route path="albums" element={<AlbumsPage />} />
              <Route path="artists" element={<ArtistsPage />} />
              <Route path="genres" element={<GenresPage />} />
              <Route path="liked" element={<LikedSongsPage />} />
              <Route path="recent" element={<RecentlyPlayedPage />} />
            </Route>
            <Route path="/albums/:id" element={<AlbumDetailPage />} />
            <Route path="/artists/:id" element={<ArtistDetailPage />} />
            <Route path="/genres/:key" element={<GenreDetailPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        <DialogHost />
        <GlobalDropZone />
        <Toaster />
      </ErrorBoundary>
    </MotionConfig>
  );
}

/**
 * One-time engine + store wiring. Order matters:
 * theme first (no flash), library load, then restore last playback session.
 */
function useAppBootstrap(): void {
  const initTheme = useUiStore((s) => s.initTheme);
  const connectPlayback = usePlaybackStore((s) => s.connect);

  useEffect(() => {
    let disposed = false;
    const teardownSession = connectPlayback();

    void (async () => {
      await initTheme();
      await useLibraryStore.getState().load();

      if (disposed) return;
      try {
        await PlaybackService.restoreSession();
      } catch (err) {
        console.warn('[app] session restore failed', err);
      }

      // Best-effort: ask the browser to never evict the music.
      void StorageManager.requestPersistence();
      mirrorSettingsToLocalStorage();
    })();

    const offError = PlaybackService.events.on('error', (err) => {
      useUiStore.getState().toast({ title: err.message, variant: 'error' });
    });
    const mediaTeardown = setupMediaSession();
    void ensureOnboardingFlag();

    return () => {
      disposed = true;
      offError();
      teardownSession?.();
      mediaTeardown();
    };
  }, [initTheme, connectPlayback]);

  useKeyboardShortcuts();
}

async function ensureOnboardingFlag(): Promise<void> {
  const record = await db.settings.get(SETTINGS_KEYS.ONBOARDED);
  if (!record) {
    // First launch — the welcome screen shows until dismissed.
    useUiStore.setState({ dialog: { type: 'welcome' } });
  }
}
