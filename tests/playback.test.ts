import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybackService } from '@/services/audio/PlaybackService';
import { QueueManager } from '@/services/audio/QueueManager';
import { db } from '@/db/database';
import { makeTrack } from './helpers';

/**
 * Playback logic tests run against the real service with jsdom's stub
 * <audio>. Element-level behaviours (actual decoding) are covered by the
 * manual acceptance checklist in the README.
 */
describe('PlaybackService queue behaviour', () => {
  beforeEach(async () => {
    // loadAndPlay resolves tracks from the DB; seed the ones tests reference.
    await db.tracks.bulkPut([
      makeTrack({ id: 'a', title: 'Song A' }),
      makeTrack({ id: 'b', title: 'Song B' }),
      makeTrack({ id: 'c', title: 'Song C' }),
      makeTrack({ id: 'z', title: 'Song Z' }),
    ]);
  });

  it('starts empty and idle', () => {
    const q = new QueueManager();
    expect(q.currentId()).toBeNull();
    expect(PlaybackService.playing).toBe(false);
  });

  it('exposes upcoming tracks after playTracks', async () => {
    await PlaybackService.playTracks([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 0);
    expect([...PlaybackService.upcomingTrackIds]).toEqual(['b', 'c']);
    expect(PlaybackService.queueSize).toBe(3);
  });

  it('enqueueNext inserts immediately after current', async () => {
    await PlaybackService.playTracks([{ id: 'a' }, { id: 'b' }], 0);
    PlaybackService.enqueueNext(['z']);
    expect([...PlaybackService.upcomingTrackIds]).toEqual(['z', 'b']);
  });

  it('removeFromQueue keeps the playing track untouched', async () => {
    await PlaybackService.playTracks([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 0);
    PlaybackService.removeFromQueue(1); // remove b
    expect(PlaybackService.getQueueState().ids).toEqual(['a', 'c']);
    expect(PlaybackService.getQueueState().currentIndex).toBe(0);
  });

  it('reorderQueue moves items within the queue', async () => {
    await PlaybackService.playTracks([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 0);
    PlaybackService.reorderQueue(2, 1); // c between a and b
    expect(PlaybackService.getQueueState().ids).toEqual(['a', 'c', 'b']);
  });

  it('clearUpcoming leaves only what already played', async () => {
    await PlaybackService.playTracks([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 1);
    PlaybackService.clearUpcoming();
    expect(PlaybackService.getQueueState().ids).toEqual(['a', 'b']);
  });

  it('shuffle toggles without losing tracks', async () => {
    await PlaybackService.playTracks([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 0);
    PlaybackService.setShuffle(true);
    expect(new Set(PlaybackService.getQueueState().ids).size).toBe(3);
    expect(PlaybackService.shuffle).toBe(true);
    PlaybackService.setShuffle(false);
    expect(PlaybackService.getQueueState().ids).toEqual(['a', 'b', 'c']);
  });

  it('cycleRepeat walks off → all → one → off', async () => {
    await PlaybackService.playTracks([{ id: 'a' }], 0);
    expect(PlaybackService.cycleRepeat()).toBe('all');
    expect(PlaybackService.cycleRepeat()).toBe('one');
    expect(PlaybackService.cycleRepeat()).toBe('off');
  });
});
