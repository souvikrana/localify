import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlaybackService } from '@/services/audio/PlaybackService';

/**
 * Global desktop shortcuts (skipped while typing in inputs):
 * Space play/pause · ←/→ seek (Shift: prev/next track) · ↑/↓ volume · M mute · Ctrl/⌘K search
 */
export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.defaultPrevented ||
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.tagName === 'SELECT'))
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/search');
        return;
      }
      // Let browser shortcuts through otherwise.
      if (mod || e.altKey) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          void PlaybackService.togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) void PlaybackService.next();
          else void PlaybackService.seekBy(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) void PlaybackService.previous();
          else void PlaybackService.seekBy(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          PlaybackService.setVolume(Math.min(1, PlaybackService.volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          PlaybackService.setVolume(Math.max(0, PlaybackService.volume - 0.05));
          break;
        case 'm':
        case 'M':
          PlaybackService.setMuted(!PlaybackService.muted);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
