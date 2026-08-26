import { useCallback, useMemo } from 'react';
import { clamp } from '@/utils/misc';
import { formatDuration } from '@/utils/format';
import { clsx } from '@/utils/clsx';

export interface SliderProps {
  value: number;
  max: number;
  /** Live drag updates. */
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  /** Show time labels either side (seek bar). */
  showTimes?: boolean;
}

/**
 * Accessible range slider with a filled track. Built on <input type=range>
 * for keyboard/screen-reader support; visual polish via CSS custom props.
 */
export function Slider({ value, max, onChange, ariaLabel, className, disabled, showTimes }: SliderProps) {
  const progress = useMemo(() => (max > 0 ? clamp((value / max) * 100, 0, 100) : 0), [value, max]);
  const style = useMemo(
    () => ({ '--slider-progress': `${progress}%` }) as React.CSSProperties,
    [progress]
  );

  const handle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value);
      if (Number.isFinite(next)) onChange(next);
    },
    [onChange]
  );

  return (
    <div className={clsx('flex w-full items-center gap-2', className)}>
      {showTimes && (
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-fg-faint">
          {formatDuration(value)}
        </span>
      )}
      <input
        type="range"
        className="slider"
        style={style}
        min={0}
        max={max > 0 ? max : 1}
        step="any"
        value={clamp(value, 0, max > 0 ? max : 1)}
        onChange={handle}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(value)}
        aria-valuetext={showTimes ? formatDuration(value) : `${Math.round(progress)}%`}
      />
      {showTimes && (
        <span className="w-10 shrink-0 text-[11px] tabular-nums text-fg-faint">{formatDuration(max)}</span>
      )}
    </div>
  );
}
