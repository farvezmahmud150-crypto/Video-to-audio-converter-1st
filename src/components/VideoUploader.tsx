import React, { useState, useRef } from 'react';
import { Upload, Video, Sparkles, Loader2 } from 'lucide-react';
import { VideoMetadata } from '../types';
import { createSampleVideo } from '../utils/sampleVideo';
import { saveBufferToCache, requestScreenWakeLock } from '../utils/fileStorage';

interface VideoUploaderProps {
  onVideoSelected: (meta: VideoMetadata) => void;
  onBufferReady?: (buffer: ArrayBuffer) => void;
  isProcessing?: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoSelected,
  onBufferReady,
  isProcessing = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setErrorMessage(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const commonVideoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', '3gp', 'ts', 'flv', 'ogv', 'wmv'];

    if (!file.type.startsWith('video/') && !commonVideoExts.includes(ext || '')) {
      setErrorMessage('Please select a video file (MP4, WebM, MKV, MOV, AVI, etc.)');
      return;
    }

    // Request wake lock to prevent mobile device sleep/timeout
    requestScreenWakeLock();

    const cacheKey = `vid_cache_${Date.now()}_${file.size}_${Math.random().toString(36).substring(2, 7)}`;
    const mime = file.type || (ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : 'video/mp4');
    const cleanBlob = new Blob([file], { type: mime });
    const objectUrl = URL.createObjectURL(cleanBlob);

    let memoryBuffer: ArrayBuffer | undefined = undefined;

    // Immediately cache to memory & IndexedDB while fresh
    const readAndCacheBuffer = async () => {
      try {
        const buf = await file.arrayBuffer();
        if (buf && buf.byteLength > 0) {
          memoryBuffer = buf;
          await saveBufferToCache(cacheKey, buf);
          onBufferReady?.(buf);
          return buf;
        }
      } catch {
        // Fallback to fetching blob URL
        try {
          const resp = await fetch(objectUrl);
          const buf = await resp.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            memoryBuffer = buf;
            await saveBufferToCache(cacheKey, buf);
            onBufferReady?.(buf);
            return buf;
          }
        } catch {
          // Ignore
        }
      }
      return undefined;
    };

    // Trigger background caching immediately
    readAndCacheBuffer();

    const video = document.createElement('video');
    video.preload = 'auto';

    let resolved = false;
    const finalize = (durationSec: number) => {
      if (resolved) return;
      resolved = true;
      const finalDur = !isNaN(durationSec) && isFinite(durationSec) && durationSec > 0 ? durationSec : 15;
      onVideoSelected({
        file,
        name: file.name,
        size: file.size,
        duration: finalDur,
        videoWidth: video.videoWidth || 640,
        videoHeight: video.videoHeight || 360,
        url: objectUrl,
        cachedBuffer: memoryBuffer,
        cacheKey,
      });
    };

    video.onloadedmetadata = () => {
      const dur = video.duration;
      if (!isNaN(dur) && isFinite(dur) && dur > 0) {
        finalize(dur);
      } else {
        video.ondurationchange = () => {
          if (video.duration && isFinite(video.duration) && video.duration > 0) {
            finalize(video.duration);
          }
        };
        setTimeout(() => {
          finalize(video.duration || 15);
        }, 300);
      }
    };

    video.onerror = () => {
      finalize(15);
    };

    video.src = objectUrl;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUseSample = async () => {
    try {
      setIsGeneratingSample(true);
      setErrorMessage(null);
      const sample = await createSampleVideo(15);
      processFile(sample);
    } catch {
      setErrorMessage('Could not create sample video. Please upload your video file.');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  return (
    <div className="w-full">
      <div
        id="video-drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/10'
            : 'border-slate-700/80 hover:border-cyan-500/80 bg-slate-900/70 hover:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="video-file-input"
          accept=".mp4,.webm,.mkv,.mov,.avi,.m4v,.3gp,.ts,.flv,.ogv,video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950/70 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-4 shadow-sm shadow-cyan-500/10">
            <Upload className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-bold text-white mb-1">
            Upload Video File
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            MP4, WebM, MKV, MOV, AVI & more
          </p>

          <button
            type="button"
            id="choose-file-btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-cyan-500/30 active:scale-[0.98]"
          >
            <Video className="w-4 h-4" />
            <span>Select Video</span>
          </button>

          <button
            type="button"
            id="sample-video-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleUseSample();
            }}
            disabled={isGeneratingSample || isProcessing}
            className="mt-4 text-xs text-pink-400 hover:text-pink-300 font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            {isGeneratingSample ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                <span>Loading sample video (15s)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Try with sample video</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
