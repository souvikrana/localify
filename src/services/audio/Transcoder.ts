import { AppError } from '@/utils/errors';
import type { AudioQuality } from '@/types';
import { OggOpusMuxer } from './OggOpusMuxer';

const BITRATES: Record<AudioQuality, number> = {
  high: 192_000,
  balanced: 128_000,
  saver: 96_000,
};

const TARGET_SAMPLE_RATE = 48_000;
const FRAME_SAMPLES = 960; // 20 ms at 48 kHz
/** Sources above this size are kept as-is to avoid memory spikes on decode. */
const MAX_TRANSCODE_SOURCE_BYTES = 300 * 1024 * 1024;

export interface TranscodeResult {
  blob: Blob;
  format: 'opus';
  mimeType: 'audio/ogg';
  bitrateKbps: number;
}

export function isTranscodingSupported(): boolean {
  return (
    typeof AudioEncoder !== 'undefined' &&
    typeof OfflineAudioContext !== 'undefined' &&
    typeof AudioData !== 'undefined'
  );
}

export async function opusEncoderSupported(channels = 2): Promise<boolean> {
  if (!isTranscodingSupported()) return false;
  try {
    const support = await AudioEncoder.isConfigSupported({
      codec: 'opus',
      sampleRate: TARGET_SAMPLE_RATE,
      numberOfChannels: channels,
      bitrate: BITRATES.balanced,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Decode any browser-supported audio (WAV, FLAC, AIFF…) and re-encode as
 * Opus-in-Ogg. The output is verified by a decode round-trip before being
 * returned — if anything fails we throw and the caller keeps the original.
 */
export async function transcodeToOpus(
  source: Blob,
  quality: AudioQuality,
  opts: { signal?: AbortSignal } = {}
): Promise<TranscodeResult> {
  if (!isTranscodingSupported()) {
    throw new AppError('Audio transcoding is not supported by this browser', 'unsupported-format');
  }
  if (source.size > MAX_TRANSCODE_SOURCE_BYTES) {
    throw new AppError('File too large to convert in the browser', 'unsupported-format');
  }

  let decoded: AudioBuffer;
  try {
    const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: TARGET_SAMPLE_RATE });
    decoded = await ctx.decodeAudioData(await source.arrayBuffer());
  } catch {
    throw new AppError('Could not read this audio file', 'corrupt-file');
  }
  opts.signal?.throwIfAborted();

  const channels = Math.min(2, decoded.numberOfChannels);
  const support = await AudioEncoder.isConfigSupported({
    codec: 'opus',
    sampleRate: TARGET_SAMPLE_RATE,
    numberOfChannels: channels,
    bitrate: BITRATES[quality],
  });
  if (!support.supported) {
    throw new AppError('This browser cannot encode Opus audio', 'unsupported-format');
  }

  // Downmix >2 channels to stereo.
  let planar: Float32Array[];
  if (decoded.numberOfChannels > 2) {
    planar = [new Float32Array(decoded.length), new Float32Array(decoded.length)];
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      const target = planar[ch % 2];
      if (!target) continue;
      for (let i = 0; i < data.length; i += 8) {
        for (let j = i; j < Math.min(i + 8, data.length); j++) {
          const sample = data[j];
          if (sample !== undefined) target[j] = (target[j] ?? 0) + (sample / decoded.numberOfChannels) * 2;
        }
      }
    }
  } else {
    planar = Array.from({ length: channels }, (_, ch) =>
      Float32Array.from(decoded.getChannelData(Math.min(ch, decoded.numberOfChannels - 1)))
    );
  }

  const muxer = new OggOpusMuxer(channels, decoded.sampleRate, FRAME_SAMPLES);
  muxer.begin();

  let encoderError: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      muxer.addPacket(bytes);
    },
    error: (err) => {
      encoderError = err;
    },
  });

  encoder.configure({
    codec: 'opus',
    sampleRate: TARGET_SAMPLE_RATE,
    numberOfChannels: channels,
    bitrate: BITRATES[quality],
  });

  const frameFloat = new Float32Array(FRAME_SAMPLES * channels);
  const totalSamples = decoded.length;
  for (let offset = 0; offset < totalSamples; offset += FRAME_SAMPLES) {
    if (encoder.state === 'closed') break;
    if (encoder.encodeQueueSize > 24) {
      await waitForDequeue(encoder);
    }
    const count = Math.min(FRAME_SAMPLES, totalSamples - offset);
    for (let ch = 0; ch < channels; ch++) {
      const channelData = planar[ch];
      if (!channelData) break;
      frameFloat.set(channelData.subarray(offset, offset + count), ch * FRAME_SAMPLES);
    }
    // Zero-pad the final partial frame so every packet is a full 20 ms.
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: TARGET_SAMPLE_RATE,
      numberOfFrames: FRAME_SAMPLES,
      numberOfChannels: channels,
      timestamp: Math.round((offset / TARGET_SAMPLE_RATE) * 1_000_000),
      data: frameFloat,
    });
    encoder.encode(audioData);
    audioData.close();
    if (count < FRAME_SAMPLES) break;
  }
  opts.signal?.throwIfAborted();
  await encoder.flush();
  encoder.close();
  if (encoderError) {
    throw new AppError('Encoding failed', 'unknown', encoderError);
  }

  const ogg = muxer.finish();

  // Verify before trusting our own muxer: decode it back and compare duration.
  const ok = await verifyOggOpus(ogg, totalSamples / TARGET_SAMPLE_RATE);
  if (!ok) throw new AppError('Encoded audio failed verification', 'corrupt-file');

  return { blob: ogg, format: 'opus', mimeType: 'audio/ogg', bitrateKbps: BITRATES[quality] / 1000 };
}

async function verifyOggOpus(blob: Blob, expectedSeconds: number): Promise<boolean> {
  try {
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (!(head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53)) {
      return false; // "OggS" magic missing
    }
    const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: TARGET_SAMPLE_RATE });
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) return false;
    const tolerance = Math.max(0.35, expectedSeconds * 0.02);
    return Math.abs(buffer.duration - expectedSeconds) <= tolerance;
  } catch {
    return false;
  }
}

function waitForDequeue(encoder: AudioEncoder): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (encoder.encodeQueueSize <= 8 ? resolve() : setTimeout(check, 16));
    check();
  });
}
