import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from '@/utils/clsx';

type Variant = 'accent' | 'surface' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  accent:
    'bg-accent text-accent-contrast hover:brightness-110 active:brightness-95 shadow-[0_4px_14px_-4px] shadow-accent/40',
  surface:
    'bg-surface-2 text-fg hover:bg-surface-3 border border-line',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  outline: 'border border-line-strong text-fg hover:border-accent hover:text-accent bg-transparent',
  danger: 'bg-danger/12 text-danger hover:bg-danger/20 border border-danger/30',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'surface', size = 'md', className, type, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-all duration-150 select-none disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    />
  );
});
