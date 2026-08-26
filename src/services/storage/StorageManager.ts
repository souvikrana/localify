import type { StorageUsage } from '@/types';
import { db } from '@/db/database';
import { AudioStorage } from './AudioStorage';

class StorageManagerImpl {
  private cachedEstimate: { at: number; value: StorageUsage } | null = null;

  /** Aggregate device + per-store usage. Cached for 30s (used by Settings). */
  async getUsage(force = false): Promise<StorageUsage> {
    if (!force && this.cachedEstimate && Date.now() - this.cachedEstimate.at < 30_000) {
      return this.cachedEstimate.value;
    }
    const [audioBytes, artworkBytes, estimate] = await Promise.all([
      AudioStorage.audioBytes(),
      this.artworkBytes(),
      this.deviceEstimate(),
    ]);
    const value: StorageUsage = {
      audioBytes,
      artworkBytes,
      usageBytes: estimate.usageBytes,
      quotaBytes: estimate.quotaBytes,
    };
    this.cachedEstimate = { at: Date.now(), value };
    return value;
  }

  private async artworkBytes(): Promise<number> {
    let total = 0;
    await db.artworks.each((record) => {
      total += record.full.size + record.thumb.size;
    });
    return total;
  }

  private async deviceEstimate(): Promise<{ usageBytes: number; quotaBytes: number }> {
    try {
      const est = await navigator.storage?.estimate?.();
      return { usageBytes: est?.usage ?? 0, quotaBytes: est?.quota ?? 0 };
    } catch {
      return { usageBytes: 0, quotaBytes: 0 };
    }
  }

  /**
   * Ask the browser to keep our data across evictions. Best-effort; Chrome
   * usually grants for installed PWAs and engaged users.
   */
  async requestPersistence(): Promise<boolean> {
    try {
      if (navigator.storage?.persist) return await navigator.storage.persist();
      return false;
    } catch {
      return false;
    }
  }

  async persistenceState(): Promise<'granted' | 'denied' | 'unsupported'> {
    try {
      if (!navigator.storage?.persisted) return 'unsupported';
      return (await navigator.storage.persisted()) ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  }

  async clearPlaybackHistory(): Promise<void> {
    await db.history.clear();
  }
}

export const StorageManager = new StorageManagerImpl();
