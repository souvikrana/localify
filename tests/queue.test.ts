// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { QueueManager } from '@/services/audio/QueueManager';

const IDS = ['a', 'b', 'c', 'd', 'e'];

describe('QueueManager', () => {
  it('sets a queue with a start index', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 2);
    expect(q.currentId()).toBe('c');
    expect(q.size).toBe(5);
  });

  it('advances sequentially and stops at the end with repeat off', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 0);
    expect(q.next()).toBe('b');
    expect(q.next()).toBe('c');
    q.setQueue(['x'], 0);
    q.next(); // no-op at end
    expect(q.next()).toBe(null);
  });

  it('wraps around with repeat all', () => {
    const q = new QueueManager(false, 'all');
    q.setQueue(['a', 'b'], 1);
    expect(q.next()).toBe('a'); // wraps
    expect(q.previous()).toBe('b');
  });

  it('repeat one returns the current id without advancing', () => {
    const q = new QueueManager(false, 'one');
    q.setQueue(['a', 'b'], 0);
    expect(q.next()).toBe('a');
    expect(q.currentIndex).toBe(0);
    // Explicit skip still moves forward.
    expect(q.advanceSkippingRepeatOne()).toBe('b');
  });

  it('previous restarts from index 0 when repeat is off', () => {
    const q = new QueueManager();
    q.setQueue(['a', 'b', 'c'], 0);
    expect(q.previous()).toBe('a');
  });

  it('addNext inserts right after the current track', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 0);
    q.addNext(['z']);
    expect(q.trackIds).toEqual(['a', 'z', 'b', 'c', 'd', 'e']);
    expect(q.peekNext()).toBe('z');
  });

  it('addToEnd appends without implying playback', () => {
    const q = new QueueManager();
    q.addToEnd(['a']);
    // Queued ≠ playing: no current track is selected.
    expect(q.currentId()).toBe(null);
    q.addToEnd(['b']);
    expect(q.trackIds).toEqual(['a', 'b']);
    expect(q.currentIndex).toBe(-1);
  });

  it('removeAt adjusts the current index safely', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 2); // c
    q.removeAt(0); // remove a → index shifts down
    expect(q.currentId()).toBe('c');
    expect(q.trackIds).toEqual(['b', 'c', 'd', 'e']);
    q.removeAt(1); // remove current (c)
    expect(q.currentId()).toBe('d');
    q.removeAt(q.size - 1); // remove e
    expect(q.trackIds).toEqual(['b', 'd']);
  });

  it('reorders without disturbing other positions', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 1); // b
    q.reorder(3, 0); // d to front
    expect(q.trackIds[0]).toBe('d');
    expect(q.currentId()).toBe('b');
    // After inserting d at the front, the current track b sits at index 2.
    // Move it to the very front and confirm tracking follows.
    q.reorder(2, 0);
    expect(q.trackIds[0]).toBe('b');
    expect(q.currentIndex).toBe(0);
    expect(q.currentId()).toBe('b');
  });

  it('shuffle keeps the current track first and restores natural order on disable', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 2); // c current
    q.setShuffle(true);
    expect(q.currentId()).toBe('c');
    const shuffled = [...q.trackIds];
    expect(shuffled).toHaveLength(5);
    expect(new Set(shuffled)).toEqual(new Set(IDS));
    // Every shuffle run keeps remaining items as a permutation.
    q.setShuffle(false);
    expect([...q.trackIds]).toEqual(IDS);
    expect(q.currentId()).toBe('c');
  });

  it('clearUpcoming keeps only the played portion', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 1);
    q.clearUpcoming();
    expect(q.trackIds).toEqual(['a', 'b']);
    expect(q.currentId()).toBe('b');
  });

  it('jumpToId repositions playback', () => {
    const q = new QueueManager();
    q.setQueue(IDS, 0);
    expect(q.jumpToId('d')).toBe(true);
    expect(q.currentId()).toBe('d');
    expect(q.jumpToId('nope')).toBe(false);
  });
});
