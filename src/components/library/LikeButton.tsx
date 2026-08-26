import { memo } from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '@/stores/libraryStore';
import { showErrorToast } from '@/stores/uiStore';
import { clsx } from '@/utils/clsx';

export interface LikeButtonProps {
  trackId: string;
  liked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Optimistic like/unlike heart with a spring pop. */
export const LikeButton = memo(function LikeButton({
  trackId,
  liked,
  size = 'md',
  className,
}: LikeButtonProps) {
  const storeLiked = useLibraryStore((s) => s.trackMap.get(trackId)?.liked ?? false);
  const setLiked = useLibraryStore((s) => s.setLiked);
  const isLiked = liked ?? storeLiked;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      aria-label={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      aria-pressed={isLiked}
      title={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      onClick={(e) => {
        e.stopPropagation();
        setLiked(trackId, !isLiked).catch(showErrorToast);
      }}
      className={clsx(
        'inline-flex items-center justify-center rounded-full p-2 transition-colors',
        isLiked ? 'text-accent hover:text-accent/80' : 'text-fg-muted hover:text-fg',
        size === 'sm' && '[&_svg]:size-4',
        size === 'md' && '[&_svg]:size-[18px]',
        size === 'lg' && '[&_svg]:size-6',
        className
      )}
    >
      <Heart fill={isLiked ? 'currentColor' : 'none'} />
    </motion.button>
  );
});
