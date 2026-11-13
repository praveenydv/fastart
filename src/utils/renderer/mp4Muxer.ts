// FastArt Pure Zero-Dependency MP4 (ISOBMFF) Fast Muxer
// Multiplexes H.264 (AVC) and optional AAC audio bitstreams into standard,
// streaming-compatible ISO/IEC 14496-12 / 14496-14 MP4 files for Web & Mobile.

export interface EncodedChunkSample {
  data: Uint8Array;
  isKey: boolean;
  timestampUs: number; // in microseconds
  durationUs?: number; // in microseconds
}

export interface AudioChunkSample {
  data: Uint8Array;
  timestampUs: number;
  durationUs?: number;
}

export interface Mp4MuxOptions {
  width: number;
  height: number;
  fps: number;
  videoSamples: EncodedChunkSample[];
  avcDescription?: Uint8Array | null; // Raw avcC extradata from VideoEncoder
  audioSamples?: AudioChunkSample[];
  audioSampleRate?: number;
  audioChannels?: number;
  audioDescription?: Uint8Array | null; // Raw esds / AudioSpecificConfig
}

export class Mp4Writer {
  private parts: Uint8Array[] = [];
  private totalSize = 0;

  push(data: Uint8Array): void {
    this.parts.push(data);
    this.totalSize += data.length;
  }

  getParts(): Uint8Array[] {
    return this.parts;
  }

  getTotalSize(): number {
    return this.totalSize;
  }

  toBlob(mimeType = "video/mp4"): Blob {
    // If any individual chunk is larger than 16MB, slice it into smaller safe chunks
    // to guarantee it never hits browser ArrayBufferView size limits in Chromium/WebKit
    const CHUNK_LIMIT = 16 * 1024 * 1024; // 16 MB
    const safeParts: BlobPart[] = [];
    for (const part of this.parts) {
      if (part.byteLength > CHUNK_LIMIT) {
        for (let offset = 0; offset < part.byteLength; offset += CHUNK_LIMIT) {
          safeParts.push(
            part.subarray(offset, Math.min(part.byteLength, offset + CHUNK_LIMIT)) as unknown as BlobPart,
          );
        }
      } else {
        safeParts.push(part as unknown as BlobPart);
      }
    }
    return new Blob(safeParts, { type: mimeType });
  }

  box(type: string, payload: Uint8Array): Uint8Array {
    const size = 8 + payload.length;
    const header = new Uint8Array(8);
    const view = new DataView(header.buffer);
    view.setUint32(0, size);
    for (let i = 0; i < 4; i++) header[4 + i] = type.charCodeAt(i);

    const out = new Uint8Array(size);
    out.set(header, 0);
    out.set(payload, 8);
    return out;
  }

  container(type: string, children: Uint8Array[]): Uint8Array {
    let childSize = 0;
    for (const c of children) childSize += c.length;
    const payload = new Uint8Array(childSize);
    let offset = 0;
    for (const c of children) {
      payload.set(c, offset);
      offset += c.length;
    }
    return this.box(type, payload);
  }

  toUint8Array(): Uint8Array {
    const res = new Uint8Array(this.totalSize);
    let offset = 0;
    for (const p of this.parts) {
      res.set(p, offset);
      offset += p.length;
    }
    return res;
  }
}

// Fallback Baseline SPS/PPS generator if encoder description was not emitted
function createDefaultAvcC(width: number, height: number): Uint8Array {
  // Baseline profile (66), level 3.1 (31)
  const sps = new Uint8Array([
    0x67, 0x42, 0xc0, 0x1f, 0xda, 0x01, 0x40, 0x16, 0xe8, 0x06, 0xd0, 0xa1,
    0x35,
  ]);
  const pps = new Uint8Array([0x68, 0xce, 0x3c, 0x80]);

  const avcc = new Uint8Array(19 + sps.length + pps.length);
  avcc[0] = 1; // configurationVersion
  avcc[1] = 0x42; // AVCProfileIndication
  avcc[2] = 0xc0; // profile_compatibility
  avcc[3] = 0x1f; // AVCLevelIndication
  avcc[4] = 0xff; // lengthSizeMinusOne = 3 (4-byte NAL length)
  avcc[5] = 0xe1; // numOfSequenceParameterSets = 1
  avcc[6] = (sps.length >> 8) & 0xff;
  avcc[7] = sps.length & 0xff;
  avcc.set(sps, 8);

  const ppsOffset = 8 + sps.length;
  avcc[ppsOffset] = 1; // numOfPictureParameterSets = 1
  avcc[ppsOffset + 1] = (pps.length >> 8) & 0xff;
  avcc[ppsOffset + 2] = pps.length & 0xff;
  avcc.set(pps, ppsOffset + 3);

  return avcc;
}

