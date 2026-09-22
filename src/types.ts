export interface VideoMetadata {
  file: File;
  name: string;
  size: number;
  duration: number;
  videoWidth?: number;
  videoHeight?: number;
  url: string;
  cachedBuffer?: ArrayBuffer;
  cacheKey?: string;
}

export type AudioFormat = 'mp3' | 'wav';

export interface AudioSettings {
  format: AudioFormat;
  bitrate: number;
  channels: 'stereo' | 'mono';
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export type ConversionPhase = 'idle' | 'decoding' | 'encoding' | 'done' | 'error';

export interface ConvertedAudioItem {
  id: string;
  originalFileName: string;
  outputFileName: string;
  format: AudioFormat;
  blob: Blob;
  url: string;
  duration: number;
  size: number;
  bitrate?: number;
  channels: number;
  sampleRate: number;
  timestamp: number;
  startTime: number;
  endTime: number;
}
