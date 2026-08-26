// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { OggOpusMuxer } from '@/services/audio/OggOpusMuxer';
import { extractYouTubeId } from '@/services/downloader/YouTubeDownloader';
import { resolveDownloader } from '@/services/downloader';
import { DirectAudioDownloader } from '@/services/downloader/DirectAudioDownloader';
import { detectFormat, isLossless } from '@/services/library/MetadataService';
import { parseFilenameMetadata } from '@/utils/text';

describe('OggOpusMuxer', () => {
  function buildStream(packets: number[], samplesPerPacket = 960): Blob {
    const muxer = new OggOpusMuxer(2, 48000, samplesPerPacket);
    muxer.begin();
    for (const size of packets) {
      muxer.addPacket(new Uint8Array(size).fill(0xab));
    }
    return muxer.finish();
  }

  it('produces an OggS-magic blob with correct mime', async () => {
    const blob = buildStream([10, 20, 30]);
    expect(blob.type).toBe('audio/ogg');
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    expect([...head]).toEqual([0x4f, 0x67, 0x67, 0x53]); // "OggS"
  });

  it('writes OpusHead and OpusTags as the first two pages', async () => {
    const bytes = new Uint8Array(await buildStream([5]).arrayBuffer());
    const text = String.fromCharCode(...bytes.slice(0, 400));
    expect(text).toContain('OpusHead');
    expect(text).toContain('OpusTags');
  });

  it('encodes channel count and sample rate in OpusHead', async () => {
    const muxer = new OggOpusMuxer(1, 44100, 960);
    muxer.begin();
    const blob = muxer.finish();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // First page: 27-byte header + segment table + payload.
    const segCount = bytes[26]!;
    const offset = 27 + segCount;
    expect(String.fromCharCode(...bytes.slice(offset, offset + 8))).toBe('OpusHead');
    expect(bytes[offset + 9]).toBe(1); // channels
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(offset + 12, true)).toBe(44100); // input sample rate
  });

  it('handles packets larger than one lacing segment (255-byte chunks)', () => {
    const blob = buildStream([600, 255, 3]);
    expect(blob.size).toBeGreaterThan(900); // headers + payload + framing
  });

  it('handles exact multiples of 255 (zero-terminator lacing)', () => {
    const blob = buildStream(Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 255 : 510)));
    expect(blob.type).toBe('audio/ogg');
  });
});

describe('YouTube URL parsing', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=x', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('extracts id from %s', (url, expected) => {
    expect(extractYouTubeId(url)).toBe(expected);
  });

  it.each([
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/notavideo',
    'not a url at all',
  ])('rejects %s', (url) => {
    expect(extractYouTubeId(url)).toBeNull();
  });
});

describe('downloader registry', () => {
  it('routes YouTube links to the YouTube provider', () => {
    expect(resolveDownloader('https://www.youtube.com/watch?v=abc123def45')?.id).toBe('youtube');
  });

  it('routes direct audio links to the direct provider', () => {
    const downloader = resolveDownloader('https://archive.org/file.mp3');
    expect(downloader).toBeInstanceOf(DirectAudioDownloader);
  });

  it('returns undefined for non-http input', () => {
    expect(resolveDownloader('javascript:alert(1)')).toBeUndefined();
    expect(resolveDownloader('ftp://files.example.com/a.mp3')).toBeUndefined();
  });
});

describe('format detection', () => {
  it('maps common extensions and codecs', () => {
    expect(detectFormat({ filename: 'song.mp3' })).toBe('mp3');
    expect(detectFormat({ filename: 'song.m4a', codec: 'mp4a.40.2' })).toBe('aac');
    expect(detectFormat({ filename: 'song.m4a', codec: 'alac' })).toBe('alac');
    expect(detectFormat({ filename: 'song.flac' })).toBe('flac');
    expect(detectFormat({ codec: 'opus' })).toBe('opus');
    expect(detectFormat({ container: 'ogg', codec: 'vorbis' })).toBe('ogg');
  });

  it('classifies lossless formats for conversion decisions', () => {
    expect(isLossless('wav')).toBe(true);
    expect(isLossless('flac')).toBe(true);
    expect(isLossless('alac')).toBe(true);
    expect(isLossless('mp3')).toBe(false);
    expect(isLossless('opus')).toBe(false);
  });
});

describe('filename metadata parsing', () => {
  it('splits "Artist - Title" patterns', () => {
    expect(parseFilenameMetadata('Arijit Singh - Tum Hi Ho.mp3')).toEqual({
      artist: 'Arijit Singh',
      title: 'Tum Hi Ho',
    });
  });

  it('skips leading track numbers', () => {
    expect(parseFilenameMetadata('01 - Arijit Singh - Tum Hi Ho.mp3')).toEqual({
      artist: 'Arijit Singh',
      title: 'Tum Hi Ho',
    });
  });

  it('falls back to the whole basename', () => {
    expect(parseFilenameMetadata('just a song name')).toEqual({
      title: 'just a song name',
    });
  });
});
