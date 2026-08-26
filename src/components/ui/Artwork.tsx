import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { artworkUrl, ensureArtworkUrl, type ArtworkSize } from '@/services/storage/ArtworkStorage';
import { clsx } from '@/utils/clsx';
import { hueFromString } from '@/utils/misc';
import { initialsOf } from '@/utils/text';

export interface ArtworkProps {
  artworkId?: string;
  /** Fallback label used to derive gradient + initials when no art exists. */
  name: string;
  className?: string;
  rounded?: 'md' | 'lg' | 'xl' | 'full' | 'none';
  size: ArtworkSize;
  /** Render an icon instead of initials in the placeholder. */
  iconFallback?: boolean;
}

const roundMap = {
  none: '',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const;

/**
 * Renders stored artwork through the object-URL cache, or a deterministic,
 * polished gradient placeholder keyed off the item's name.
 *
 * Cache hits render synchronously during render; misses resolve through an
 * effect subscription and swap in when the object URL is ready.
 */
export function Artwork({
  artworkId,
  name,
  className,
  rounded = 'md',
  size = 'thumb',
  iconFallback = false,
}: ArtworkProps) {
  const cacheKey = `${artworkId ?? ''}:${size}`;
  const cachedUrl = artworkUrl(artworkId, size);

  // Resolved-once result for cache misses, keyed so stale results never apply.
  const [loaded, setLoaded] = useState<{ key: string; url?: string }>({ key: '', url: undefined });

  useEffect(() => {
    if (!artworkId || cachedUrl || loaded.key === cacheKey) return;
    let cancelled = false;
    void ensureArtworkUrl(artworkId, size).then((resolved) => {
      if (!cancelled) setLoaded({ key: cacheKey, url: resolved });
    });
    return () => {
      cancelled = true;
    };
  }, [artworkId, size, cacheKey, cachedUrl, loaded.key]);

  const url = cachedUrl ?? (loaded.key === cacheKey ? loaded.url : undefined);

  if (!url) {
    return <Placeholder name={name} rounded={rounded} className={className} icon={iconFallback} />;
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={clsx('h-full w-full object-cover', roundMap[rounded], className)}
    />
  );
}

function Placeholder({
  name,
  rounded,
  className,
  icon,
}: {
  name: string;
  rounded: keyof typeof roundMap;
  className?: string;
  icon?: boolean;
}) {
  const hue = hueFromString(name);
  return (
    <div
      role="img"
      aria-label={`Artwork for ${name}`}
      className={clsx(
        'flex h-full w-full items-center justify-center overflow-hidden bg-surface-3',
        roundMap[rounded],
        className
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 42% 26%), hsl(${(hue + 60) % 360} 48% 14%))`,
      }}
    >
      {icon ? (
        <Music2 className="size-1/3 text-white/50" strokeWidth={1.5} />
      ) : (
        <span className="text-lg font-semibold tracking-wide text-white/65">{initialsOf(name)}</span>
      )}
    </div>
  );
}
