/** Application-level error carrying a user-safe message and a machine code. */
export type ErrorCode =
  | 'quota'
  | 'unsupported-format'
  | 'corrupt-file'
  | 'network'
  | 'not-found'
  | 'invalid-url'
  | 'cancelled'
  | 'duplicate'
  | 'unknown';

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode = 'unknown', cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export interface FriendlyError {
  title: string;
  detail?: string;
}

const FRIENDLY: Record<ErrorCode, string> = {
  quota: 'Not enough device storage',
  'unsupported-format': 'This file format is not supported',
  'corrupt-file': 'The file appears to be damaged',
  network: 'You appear to be offline',
  'not-found': 'Item not found',
  'invalid-url': 'That link does not look right',
  cancelled: 'Cancelled',
  duplicate: 'Already in your library',
  unknown: 'Something went wrong',
};

export function friendlyError(err: unknown): FriendlyError {
  if (err instanceof AppError) {
    return { title: err.message };
  }
  const raw = err instanceof Error ? err.message : String(err);
  // IndexedDB quota errors surface under different names per browser.
  if (/quota|QuotaExceeded/i.test(raw)) return { title: FRIENDLY.quota, detail: 'Free up space in Settings → Storage and try again.' };
  return { title: FRIENDLY.unknown, detail: import.meta.env.DEV ? raw : undefined };
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
