import { NavLink, Outlet } from 'react-router-dom';
import { clsx } from '@/utils/clsx';

const TABS = [
  { to: '/library/songs', label: 'Songs' },
  { to: '/library/albums', label: 'Albums' },
  { to: '/library/artists', label: 'Artists' },
  { to: '/library/genres', label: 'Genres' },
  { to: '/library/recent', label: 'Recently played' },
  { to: '/library/liked', label: 'Liked' },
];

/** Tabbed container for /library/* routes. */
export default function LibraryLayout() {
  return (
    <div className="flex min-h-0 flex-col" style={{ height: 'calc(100dvh - 190px)' }}>
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
        <nav aria-label="Library sections" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                clsx(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'border-transparent bg-accent text-accent-contrast'
                    : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
