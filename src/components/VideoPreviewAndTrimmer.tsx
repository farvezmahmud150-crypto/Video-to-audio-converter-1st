import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scissors,
  RotateCcw,
  Play,
  Clock,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  BookmarkPlus,
} from 'lucide-react';
import { VideoMetadata } from '../types';
import { formatTime, formatFileSize } from '../utils/audioConverter';

interface VideoPreviewAndTrimmerProps {
  videoMeta: VideoMetadata;
  startTime: number;
  endTime: number;
  onChangeTrim: (start: number, end: number) => void;
  onChangeVideo: () => void;
  isProcessing: boolean;
}

export const VideoPreviewAndTrimmer: React.FC<VideoPreviewAndTrimmerProps> = ({
  videoMeta,
  startTime,
  endTime,
  onChangeTrim,
  onChangeVideo,
  isProcessing,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number>(videoMeta.duration || 1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [codecError, setCodecError] = useState<boolean>(false);
  const [activeUrl, setActiveUrl] = useState<string>(videoMeta.url);
  const [isPreviewingCut, setIsPreviewingCut] = useState<boolean>(false);

  // Synchronize duration when video metadata updates
  useEffect(() => {
    if (videoMeta.duration && isFinite(videoMeta.duration) && videoMeta.duration > 0) {
      setDuration(videoMeta.duration);
      if (endTime <= 0 || (endTime <= 4 && videoMeta.duration > 4)) {
        onChangeTrim(0, videoMeta.duration);
      }
    }
  }, [videoMeta.duration, endTime, onChangeTrim]);

  // Keep activeUrl synced with prop
  useEffect(() => {
    setActiveUrl(videoMeta.url);
    setCodecError(false);
  }, [videoMeta.url]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (!isNaN(dur) && isFinite(dur) && dur > 0) {
        setDuration(dur);
        if (endTime <= 0 || endTime > dur || (endTime <= 4 && dur > 4)) {
          onChangeTrim(0, dur);
        }
      }
      setCodecError(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);

      // If previewing cut, pause when reaching endTime
      if (isPreviewingCut && curr >= endTime) {
        videoRef.current.pause();
        setIsPreviewingCut(false);
      }
    }
  };

  const handleVideoError = () => {
    setCodecError(true);
  };

  // Re-generate fresh object URL if browser released it after delay
  const handleReloadSource = () => {
    try {
      const freshBlob = new Blob([videoMeta.file], { type: videoMeta.file.type || 'video/mp4' });
      const freshUrl = URL.createObjectURL(freshBlob);
      setActiveUrl(freshUrl);
      setCodecError(false);
      if (videoRef.current) {
        videoRef.current.load();
      }
    } catch {
      // Ignored
    }
  };

  // Set Start to current playhead position
  const setStartToCurrent = () => {
    if (!videoRef.current) return;
    const curr = Math.min(videoRef.current.currentTime, Math.max(0, endTime - 0.5));
    onChangeTrim(Math.round(curr * 10) / 10, endTime);
  };

  // Set End to current playhead position
  const setEndToCurrent = () => {
    if (!videoRef.current) return;
    const curr = Math.max(videoRef.current.currentTime, startTime + 0.5);
    const clamped = Math.min(duration, curr);
    onChangeTrim(startTime, Math.round(clamped * 10) / 10);
  };

  // Reset to full video
  const handleSelectFull = () => {
    onChangeTrim(0, duration);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Step adjustments for Start Time
  const adjustStartTime = (delta: number) => {
    const newStart = Math.max(0, Math.min(startTime + delta, endTime - 0.5));
    onChangeTrim(Math.round(newStart * 10) / 10, endTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
    }
  };

  // Step adjustments for End Time
  const adjustEndTime = (delta: number) => {
    const newEnd = Math.min(duration, Math.max(endTime + delta, startTime + 0.5));
    onChangeTrim(startTime, Math.round(newEnd * 10) / 10);
    if (videoRef.current) {
      videoRef.current.currentTime = newEnd;
    }
  };

  // Play only the selected cut
  const handlePreviewCut = () => {
    if (!videoRef.current) return;
    setIsPreviewingCut(true);
    videoRef.current.currentTime = startTime;
    videoRef.current.play().catch(() => {});
  };

  const selectedDuration = Math.max(0, endTime - startTime);
  const isFullSelected = startTime === 0 && Math.abs(endTime - duration) < 0.2;

  // File extension check for helpful hints
  const ext = videoMeta.name.split('.').pop()?.toLowerCase();
  const isPotentiallyUnsupportedCodec = ['mkv', 'avi', 'flv', 'wmv'].includes(ext || '');

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="font-semibold text-slate-200 truncate max-w-xs" title={videoMeta.name}>
          {videoMeta.name}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono">{formatFileSize(videoMeta.size)}</span>
          <button
            type="button"
            id="change-video-btn"
            onClick={onChangeVideo}
            disabled={isProcessing}
            className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer disabled:opacity-50 transition-colors"
          >
            Change Video
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Native Browser Video Player - Ultra reliable, no click-hijacking or audio blocking */}
        <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video max-h-72 mx-auto flex items-center justify-center border border-slate-800">
          <video
            ref={videoRef}
            src={activeUrl}
            controls
            playsInline
            preload="auto"
            className="w-full h-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onError={handleVideoError}
          />

          {/* Fallback overlay if browser codec cannot render preview */}
          {(codecError || isPotentiallyUnsupportedCodec) && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10">
              <AlertCircle className="w-8 h-8 text-cyan-400 mb-2" />
              <p className="text-sm font-semibold text-slate-200 mb-1">
                Direct Browser Preview Notice
              </p>
              <p className="text-xs text-slate-400 max-w-md mb-3">
                Some video formats ({ext?.toUpperCase() || 'this video'}) use codecs that browsers cannot preview visually.
                <b className="text-cyan-300 block mt-1">
                  Don't worry! Audio extraction to MP3 will still convert 100% smoothly.
                </b>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReloadSource}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Video</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trimming Section: Simple, Intuitive, No Problems */}
        <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/80 space-y-3">
          {/* Top Trimming Status & Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-cyan-400" />
                Trim Audio
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                Duration: {formatTime(selectedDuration)}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="quick-full-btn"
                onClick={handleSelectFull}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                  isFullSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                    : 'bg-slate-850 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Full Video</span>
              </button>

              <button
                type="button"
                id="preview-cut-btn"
                onClick={handlePreviewCut}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition-colors flex items-center gap-1 cursor-pointer shadow-xs shadow-cyan-500/20"
              >
                <Play className="w-3 h-3 fill-slate-950" />
                <span>Test Cut</span>
              </button>
            </div>
          </div>

          {/* Visual Time Range Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>00:00</span>
              <span className="text-cyan-400 font-semibold">
                Selection: {formatTime(startTime)} – {formatTime(endTime)}
              </span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Visual dual slider bar */}
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full"
                style={{
                  left: `${(startTime / duration) * 100}%`,
                  width: `${Math.max(2, ((endTime - startTime) / duration) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Simple Step & Set Controls for Start and End */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Start Time Box */}
            <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Start Time:</span>
                <span className="text-xs font-mono font-bold text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {formatTime(startTime)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustStartTime(-5)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustStartTime(-1)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustStartTime(1)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  +1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustStartTime(5)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  +5s
                </button>
              </div>
              <button
                type="button"
                onClick={setStartToCurrent}
                className="w-full mt-0.5 py-1 text-xs rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 flex items-center justify-center gap-1 cursor-pointer font-medium"
              >
                <BookmarkPlus className="w-3 h-3" />
                <span>Set Start to Current Playhead</span>
              </button>
            </div>

            {/* End Time Box */}
            <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">End Time:</span>
                <span className="text-xs font-mono font-bold text-pink-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {formatTime(endTime)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustEndTime(-5)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustEndTime(-1)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustEndTime(1)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  +1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustEndTime(5)}
                  className="flex-1 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-mono"
                >
                  +5s
                </button>
              </div>
              <button
                type="button"
                onClick={setEndToCurrent}
                className="w-full mt-0.5 py-1 text-xs rounded bg-pink-950/60 hover:bg-pink-900/60 text-pink-300 border border-pink-500/30 flex items-center justify-center gap-1 cursor-pointer font-medium"
              >
                <BookmarkPlus className="w-3 h-3" />
                <span>Set End to Current Playhead</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
