/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { VideoUploader } from './components/VideoUploader';
import { VideoPreviewAndTrimmer } from './components/VideoPreviewAndTrimmer';
import { ConversionSettings } from './components/ConversionSettings';
import { ConversionProgress } from './components/ConversionProgress';
import { AudioResultCard } from './components/AudioResultCard';
import { PWAInstallText } from './components/PWAInstallText';
import {
  VideoMetadata,
  AudioSettings,
  ConversionPhase,
  ConvertedAudioItem,
} from './types';
import { convertVideoToMp3 } from './utils/audioConverter';
import { clearAllCachedBuffers, requestScreenWakeLock, releaseScreenWakeLock } from './utils/fileStorage';
import { Music, ArrowRight, AlertCircle, RefreshCw, LogOut } from 'lucide-react';

export default function App() {
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    format: 'mp3',
    bitrate: 192,
    channels: 'stereo',
    volume: 1.0,
    fadeIn: 0,
    fadeOut: 0,
  });

  const [phase, setPhase] = useState<ConversionPhase>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<ConvertedAudioItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal and Exit Toast state for mobile back button
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [showExitToast, setShowExitToast] = useState<boolean>(false);

  // Refs to avoid stale closures in popstate listener
  const videoMetaRef = useRef<VideoMetadata | null>(null);
  const currentResultRef = useRef<ConvertedAudioItem | null>(null);
  const showLocationModalRef = useRef<boolean>(false);
  const phaseRef = useRef<ConversionPhase>('idle');
  const lastBackPressTimeRef = useRef<number>(0);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    videoMetaRef.current = videoMeta;
  }, [videoMeta]);

  useEffect(() => {
    currentResultRef.current = currentResult;
  }, [currentResult]);

  useEffect(() => {
    showLocationModalRef.current = showLocationModal;
  }, [showLocationModal]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Prevent Mobile Pull-to-Refresh on Swipe Down
  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const isAtTop = window.scrollY <= 0 || document.documentElement.scrollTop <= 0;

        // If user pulls down from the top edge, prevent pull-to-refresh
        if (isAtTop && currentY > startY) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Hardware Back Button Navigation Handler (Single tap = in-app back / close modal; Double tap = exit)
  useEffect(() => {
    // Initial history anchor
    window.history.pushState({ app: 'playvear' }, '');

    const handlePopState = () => {
      // 1. If any Modal is open, close it on single back tap
      if (showLocationModalRef.current) {
        setShowLocationModal(false);
        window.history.pushState({ app: 'playvear' }, '');
        return;
      }

      // 2. If Result screen is open, go back to Trimmer screen
      if (currentResultRef.current) {
        setCurrentResult(null);
        window.history.pushState({ app: 'playvear' }, '');
        return;
      }

      // 3. If Video is loaded in Trimmer (and not actively encoding), go back to Upload screen
      if (videoMetaRef.current && phaseRef.current !== 'decoding' && phaseRef.current !== 'encoding') {
        handleConvertAnother();
        window.history.pushState({ app: 'playvear' }, '');
        return;
      }

      // 4. We are on the Root/Home screen
      const now = Date.now();
      const timeSinceLastPress = now - lastBackPressTimeRef.current;

      if (timeSinceLastPress < 2000) {
        // Double tap on back button -> Exit the app
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setShowExitToast(false);
        window.history.back();
      } else {
        // First tap on back button -> Show Toast & trap navigation
        lastBackPressTimeRef.current = now;
        setShowExitToast(true);
        window.history.pushState({ app: 'playvear' }, '');

        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          setShowExitToast(false);
        }, 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Keep mobile device screen awake and restore wake lock when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (videoMeta || phase !== 'idle')) {
        requestScreenWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseScreenWakeLock();
    };
  }, [videoMeta, phase]);

  const handleVideoSelected = (meta: VideoMetadata) => {
    setVideoMeta(meta);
    setStartTime(0);
    setEndTime(meta.duration || 10);
    setCurrentResult(null);
    setPhase('idle');
    setErrorMessage(null);
    requestScreenWakeLock();
  };

  const handleBufferReady = (buffer: ArrayBuffer) => {
    setVideoMeta((prev) => (prev ? { ...prev, cachedBuffer: buffer } : null));
  };

  const handleStartConversion = async () => {
    if (!videoMeta) return;

    setErrorMessage(null);
    setPhase('decoding');
    setProgress(5);
    requestScreenWakeLock();

    try {
      const result = await convertVideoToMp3(videoMeta.file, {
        format: audioSettings.format,
        startTime,
        endTime,
        bitrate: audioSettings.bitrate,
        channels: audioSettings.channels,
        volume: audioSettings.volume,
        fadeIn: audioSettings.fadeIn,
        fadeOut: audioSettings.fadeOut,
        objectUrl: videoMeta.url,
        cachedBuffer: videoMeta.cachedBuffer,
        cacheKey: videoMeta.cacheKey,
        onProgress: (prog, currentPhase) => {
          setProgress(prog);
          setPhase(currentPhase);
        },
      });

      const baseName = videoMeta.name.substring(0, videoMeta.name.lastIndexOf('.')) || videoMeta.name;
      const cleanName = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const ext = audioSettings.format === 'wav' ? 'wav' : 'mp3';

      const newItem: ConvertedAudioItem = {
        id: `audio-${Date.now()}`,
        originalFileName: videoMeta.name,
        outputFileName: `PlayVear_Audio_${cleanName}.${ext}`,
        format: audioSettings.format,
        blob: result.blob,
        url: result.url,
        duration: result.duration,
        size: result.size,
        bitrate: result.bitrate,
        channels: result.channels,
        sampleRate: result.sampleRate,
        timestamp: Date.now(),
        startTime,
        endTime,
      };

      setCurrentResult(newItem);
      setPhase('done');
    } catch (err: unknown) {
      setPhase('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const handleConvertAnother = () => {
    if (videoMeta?.url) {
      URL.revokeObjectURL(videoMeta.url);
    }
    clearAllCachedBuffers();
    releaseScreenWakeLock();
    setVideoMeta(null);
    setCurrentResult(null);
    setPhase('idle');
    setProgress(0);
    setErrorMessage(null);
    setShowLocationModal(false);
  };

  const isConverting = phase === 'decoding' || phase === 'encoding';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-5">
        {/* Step 1: Upload Video */}
        {!videoMeta && (
          <VideoUploader
            onVideoSelected={handleVideoSelected}
            onBufferReady={handleBufferReady}
            isProcessing={isConverting}
          />
        )}

        {/* Step 2: Trim & Convert */}
        {videoMeta && !currentResult && (
          <div className="space-y-4">
            <VideoPreviewAndTrimmer
              videoMeta={videoMeta}
              startTime={startTime}
              endTime={endTime}
              onChangeTrim={(start, end) => {
                setStartTime(start);
                setEndTime(end);
              }}
              onChangeVideo={handleConvertAnother}
              isProcessing={isConverting}
            />

            <ConversionSettings
              settings={audioSettings}
              onChangeSettings={setAudioSettings}
              disabled={isConverting}
            />

            {isConverting && (
              <ConversionProgress progress={progress} phase={phase} />
            )}

            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <p className="font-semibold text-rose-200">{errorMessage}</p>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      If browser memory was cleared, please select your video again.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleConvertAnother}
                  className="px-3.5 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-white rounded-xl font-bold shrink-0 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Select Again</span>
                </button>
              </div>
            )}

            {!isConverting && (
              <button
                type="button"
                id="start-convert-btn"
                onClick={handleStartConversion}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-400 to-pink-500 hover:from-cyan-300 hover:to-pink-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Music className="w-4 h-4 stroke-[2.5]" />
                <span>Convert to {audioSettings.format.toUpperCase()}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        )}

        {/* Step 3: Download Audio (MP3 or WAV) */}
        {currentResult && (
          <AudioResultCard
            audioItem={currentResult}
            onConvertAnother={handleConvertAnother}
            showLocationModal={showLocationModal}
            setShowLocationModal={setShowLocationModal}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/90 py-2.5 px-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-1.5 text-[10px] sm:text-[11px] text-slate-500 whitespace-nowrap">
          <span className="truncate text-slate-400">Video to MP3 Converter</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-800">•</span>
            <PWAInstallText />
            <span className="text-slate-800">•</span>
          </div>
          <span className="opacity-40 font-mono shrink-0">by PlayVear</span>
        </div>
      </footer>

      {/* Mobile Back Button Double Tap Exit Toast */}
      {showExitToast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-slate-900/95 border border-slate-700 text-slate-200 text-xs px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <LogOut className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium">Press back again to exit</span>
          </div>
        </div>
      )}
    </div>
  );
}
