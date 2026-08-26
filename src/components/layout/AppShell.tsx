import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock3,
  Heart,
  Home,
  Library,
  ListMusic,
  Plus,
  Search,
  Settings as SettingsIcon,
  Disc3,
  Mic2,
} from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useUiStore } from '@/stores/uiStore';
import { PlayerBar } from '@/components/player/PlayerBar';
import { MobileNav } from '@/components/layout/MobileNav';
import { NowPlayingOverlay } from '@/components/player/NowPlayingOverlay';
import { QueueHost } from '@/components/player/QueueHost';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { WelcomeDialog } from '@/components/dialogs/WelcomeDialog';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library/songs', label: 'Library', icon: Library, matchPrefix: '/library' },
];

/**
 * Responsive application frame:
 *   desktop — fixed sidebar + content + persistent bottom player
 *   mobile  — top content + mini player above bottom tab bar
 */
export function AppShell() {
  const queueOpen = useUiStore((s) => s.queueOpen);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <OfflineBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main
          className={`min-w-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+104px)] transition-[margin] duration-300 md:pb-28 ${
            queueOpen ? 'lg:mr-[340px]' : ''
          }`}
        >
          <Suspense fallback={null}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10"
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
      </div>
      <QueueHost />
      <PlayerBar />
      <MobileNav />
      <NowPlayingOverlay />
      <WelcomeDialog />
    </div>
  );
}

function Sidebar() {
  const playlists = useLibraryStore((s) => s.playlists);
  const openDialog = useUiStore((s) => s.openDialog);
  const location = useLocation();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface-1/60 px-3 py-4 md:flex xl:w-64">
      <NavLink to="/" className="mb-5 flex items-center gap-2.5 px-2">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 40%, #38e8c6))' }}
        >
          <Disc3 className="size-5 text-white" />
        </span>
        <span className="text-[17px] font-bold tracking-tight">Localify</span>
      </NavLink>

      <nav aria-label="Primary" className="space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end, matchPrefix }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => {
              const active = isActive || (matchPrefix ? location.pathname.startsWith(matchPrefix) : false);
              return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-1 hover:text-fg'
              }`;
            }}
          >
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 flex items-center justify-between px-3 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-faint">Playlists</span>
        <button
          type="button"
          aria-label="Create playlist"
          title="Create playlist"
          onClick={() => openDialog({ type: 'createPlaylist' })}
          className="rounded-full p-1 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <nav aria-label="Playlists" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {playlists.slice(0, 24).map((playlist) => (
          <NavLink
            key={playlist.id}
            to={`/playlists/${playlist.id}`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors truncate ${
                isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-1 hover:text-fg'
              }`
            }
          >
            <ListMusic className="size-4 shrink-0 opacity-70" />
            <span className="truncate">{playlist.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-3 space-y-0.5 border-t border-line pt-3">
        <SidebarLink to="/library/recent" label="Recently Played" icon={Clock3} />
        <SidebarLink to="/library/liked" label="Liked Songs" icon={Heart} />
        <SidebarLink to="/library/artists" label="Artists" icon={Mic2} />
        <SidebarLink to="/settings" label="Settings" icon={SettingsIcon} />
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Home;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
          isActive ? 'text-accent' : 'text-fg-muted hover:bg-surface-1 hover:text-fg'
        }`
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  );
}
