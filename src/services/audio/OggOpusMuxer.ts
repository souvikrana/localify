/**
 * Minimal Ogg Opus stream muxer (RFC 7845 subset).
 *
 * Produces a valid Ogg encapsulation of Opus packets emitted by WebCodecs'
 * AudioEncoder: BOS page with OpusHead, a comment header page, then framed
 * audio pages ending with an EOS page carrying the final granule position.
 *
 * The result is verified by decoding before it replaces the original file,
 * so any bug here degrades gracefully to "store the original".
 */

const OGG_CRC_POLY = 0x04c11db7;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = (r << 1) ^ (r & 0x80000000 ? OGG_CRC_POLY : 0);
    }
    table[i] = r >>> 0;
  }
  return table;
})();

function oggCrc(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    crc = ((crc << 8) ^ (CRC_TABLE[((crc >>> 24) ^ byte) & 0xff] ?? 0)) >>> 0;
  }
  return crc >>> 0;
}

/** Max payload bytes per Ogg page (well under the 64KiB hard limit). */
const PAGE_PAYLOAD_LIMIT = 16 * 1024;

interface PageOptions {
  headerType: number;
  /** Absolute granule position for this page (-1 for unset). */
  granule: number;
}

export class OggOpusMuxer {
  private readonly parts: Uint8Array[] = [];
  private readonly serial: number;
  private sequence = 0;
  private pendingPackets: Uint8Array[] = [];
  private pendingBytes = 0;
  private granule = 0;
  private started = false;

  constructor(
    private readonly channels: number,
    private readonly inputSampleRate: number,
    /** Samples per channel per encoded packet (e.g. 960 for 20ms @ 48 kHz). */
    private readonly samplesPerPacket: number
  ) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    this.serial = (buf[0] ?? 0) | 0;
  }

  /** Write identification + comment headers (call once before addPacket). */
  begin(): void {
    if (this.started) return;
    this.started = true;
    const head = this.buildOpusHead();
    const tags = this.buildOpusTags();
    this.parts.push(this.buildPage({ headerType: 0x02 /* BOS */, granule: 0 }, [head]));
    this.sequence++;
    this.parts.push(this.buildPage({ headerType: 0x00, granule: 0 }, [tags]));
    this.sequence++;
  }

  addPacket(packet: Uint8Array): void {
    if (!this.started) this.begin();
    const lacingExtra = packet.length % 255 === 0 ? 1 : 0; // zero terminator rule
    const projected =
      this.pendingBytes +
      packet.length +
      Math.ceil((packet.length + lacingExtra) / 255) +
      27 +
      this.pendingPackets.length +
      1;
    if (this.pendingPackets.length > 0 && projected > PAGE_PAYLOAD_LIMIT) {
      this.flushPage(false);
    }
    this.pendingPackets.push(packet);
    this.pendingBytes += packet.length;
    this.granule += this.samplesPerPacket;
  }

  /** Finish the stream and return the muxed Ogg blob. */
  finish(): Blob {
    this.flushPage(true);
    // Copy each chunk into freshly allocated ArrayBuffers so every part is a
    // valid BlobPart regardless of how the source bytes were constructed.
    return new Blob(
      this.parts.map(
        (part) => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer
      ),
      { type: 'audio/ogg' }
    );
  }

  private flushPage(eos: boolean): void {
    if (this.pendingPackets.length === 0 && !eos) return;
    const headerType = eos ? 0x04 /* EOS */ : 0x00;
    this.parts.push(
      this.buildPage({ headerType, granule: this.granule }, this.pendingPackets)
    );
    this.sequence++;
    this.pendingPackets = [];
    this.pendingBytes = 0;
  }

  private buildOpusHead(): Uint8Array {
    const head = new Uint8Array(19);
    head.set(new TextEncoder().encode('OpusHead'), 0);
    const view = new DataView(head.buffer);
    head[8] = 1; // version
    head[9] = this.channels;
    view.setUint16(10, 0, true); // pre-skip
    view.setUint32(12, this.inputSampleRate, true);
    view.setInt16(16, 0, true); // output gain
    head[18] = 0; // channel mapping family
    return head;
  }

  private buildOpusTags(): Uint8Array {
    const vendor = new TextEncoder().encode('Localify');
    const tags = new Uint8Array(8 + 4 + vendor.length + 4);
    tags.set(new TextEncoder().encode('OpusTags'), 0);
    const view = new DataView(tags.buffer);
    view.setUint32(8, vendor.length, true);
    tags.set(vendor, 12);
    view.setUint32(12 + vendor.length, 0, true); // zero user comments
    return tags;
  }

  private buildPage(opts: PageOptions, packets: Uint8Array[]): Uint8Array {
    // Segment table: packets <= 255 bytes get one entry; longer get ceil(n/255)
    // 255-entries plus a final remainder (with the zero-terminator exception).
    const segments: number[][] = packets.map((p) => {
      const n = p.length;
      if (n === 0) return [0];
      const full = Math.floor(n / 255);
      const remainder = n % 255;
      const lace: number[] = new Array(full + (remainder > 0 ? 1 : 0)).fill(255);
      if (remainder > 0) lace[lace.length - 1] = remainder;
      else lace.push(0);
      return lace;
    });
    const segmentTable = segments.flat();
    const payloadBytes = packets.reduce((sum, p) => sum + p.length, 0);
    const page = new Uint8Array(27 + segmentTable.length + payloadBytes);

    page.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
    page[4] = 0; // stream structure version
    page[5] = opts.headerType;
    const view = new DataView(page.buffer);
    view.setBigInt64(6, BigInt(Math.max(-1, Math.trunc(opts.granule))), true);
    view.setInt32(14, this.serial, true);
    view.setInt32(18, this.sequence, true);
    view.setUint32(22, 0, true); // CRC placeholder
    page[26] = segmentTable.length;
    let offset = 27;
    for (const value of segmentTable) page[offset++] = value;
    for (const packet of packets) {
      page.set(packet, offset);
      offset += packet.length;
    }
    view.setUint32(22, oggCrc(page), true);
    return page;
  }
}