function createDefaultAsc(sampleRate: number, channels: number): Uint8Array {
  const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  let sfi = rates.indexOf(sampleRate);
  if (sfi < 0) sfi = 4; // default 44.1kHz
  const aot = 2; // AAC-LC
  const ch = Math.max(1, Math.min(channels || 2, 7));
  const b0 = (aot << 3) | ((sfi >> 1) & 0x07);
  const b1 = ((sfi & 0x01) << 7) | (ch << 3);
  return new Uint8Array([b0, b1]);
}

function createEsdsPayload(asc: Uint8Array): Uint8Array {
  // ISO/IEC 14496-14 ES_Descriptor containing DecoderConfigDescriptor and AudioSpecificConfig
  const esds = new Uint8Array(23 + asc.length);
  const v = new DataView(esds.buffer);
  // version (1 byte = 0) + flags (3 bytes = 0)
  esds[4] = 0x03; // ES_Descriptor tag
  esds[5] = 17 + asc.length; // ES_Descriptor length
  v.setUint16(6, 1); // ES_ID = 1
  esds[8] = 0x00; // streamPriority = 0
  // DecoderConfigDescriptor
  esds[9] = 0x04; // tag = 0x04
  esds[10] = 12 + asc.length; // length
  esds[11] = 0x40; // objectTypeIndication = Audio ISO/IEC 14496-3 (AAC)
  esds[12] = 0x15; // streamType = Audio (5 << 2 | 1)
  // bufferSizeDB (3 bytes = 0x00, 0x03, 0x00)
  esds[13] = 0x00;
  esds[14] = 0x03;
  esds[15] = 0x00;
  v.setUint32(16, 256000); // maxBitrate (256 kbps)
  v.setUint32(20, 192000); // avgBitrate (192 kbps)
  // DecoderSpecificInfo tag
  esds[24] = 0x05; // tag = 0x05
  esds[25] = asc.length;
  esds.set(asc, 26);
  // SLConfigDescriptor tag
  const slOffset = 26 + asc.length;
  esds[slOffset] = 0x06;
  esds[slOffset + 1] = 0x01;
  esds[slOffset + 2] = 0x02; // predefined = 2
  return esds;
}

