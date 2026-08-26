import { afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// jsdom lacks URL.createObjectURL used by artwork/audio plumbing.
if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:mock',
    writable: true,
  });
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    writable: true,
  });
}

afterEach(async () => {
  // Fresh IndexedDB per test to avoid cross-test bleed.
  const { resetDB } = await import('./helpers');
  await resetDB();
});
