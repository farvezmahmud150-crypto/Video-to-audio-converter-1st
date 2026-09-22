import React from 'react';
import { AudioSettings, AudioFormat } from '../types';

interface ConversionSettingsProps {
  settings: AudioSettings;
  onChangeSettings: (settings: AudioSettings) => void;
  disabled?: boolean;
}

export const ConversionSettings: React.FC<ConversionSettingsProps> = ({
  settings,
  onChangeSettings,
  disabled = false,
}) => {
  const isWav = settings.format === 'wav';

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-sm space-y-4">
      {/* Basic Settings: Format, Bitrate, Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Output Format Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Output Format
          </label>
          <select
            id="format-select"
            value={settings.format}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                format: e.target.value as AudioFormat,
              })
            }
            disabled={disabled}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-cyan-300 cursor-pointer"
          >
            <option value="mp3">MP3 Audio (.mp3)</option>
            <option value="wav">WAV Audio (.wav) - Lossless</option>
          </select>
        </div>

        {/* Quality / Bitrate Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {isWav ? 'Audio Bit Depth' : 'Quality (Bitrate)'}
          </label>
          {isWav ? (
            <div className="w-full px-3 py-2 text-xs font-semibold bg-slate-950/80 border border-slate-800/80 rounded-xl text-slate-300 flex items-center justify-between">
              <span>16-bit PCM</span>
              <span className="text-[10px] text-pink-400 font-mono">Lossless Studio</span>
            </div>
          ) : (
            <select
              id="bitrate-select"
              value={settings.bitrate}
              onChange={(e) =>
                onChangeSettings({ ...settings, bitrate: parseInt(e.target.value, 10) })
              }
              disabled={disabled}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-slate-200 cursor-pointer"
            >
              <option value={320}>320 kbps (Ultra High)</option>
              <option value={256}>256 kbps (High)</option>
              <option value={192}>192 kbps (Recommended)</option>
              <option value={128}>128 kbps (Standard)</option>
              <option value={64}>64 kbps (Low Size)</option>
            </select>
          )}
        </div>

        {/* Channels Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Audio Channels
          </label>
          <select
            id="channels-select"
            value={settings.channels}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                channels: e.target.value as 'stereo' | 'mono',
              })
            }
            disabled={disabled}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-slate-200 cursor-pointer"
          >
            <option value="stereo">Stereo (2 Channels)</option>
            <option value="mono">Mono (1 Channel - Clean Speech)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
