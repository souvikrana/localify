import { NavLink } from 'react-router-dom';
import { Home, Library, Search } from 'lucide-react';
import { clsx } from '@/utils/clsx';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search, end: false },
  { to: '/library/songs', label: 'Library', icon: Library, end: false },
] as const;

/** Bottom tab bar — mobile only (md:hidden). Sits under the mini player. */
export function MobileNav() {
  return (
    <nav
      aria-label="Primary"
      className={clsx(
        'fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface-1/95 backdrop-blur-lg',
        'md:hidden'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
              isActive ? 'text-accent' : 'text-fg-muted'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