export function buildMp4Writer(options: Mp4MuxOptions): Mp4Writer {
  const {
    width,
    height,
    fps,
    videoSamples,
    avcDescription,
    audioSamples = [],
    audioSampleRate = 44100,
    audioChannels = 2,
    audioDescription,
  } = options;

  if (videoSamples.length === 0) {
    throw new Error("Cannot mux MP4 with 0 video samples");
  }

  const w = new Mp4Writer();

  // 1. ftyp box (isom, iso2, avc1, mp41)
  const brands = ["isom", "iso2", "avc1", "mp41"];
  const ftypPayload = new Uint8Array(8 + brands.length * 4);
  const ftypView = new DataView(ftypPayload.buffer);
  ftypPayload.set([0x69, 0x73, 0x6f, 0x6d], 0); // major brand: isom
  ftypView.setUint32(4, 512); // minor version: 512
  for (let i = 0; i < brands.length; i++) {
    for (let j = 0; j < 4; j++) {
      ftypPayload[8 + i * 4 + j] = brands[i].charCodeAt(j);
    }
  }
  const ftypBox = w.box("ftyp", ftypPayload);
  w.push(ftypBox);

  // 2. Format samples: Ensure all NAL units have 4-byte big-endian length prefix (AVCC)
  const formattedVideoSamples: Uint8Array[] = [];
  const keyframeIndices: number[] = []; // 1-based indices for stss

  for (let i = 0; i < videoSamples.length; i++) {
    const s = videoSamples[i];
    let data = s.data;

    // Check if chunk is prefixed with Annex B (00 00 00 01) and convert to 4-byte length prefix
    if (
      data.length >= 4 &&
      data[0] === 0 &&
      data[1] === 0 &&
      data[2] === 0 &&
      data[3] === 1
    ) {
      const copy = new Uint8Array(data);
      const nalLen = data.length - 4;
      const dv = new DataView(copy.buffer);
      dv.setUint32(0, nalLen);
      data = copy;
    } else if (
      data.length >= 3 &&
      data[0] === 0 &&
      data[1] === 0 &&
      data[2] === 1
    ) {
      const copy = new Uint8Array(data.length + 1);
      const nalLen = data.length - 3;
      const dv = new DataView(copy.buffer);
      dv.setUint32(0, nalLen);
      copy.set(data.subarray(3), 4);
      data = copy;
    }

    formattedVideoSamples.push(data);
    if (s.isKey) {
      keyframeIndices.push(i + 1);
    }
  }

  // 3. Assemble mdat box
  let mdatPayloadSize = 0;
  for (const s of formattedVideoSamples) {
    mdatPayloadSize += s.length;
  }
  for (const a of audioSamples) {
    mdatPayloadSize += a.data.length;
  }

  const mdatHeader = new Uint8Array(8);
  const mdatView = new DataView(mdatHeader.buffer);
  mdatView.setUint32(0, 8 + mdatPayloadSize);
  mdatHeader.set([0x6d, 0x64, 0x61, 0x74], 4); // "mdat"
  w.push(mdatHeader);

  // Calculate chunk offsets for stco
  const mdatPayloadStartOffset = ftypBox.length + 8;
  const chunkOffsets: number[] = [];
  let currentOffset = mdatPayloadStartOffset;

  for (const s of formattedVideoSamples) {
    chunkOffsets.push(currentOffset);
    w.push(s);
    currentOffset += s.length;
  }

  // Optional audio samples in mdat
  const audioChunkOffsets: number[] = [];
  for (const a of audioSamples) {
    audioChunkOffsets.push(currentOffset);
    w.push(a.data);
    currentOffset += a.data.length;
  }

  // 4. Build moov box
  const timescale = fps * 1000;
  const sampleDuration = 1000; // in timescale units (timescale / fps)
  const totalVideoDuration = formattedVideoSamples.length * sampleDuration;
  const movieDuration = totalVideoDuration;

  // mvhd box (108 bytes box total = 100 bytes payload)
  const mvhdPayload = new Uint8Array(100);
  const mvhdView = new DataView(mvhdPayload.buffer);
  mvhdView.setUint8(0, 0); // version
  // creation_time: 4, mod_time: 8
  mvhdView.setUint32(12, timescale); // timescale
  mvhdView.setUint32(16, movieDuration); // duration
  mvhdView.setUint32(20, 0x00010000); // rate 1.0
  mvhdView.setUint16(24, 0x0100); // volume 1.0
  // matrix (36 bytes starting at 36)
  mvhdView.setUint32(36, 0x00010000);
  mvhdView.setUint32(52, 0x00010000);
  mvhdView.setUint32(84, 0x40000000);
  mvhdView.setUint32(96, audioSamples.length > 0 ? 3 : 2); // next_track_id
  const mvhdBox = w.box("mvhd", mvhdPayload);

  // Video trak -> tkhd
  const tkhdPayload = new Uint8Array(84);
  const tkhdView = new DataView(tkhdPayload.buffer);
  tkhdView.setUint8(0, 0); // version
  tkhdPayload[3] = 3; // flags: track_enabled (1) | track_in_movie (2)
  tkhdView.setUint32(12, 1); // track_id: 1
  tkhdView.setUint32(20, movieDuration); // duration
  // matrix
  tkhdView.setUint32(36, 0x00010000);
  tkhdView.setUint32(52, 0x00010000);
  tkhdView.setUint32(68, 0x40000000);
  tkhdView.setUint32(76, width << 16); // width (fixed point 16.16)
  tkhdView.setUint32(80, height << 16); // height (fixed point 16.16)
  const tkhdBox = w.box("tkhd", tkhdPayload);

  // mdhd
  const mdhdPayload = new Uint8Array(24);
  const mdhdView = new DataView(mdhdPayload.buffer);
  mdhdView.setUint32(12, timescale); // timescale
  mdhdView.setUint32(16, totalVideoDuration); // duration
  mdhdView.setUint16(20, 0x55c4); // language "und"
  const mdhdBox = w.box("mdhd", mdhdPayload);

  // hdlr
  const hdlrPayload = new Uint8Array(37);
  hdlrPayload.set([0x76, 0x69, 0x64, 0x65], 8); // handler_type: "vide"
  const hdlrName = "FastArt Video";
  for (let i = 0; i < hdlrName.length; i++) {
    hdlrPayload[24 + i] = hdlrName.charCodeAt(i);
  }
  const hdlrBox = w.box("hdlr", hdlrPayload);

  // vmhd
  const vmhdPayload = new Uint8Array(12);
  vmhdPayload[3] = 1; // flags = 1
  const vmhdBox = w.box("vmhd", vmhdPayload);

  // dinf -> dref -> url
  const urlBox = w.box("url ", new Uint8Array([0, 0, 0, 1]));
  const drefPayload = new Uint8Array(8 + urlBox.length);
  const drefView = new DataView(drefPayload.buffer);
  drefView.setUint32(4, 1); // entry count = 1
  drefPayload.set(urlBox, 8);
  const drefBox = w.box("dref", drefPayload);
  const dinfBox = w.container("dinf", [drefBox]);

  // stsd -> avc1 -> avcC
  const avccData =
    avcDescription && avcDescription.length > 0
      ? avcDescription
      : createDefaultAvcC(width, height);
  const avccBox = w.box("avcC", avccData);

  const avc1Payload = new Uint8Array(78 + avccBox.length);
  const avc1View = new DataView(avc1Payload.buffer);
  avc1View.setUint16(6, 1); // data_reference_index = 1
  avc1View.setUint16(24, width); // width
  avc1View.setUint16(26, height); // height
  avc1View.setUint32(28, 0x00480000); // 72 dpi
  avc1View.setUint32(32, 0x00480000); // 72 dpi
  avc1View.setUint16(40, 1); // frame_count = 1
  avc1View.setUint16(74, 0x0018); // depth = 24
  avc1View.setInt16(76, -1); // pre_defined = -1
  avc1Payload.set(avccBox, 78);
  const avc1Box = w.box("avc1", avc1Payload);

  const stsdPayload = new Uint8Array(8 + avc1Box.length);
  const stsdView = new DataView(stsdPayload.buffer);
  stsdView.setUint32(4, 1); // entry_count = 1
  stsdPayload.set(avc1Box, 8);
  const stsdBox = w.box("stsd", stsdPayload);

  // stts (time to sample)
  const sttsPayload = new Uint8Array(16);
  const sttsView = new DataView(sttsPayload.buffer);
  sttsView.setUint32(4, 1); // entry_count = 1
  sttsView.setUint32(8, formattedVideoSamples.length); // sample_count
  sttsView.setUint32(12, sampleDuration); // sample_delta
  const sttsBox = w.box("stts", sttsPayload);

  // stss (sync sample table - keyframes)
  const stssPayload = new Uint8Array(8 + keyframeIndices.length * 4);
  const stssView = new DataView(stssPayload.buffer);
  stssView.setUint32(4, keyframeIndices.length); // entry count
  for (let i = 0; i < keyframeIndices.length; i++) {
    stssView.setUint32(8 + i * 4, keyframeIndices[i]);
  }
  const stssBox = w.box("stss", stssPayload);

  // stsc (sample to chunk)
  const stscPayload = new Uint8Array(20);
  const stscView = new DataView(stscPayload.buffer);
  stscView.setUint32(4, 1); // 1 entry
  stscView.setUint32(8, 1); // first_chunk = 1
  stscView.setUint32(12, 1); // samples_per_chunk = 1
  stscView.setUint32(16, 1); // sample_description_index = 1
  const stscBox = w.box("stsc", stscPayload);

  // stsz (sample sizes)
  const stszPayload = new Uint8Array(12 + formattedVideoSamples.length * 4);
  const stszView = new DataView(stszPayload.buffer);
  stszView.setUint32(4, 0); // sample_size = 0 (variable)
  stszView.setUint32(8, formattedVideoSamples.length); // sample_count
  for (let i = 0; i < formattedVideoSamples.length; i++) {
    stszView.setUint32(12 + i * 4, formattedVideoSamples[i].length);
  }
  const stszBox = w.box("stsz", stszPayload);

  // stco (chunk offsets)
  const stcoPayload = new Uint8Array(8 + chunkOffsets.length * 4);
  const stcoView = new DataView(stcoPayload.buffer);
  stcoView.setUint32(4, chunkOffsets.length); // entry_count
  for (let i = 0; i < chunkOffsets.length; i++) {
    stcoView.setUint32(8 + i * 4, chunkOffsets[i]);
  }
  const stcoBox = w.box("stco", stcoPayload);

  // Assemble video stbl -> minf -> mdia -> trak
  const stblChildren = [stsdBox, sttsBox];
  if (keyframeIndices.length > 0) {
    stblChildren.push(stssBox);
  }
  stblChildren.push(stscBox, stszBox, stcoBox);
  const stblBox = w.container("stbl", stblChildren);
  const minfBox = w.container("minf", [vmhdBox, dinfBox, stblBox]);
  const mdiaBox = w.container("mdia", [mdhdBox, hdlrBox, minfBox]);
  const videoTrakBox = w.container("trak", [tkhdBox, mdiaBox]);

  const moovChildren = [mvhdBox, videoTrakBox];

  // Optional Audio Track
  if (audioSamples.length > 0) {
    const audioTimescale = audioSampleRate;
    let totalAudioDuration = 0;
    for (const a of audioSamples) {
      totalAudioDuration += a.durationUs
        ? Math.round((a.durationUs * audioTimescale) / 1000000)
        : 1024;
    }

    // Audio tkhd
    const aTkhdPayload = new Uint8Array(84);
    const aTkhdView = new DataView(aTkhdPayload.buffer);
    aTkhdPayload[3] = 3;
    aTkhdView.setUint32(12, 2); // track_id = 2
    aTkhdView.setUint32(20, movieDuration);
    aTkhdView.setUint16(44, 0x0100); // volume 1.0
    aTkhdView.setUint32(36, 0x00010000);
    aTkhdView.setUint32(52, 0x00010000);
    aTkhdView.setUint32(68, 0x40000000);
    const aTkhdBox = w.box("tkhd", aTkhdPayload);

    // Audio mdhd
    const aMdhdPayload = new Uint8Array(24);
    const aMdhdView = new DataView(aMdhdPayload.buffer);
    aMdhdView.setUint32(12, audioTimescale);
    aMdhdView.setUint32(16, totalAudioDuration);
    aMdhdView.setUint16(20, 0x55c4);
    const aMdhdBox = w.box("mdhd", aMdhdPayload);

    // Audio hdlr
    const aHdlrPayload = new Uint8Array(37);
    aHdlrPayload.set([0x73, 0x6f, 0x75, 0x6e], 8); // "soun"
    const aHdlrName = "FastArt Audio";
    for (let i = 0; i < aHdlrName.length; i++) {
      aHdlrPayload[24 + i] = aHdlrName.charCodeAt(i);
    }
    const aHdlrBox = w.box("hdlr", aHdlrPayload);

    // smhd
    const smhdBox = w.box("smhd", new Uint8Array(8));

    // Audio stsd -> mp4a -> esds
    let esdsPayload: Uint8Array;
    if (audioDescription && audioDescription.length > 10) {
      esdsPayload = audioDescription;
    } else {
      const asc = (audioDescription && audioDescription.length > 0)
        ? audioDescription
        : createDefaultAsc(audioSampleRate, audioChannels);
      esdsPayload = createEsdsPayload(asc);
    }
    const esdsBox = w.box("esds", esdsPayload);

    const mp4aPayload = new Uint8Array(28 + esdsBox.length);
    const mp4aView = new DataView(mp4aPayload.buffer);
    mp4aView.setUint16(6, 1); // data_reference_index = 1
    mp4aView.setUint16(16, audioChannels);
    mp4aView.setUint16(18, 16); // 16-bit
    mp4aView.setUint32(24, Math.round(audioSampleRate * 65536));
    mp4aPayload.set(esdsBox, 28);
    const mp4aBox = w.box("mp4a", mp4aPayload);

    const aStsdPayload = new Uint8Array(8 + mp4aBox.length);
    const aStsdView = new DataView(aStsdPayload.buffer);
    aStsdView.setUint32(4, 1);
    aStsdPayload.set(mp4aBox, 8);
    const aStsdBox = w.box("stsd", aStsdPayload);

    // Audio stts
    const aSttsPayload = new Uint8Array(16);
    const aSttsView = new DataView(aSttsPayload.buffer);
    aSttsView.setUint32(4, 1);
    aSttsView.setUint32(8, audioSamples.length);
    aSttsView.setUint32(12, 1024); // AAC sample size
    const aSttsBox = w.box("stts", aSttsPayload);

    // Audio stsc
    const aStscPayload = new Uint8Array(20);
    const aStscView = new DataView(aStscPayload.buffer);
    aStscView.setUint32(4, 1);
    aStscView.setUint32(8, 1);
    aStscView.setUint32(12, 1);
    aStscView.setUint32(16, 1);
    const aStscBox = w.box("stsc", aStscPayload);

    // Audio stsz
    const aStszPayload = new Uint8Array(12 + audioSamples.length * 4);
    const aStszView = new DataView(aStszPayload.buffer);
    aStszView.setUint32(4, 0);
    aStszView.setUint32(8, audioSamples.length);
    for (let i = 0; i < audioSamples.length; i++) {
      aStszView.setUint32(12 + i * 4, audioSamples[i].data.length);
    }
    const aStszBox = w.box("stsz", aStszPayload);

    // Audio stco
    const aStcoPayload = new Uint8Array(8 + audioChunkOffsets.length * 4);
    const aStcoView = new DataView(aStcoPayload.buffer);
    aStcoView.setUint32(4, audioChunkOffsets.length);
    for (let i = 0; i < audioChunkOffsets.length; i++) {
      aStcoView.setUint32(8 + i * 4, audioChunkOffsets[i]);
    }
    const aStcoBox = w.box("stco", aStcoPayload);

    const aStblBox = w.container("stbl", [
      aStsdBox,
      aSttsBox,
      aStscBox,
      aStszBox,
      aStcoBox,
    ]);
    const aMinfBox = w.container("minf", [smhdBox, dinfBox, aStblBox]);
    const aMdiaBox = w.container("mdia", [aMdhdBox, aHdlrBox, aMinfBox]);
    const aTrakBox = w.container("trak", [aTkhdBox, aMdiaBox]);

    moovChildren.push(aTrakBox);
  }

  const moovBox = w.container("moov", moovChildren);
  w.push(moovBox);

  return w;
}

export function muxMp4(options: Mp4MuxOptions): Uint8Array {
  const w = buildMp4Writer(options);
  return w.toUint8Array();
}

export function muxMp4ToBlob(
  options: Mp4MuxOptions,
  mimeType = "video/mp4"
): { blob: Blob; size: number } {
  const w = buildMp4Writer(options);
  return {
    blob: w.toBlob(mimeType),
    size: w.getTotalSize(),
  };
}
