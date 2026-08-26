/**
 * SHA-256 hex digest of a blob's contents.
 * Reads in chunks so multi-hundred-MB files don't spike memory.
 */
export async function hashBlob(blob: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return `size-${blob.size}`; // Extremely old browsers: fall back to size-only.
  const key = await subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(key))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
