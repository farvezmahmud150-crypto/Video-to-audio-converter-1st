import { Mp3Encoder } from '@breezystack/lamejs';
import { AudioFormat } from '../types';
import { getBufferFromCache } from './fileStorage';

export interface ConvertOptions {
  format?: AudioFormat;
  startTime: number;
  endTime: number;
  bitrate: number; // e.g. 128, 192, 256, 320
  channels: 'stereo' | 'mono';
  volume: number; // 1.0 = normal
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  objectUrl?: string;
  cachedBuffer?: ArrayBuffer;
  cacheKey?: string;
  onProgress?: (progress: number, phase: 'decoding' | 'encoding' | 'done') => void;
}

export interface ConvertResult {
  blob: Blob;
  url: string;
  format: AudioFormat;
  duration: number;
  size: number;
  channels: number;
  sampleRate: number;
  bitrate?: number;
}

/**
 * Encodes 16-bit PCM samples into a standard RIFF/WAVE (.wav) container Blob
 */
export function encodeWav(
  leftInt16: Int16Array,
  rightInt16: Int16Array,
  numChannels: 1 | 2,
  sampleRate: number
): Blob {
  const numSamples = leftInt16.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // Write PCM audio samples
  let offset = 44;
  if (numChannels === 1) {
    for (let i = 0; i < numSamples; i++) {
      view.setInt16(offset, leftInt16[i], true);
      offset += 2;
    }
  } else {
    for (let i = 0; i < numSamples; i++) {
      view.setInt16(offset, leftInt16[i], true);
      offset += 2;
      view.setInt16(offset, rightInt16[i], true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function readFileAsArrayBuffer(
  file: File,
  objectUrl?: string,
  cachedBuffer?: ArrayBuffer,
  cacheKey?: string
): Promise<ArrayBuffer> {
  // Strategy 0: In-Memory Cached Buffer (highest speed & zero I/O)
  if (cachedBuffer && cachedBuffer.byteLength > 0) {
    return cachedBuffer.slice(0);
  }

  // Strategy 1: Persistent IndexedDB Cache (immune to mobile browser standby / app backgrounding)
  if (cacheKey) {
    try {
      const dbBuf = await getBufferFromCache(cacheKey);
      if (dbBuf && dbBuf.byteLength > 0) {
        return dbBuf;
      }
    } catch (dbErr) {
      console.warn('IndexedDB buffer retrieval failed, trying direct file reads...', dbErr);
    }
  }

  // Strategy 2: file.arrayBuffer()
  try {
    const buf = await file.arrayBuffer();
    if (buf && buf.byteLength > 0) {
      return buf;
    }
  } catch (err1) {
    console.warn('file.arrayBuffer() failed, trying fallbacks...', err1);
  }

  // Strategy 3: fetch object URL (blob: URL in browser memory)
  if (objectUrl) {
    try {
      const response = await fetch(objectUrl);
      if (response.ok) {
        const buf = await response.arrayBuffer();
        if (buf && buf.byteLength > 0) {
          return buf;
        }
      }
    } catch (err2) {
      console.warn('fetch(objectUrl) failed:', err2);
    }
  }

  // Strategy 4: slice file into a new Blob then arrayBuffer()
  try {
    const slicedBlob = file.slice(0, file.size);
    const buf = await slicedBlob.arrayBuffer();
    if (buf && buf.byteLength > 0) {
      return buf;
    }
  } catch (err3) {
    console.warn('file.slice().arrayBuffer() failed:', err3);
  }

  // Strategy 5: FileReader (classic streaming read)
  try {
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
    if (buf && buf.byteLength > 0) {
      return buf;
    }
  } catch (err4) {
    console.warn('FileReader failed:', err4);
  }

  throw new Error(
    'The requested video file could not be read by your browser. Please try selecting the file again, or make sure it is not opened in another program.'
  );
}

function floatToInt16(float32: Float32Array): Int16Array {
  const len = float32.length;
  const int16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export async function convertVideoToMp3(
  videoFile: File,
  options: ConvertOptions
): Promise<ConvertResult> {
  const {
    format = 'mp3',
    startTime,
    endTime,
    bitrate,
    channels,
    volume,
    fadeIn,
    fadeOut,
    objectUrl,
    cachedBuffer,
    cacheKey,
    onProgress,
  } = options;

  onProgress?.(5, 'decoding');

  // 1. Read file as ArrayBuffer using resilient multi-tier loader
  const arrayBuffer = await readFileAsArrayBuffer(videoFile, objectUrl, cachedBuffer, cacheKey);

  onProgress?.(15, 'decoding');

  // 2. Decode using Web Audio API AudioContext
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  let audioBuffer: AudioBuffer;
  try {
    // Pass a slice because decodeAudioData detaches the buffer
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    await audioCtx.close();
    throw new Error(
      'Could not decode audio from this video. Please make sure the video contains an audio track.'
    );
  }

  onProgress?.(30, 'decoding');

  const originalSampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const totalDuration = audioBuffer.duration;

  // Validate start and end time
  const validStart = Math.max(0, Math.min(startTime, totalDuration));
  const validEnd = Math.max(validStart, Math.min(endTime, totalDuration));
  const trimDuration = validEnd - validStart;

  if (trimDuration <= 0.05) {
    await audioCtx.close();
    throw new Error('Selected trim duration is too short. Please select at least 0.1 seconds.');
  }

  const startSample = Math.floor(validStart * originalSampleRate);
  const endSample = Math.min(audioBuffer.length, Math.floor(validEnd * originalSampleRate));
  const lengthSamples = endSample - startSample;

  // Extract channels
  const leftRaw = audioBuffer.getChannelData(0);
  const rightRaw = numChannels > 1 ? audioBuffer.getChannelData(1) : leftRaw;

  // Sliced float buffers
  const leftSliced = new Float32Array(lengthSamples);
  const rightSliced = new Float32Array(lengthSamples);

  const fadeInSamples = Math.floor(fadeIn * originalSampleRate);
  const fadeOutSamples = Math.floor(fadeOut * originalSampleRate);

  for (let i = 0; i < lengthSamples; i++) {
    const srcIdx = startSample + i;
    let l = leftRaw[srcIdx] * volume;
    let r = rightRaw[srcIdx] * volume;

    // Apply Fade In
    if (i < fadeInSamples && fadeInSamples > 0) {
      const gain = i / fadeInSamples;
      l *= gain;
      r *= gain;
    }

    // Apply Fade Out
    const samplesFromEnd = lengthSamples - 1 - i;
    if (samplesFromEnd < fadeOutSamples && fadeOutSamples > 0) {
      const gain = samplesFromEnd / fadeOutSamples;
      l *= gain;
      r *= gain;
    }

    if (channels === 'mono' && numChannels > 1) {
      const monoVal = (l + r) * 0.5;
      leftSliced[i] = monoVal;
      rightSliced[i] = monoVal;
    } else {
      leftSliced[i] = l;
      rightSliced[i] = r;
    }
  }

  await audioCtx.close();

  onProgress?.(45, 'encoding');

  // Convert float to int16
  const leftInt16 = floatToInt16(leftSliced);
  const rightInt16 = channels === 'mono' ? leftInt16 : floatToInt16(rightSliced);
  const targetChannels = (channels === 'mono' ? 1 : 2) as 1 | 2;

  // Handle WAV output format (Lossless uncompressed PCM)
  if (format === 'wav') {
    onProgress?.(65, 'encoding');
    const wavBlob = encodeWav(leftInt16, rightInt16, targetChannels, originalSampleRate);
    onProgress?.(100, 'done');
    const downloadUrl = URL.createObjectURL(wavBlob);

    return {
      blob: wavBlob,
      url: downloadUrl,
      format: 'wav',
      duration: trimDuration,
      size: wavBlob.size,
      channels: targetChannels,
      sampleRate: originalSampleRate,
      bitrate: originalSampleRate * targetChannels * 16,
    };
  }

  // Handle MP3 output format (LAME MP3)
  const mp3encoder = new Mp3Encoder(targetChannels, originalSampleRate, bitrate);

  const mp3Data: Uint8Array[] = [];
  const sampleBlockSize = 1152;
  const totalBlocks = Math.ceil(lengthSamples / sampleBlockSize);

  let processed = 0;

  for (let i = 0; i < lengthSamples; i += sampleBlockSize) {
    const end = Math.min(i + sampleBlockSize, lengthSamples);
    const leftChunk = leftInt16.subarray(i, end);
    const rightChunk = targetChannels === 2 ? rightInt16.subarray(i, end) : undefined;

    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    processed++;
    if (processed % 20 === 0 || processed === totalBlocks) {
      const encodeProgress = 45 + Math.round((processed / totalBlocks) * 50);
      onProgress?.(encodeProgress, 'encoding');
      // Yield to avoid blocking UI
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Flush remaining mp3 data
  const finalMp3buf = mp3encoder.flush();
  if (finalMp3buf.length > 0) {
    mp3Data.push(new Uint8Array(finalMp3buf));
  }

  onProgress?.(100, 'done');

  const mp3Blob = new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mpeg' });
  const downloadUrl = URL.createObjectURL(mp3Blob);

  return {
    blob: mp3Blob,
    url: downloadUrl,
    format: 'mp3',
    duration: trimDuration,
    size: mp3Blob.size,
    channels: targetChannels,
    sampleRate: originalSampleRate,
    bitrate,
  };
}

export const convertVideoToAudio = convertVideoToMp3;

export function formatTime(seconds: number, includeMs = false): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const formattedMins = mins.toString().padStart(2, '0');
  const formattedSecs = secs.toString().padStart(2, '0');

  if (includeMs) {
    const formattedMs = ms.toString().padStart(2, '0');
    return `${formattedMins}:${formattedSecs}.${formattedMs}`;
  }
  return `${formattedMins}:${formattedSecs}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
