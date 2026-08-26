import type { PlaybackSnapshot, RepeatMode } from '@/types';

export interface QueueChangeDetail {
  reason:
    | 'set'
    | 'advance'
    | 'previous'
    | 'add-next'
    | 'add-end'
    | 'remove'
    | 'reorder'
    | 'clear'
    | 'shuffle'
    | 'repeat';
}

function fisherYates<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Pure queue logic: ordering, shuffle (stable around the current track),
 * repeat modes and safe index arithmetic. No audio or storage dependencies,
 * which makes it directly unit-testable.
 */
export class QueueManager {
  private ids: string[] = [];
  /** Order the user originally queued, restored when shuffle turns off. */
  private naturalOrder: string[] = [];
  private index = -1;

  constructor(
    public shuffle = false,
    public repeat: RepeatMode = 'off'
  ) {}

  get size(): number {
    return this.ids.length;
  }

  get currentIndex(): number {
    return this.index;
  }

  get trackIds(): readonly string[] {
    return this.ids;
  }

  setQueue(ids: string[], startIndex: number): void {
    this.ids = [...ids];
    this.naturalOrder = [...ids];
    this.index = ids.length > 0 ? Math.max(0, Math.min(startIndex, ids.length - 1)) : -1;
    if (this.shuffle && this.ids.length > 1) this.applyShuffle();
  }

  currentId(): string | null {
    return this.index >= 0 ? this.ids[this.index] ?? null : null;
  }

  idAt(position: number): string | null {
    return this.ids[position] ?? null;
  }

  positionOf(id: string): number {
    return this.ids.indexOf(id);
  }

  /**
   * What plays after the current track without mutating position.
   * Accounts for repeat-one / repeat-all / end-of-queue.
   */
  peekNext(): string | null {
    if (this.repeat === 'one') return this.currentId();
    if (this.index < 0 || this.ids.length === 0) return null;
    if (this.index + 1 < this.ids.length) return this.ids[this.index + 1] ?? null;
    if (this.repeat === 'all') return this.ids[0] ?? null;
    return null;
  }

  /** Advance and return the id that should play now (null = stop). */
  next(): string | null {
    if (this.repeat === 'one') return this.currentId();
    if (this.ids.length === 0) return null;
    if (this.index + 1 < this.ids.length) {
      this.index += 1;
      return this.ids[this.index] ?? null;
    }
    if (this.repeat === 'all') {
      this.index = 0;
      return this.ids[0] ?? null;
    }
    return null;
  }

  /**
   * Advance treating repeat-one as off. Used for explicit user skips so the
   * user can always move forward even while repeat-one is active.
   */
  advanceSkippingRepeatOne(): string | null {
    if (this.repeat !== 'one') return this.next();
    const saved = this.repeat;
    this.repeat = 'off';
    const id = this.next();
    this.repeat = saved;
    return id;
  }

  /** Go back. At the start of a repeating queue, wrap to the last track. */
  previous(): string | null {
    if (this.ids.length === 0) return null;
    if (this.index > 0) {
      this.index -= 1;
      return this.ids[this.index] ?? null;
    }
    if (this.repeat === 'all') {
      this.index = this.ids.length - 1;
      return this.ids[this.index] ?? null;
    }
    return this.ids[0] ?? null;
  }

  jumpToPosition(position: number): string | null {
    const id = this.idAt(position);
    if (!id) return null;
    this.index = position;
    return id;
  }

  jumpToId(id: string): boolean {
    const pos = this.positionOf(id);
    if (pos === -1) return false;
    this.index = pos;
    return true;
  }

  addNext(ids: string[]): void {
    if (ids.length === 0) return;
    const insertAt = this.index + 1;
    this.ids.splice(insertAt, 0, ...ids);
    // Keep natural order aligned: recompute lazily instead of tracking splits.
    this.naturalOrder = mergeNatural(this.naturalOrder, ids, insertAt);
  }

  addToEnd(ids: string[]): void {
    if (ids.length === 0) return;
    this.ids.push(...ids);
    this.naturalOrder.push(...ids);
    // Note: never sets `index` — queuing must not imply playback.
  }

  removeAt(position: number): void {
    if (position < 0 || position >= this.ids.length) return;
    this.ids.splice(position, 1);
    this.naturalOrder = this.naturalOrder.filter((id) => this.ids.includes(id));
    if (position < this.index) this.index -= 1;
    else if (position === this.index) {
      if (this.ids.length === 0) this.index = -1;
      else if (this.index >= this.ids.length) this.index = this.ids.length - 1;
    }
  }

  clearUpcoming(): void {
    if (this.index < 0) {
      this.ids = [];
      this.index = -1;
    } else {
      this.ids = this.ids.slice(0, this.index + 1);
    }
    this.naturalOrder = [...this.ids];
  }

  reorder(oldPosition: number, newPosition: number): void {
    if (
      oldPosition === newPosition ||
      oldPosition < 0 ||
      newPosition < 0 ||
      oldPosition >= this.ids.length ||
      newPosition >= this.ids.length
    ) {
      return;
    }
    const [moved] = this.ids.splice(oldPosition, 1);
    if (moved !== undefined) this.ids.splice(newPosition, 0, moved);
    if (this.index === oldPosition) this.index = newPosition;
    else if (oldPosition < this.index && newPosition >= this.index) this.index -= 1;
    else if (oldPosition > this.index && newPosition <= this.index) this.index += 1;
  }

  setShuffle(enabled: boolean): void {
    if (enabled === this.shuffle) return;
    this.shuffle = enabled;
    if (enabled && this.ids.length > 1) this.applyShuffle();
    if (!enabled && this.naturalOrder.length > 0) {
      const currentId = this.currentId();
      this.ids = this.naturalOrder.filter((id) => this.ids.includes(id));
      this.index = currentId ? this.ids.indexOf(currentId) : -1;
    }
  }

  private applyShuffle(): void {
    const currentId = this.currentId();
    const head = currentId ? [currentId] : [];
    const rest = this.ids.filter((id) => id !== currentId);
    this.ids = [...head, ...fisherYates(rest)];
    this.index = head.length > 0 ? 0 : -1;
  }

  setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
  }

  cycleRepeat(): RepeatMode {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(this.repeat) + 1) % order.length] ?? 'off';
    this.setRepeat(next);
    return next;
  }

  getSnapshot(): PlaybackSnapshot['queueTrackIds'] {
    return [...this.ids];
  }

  restore(
    ids: string[],
    currentIndex: number,
    shuffle: boolean,
    repeat: RepeatMode
  ): void {
    this.shuffle = false;
    this.repeat = repeat;
    this.setQueue(ids, currentIndex);
    this.shuffle = shuffle;
    if (shuffle && this.ids.length > 1) {
      // Preserve the restored order exactly rather than reshuffling again.
      this.naturalOrder = [...ids];
    }
  }
}

/** Insert new ids into the remembered "natural" order at the same slot. */
function mergeNatural(natural: string[], additions: string[], insertAt: number): string[] {
  const anchorId = natural[insertAt];
  const result = [...natural];
  const insertionPoint = anchorId !== undefined ? result.indexOf(anchorId) : result.length;
  const at = insertionPoint === -1 ? result.length : insertionPoint;
  result.splice(at, 0, ...additions);
  return result;
}
