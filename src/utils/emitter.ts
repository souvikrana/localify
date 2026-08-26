/** Tiny strongly-typed event emitter (no DOM dependency, testable). */
export class Emitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as (payload: never) => void);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    this.listeners.get(event)?.delete(handler as (payload: never) => void);
  }

  /** Emit an event. Payload may be omitted for events typed as `void`. */
  emit<K extends keyof Events>(
    event: K,
    ...args: Events[K] extends void ? [] : [Events[K]]
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    const payload = args[0] as Events[K];
    for (const handler of [...set]) {
      try {
        (handler as (p: Events[K]) => void)(payload);
      } catch (err) {
        console.error('[Emitter] handler threw', err);
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
