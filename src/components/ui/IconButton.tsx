import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from '@/utils/clsx';

type Size = 'xs' | 'sm' | 'md' | 'lg';
type Variant = 'ghost' | 'solid' | 'accent';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons must be labelled for screen readers. */
  label: string;
  size?: Size;
  variant?: Variant;
  active?: boolean;
}

const sizeClasses: Record<Size, string> = {
  xs: 'h-7 w-7 [&_svg]:size-[15px]',
  sm: 'h-8 w-8 [&_svg]:size-[17px]',
  md: 'h-10 w-10 [&_svg]:size-5',
  lg: 'h-12 w-12 [&_svg]:size-6',
};

const variantClasses: Record<Variant, string> = {
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  solid: 'bg-surface-2 text-fg hover:bg-surface-3 border border-line',
  accent: 'bg-accent text-accent-contrast hover:brightness-110',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', active, className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none',
        sizeClasses[size],
        variantClasses[variant],
        active && '!text-accent',
        className
      )}
      {...rest}
    />
  );
});
