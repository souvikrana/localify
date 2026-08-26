import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort boundary: a render crash should never leave a blank screen or
 * wipe access to someone's music library.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg p-8 text-center">
        <div className="text-4xl" aria-hidden>🎧</div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-fg-muted">
          Localify hit an unexpected error. Your library is safe — reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:brightness-110"
        >
          Reload Localify
        </button>
      </div>
    );
  }
}
