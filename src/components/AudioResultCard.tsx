import React, { useState, useRef } from 'react';
import {
  Download,
  Play,
  Pause,
  RotateCcw,
  FolderOpen,
  FileAudio,
  Share2,
  Copy,
  Check,
  Info,
  X,
  ExternalLink,
} from 'lucide-react';
import { ConvertedAudioItem } from '../types';
import { formatTime, formatFileSize } from '../utils/audioConverter';

interface AudioResultCardProps {
  audioItem: ConvertedAudioItem;
  onConvertAnother: () => void;
  showLocationModal?: boolean;
  setShowLocationModal?: (show: boolean) => void;
}

export const AudioResultCard: React.FC<AudioResultCardProps> = ({
  audioItem,
  onConvertAnother,
  showLocationModal: controlledShowModal,
  setShowLocationModal: setControlledShowModal,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audioItem.duration);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [internalShowModal, setInternalShowModal] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const showLocationModal =
    controlledShowModal !== undefined ? controlledShowModal : internalShowModal;
  const setShowLocationModal =
    setControlledShowModal !== undefined ? setControlledShowModal : setInternalShowModal;

  const formatLabel = audioItem.format
    ? audioItem.format.toUpperCase()
    : audioItem.outputFileName.endsWith('.wav')
    ? 'WAV'
    : 'MP3';

  const defaultFolderName = 'PlayVear Audio';
  const fullSuggestedPath = `Download/${defaultFolderName}/${audioItem.outputFileName}`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Primary Save Action: Downloads directly with PlayVear_Audio prefix
  const handleSaveToDevice = async () => {
    try {
      // Check if File System Access API with showSaveFilePicker is available (Chrome/Edge)
      const win = window as unknown as {
        showSaveFilePicker?: (options: {
          suggestedName: string;
          types: Array<{ description: string; accept: Record<string, string[]> }>;
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      };

      if (win.showSaveFilePicker) {
        try {
          const fileHandle = await win.showSaveFilePicker({
            suggestedName: audioItem.outputFileName,
            types: [
              {
                description: `${formatLabel} Audio File`,
                accept: {
                  [audioItem.blob.type || 'audio/mp3']: [
                    `.${formatLabel.toLowerCase()}`,
                  ],
                },
              },
            ],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(audioItem.blob);
          await writable.close();
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 4000);
          return;
        } catch (pickerErr: unknown) {
          // User aborted file picker, fallback to browser download if not user abort
          if ((pickerErr as Error)?.name === 'AbortError') {
            return;
          }
        }
      }

      // Standard browser download trigger
      const a = document.createElement('a');
      a.href = audioItem.url;
      a.download = audioItem.outputFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch {
      // Fallback anchor click
      const a = document.createElement('a');
      a.href = audioItem.url;
      a.download = audioItem.outputFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Open File Action: Opens the audio directly in a new browser tab or system player
  const handleOpenFile = () => {
    const newTab = window.open(audioItem.url, '_blank');
    if (!newTab) {
      // If popup blocker intervened, create a temporary link with target _blank
      const a = document.createElement('a');
      a.href = audioItem.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Native Web Share API (Save to Files on Android & iOS)
  const handleShareToFiles = async () => {
    if (navigator.share) {
      try {
        const fileMime = audioItem.blob.type || (audioItem.format === 'wav' ? 'audio/wav' : 'audio/mpeg');
        const file = new File([audioItem.blob], audioItem.outputFileName, {
          type: fileMime,
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: audioItem.outputFileName,
            text: `PlayVear Audio: ${audioItem.outputFileName}`,
            files: [file],
          });
          return;
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('Share failed:', err);
        }
      }
    }
    // If share not supported, show location modal
    setShowLocationModal(true);
  };

  // Copy path to clipboard
  const handleCopyPath = () => {
    navigator.clipboard?.writeText(fullSuggestedPath).then(() => {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2500);
    });
  };

  const isShareSupported = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-md p-5 sm:p-7 space-y-5">
      <audio
        ref={audioRef}
        src={audioItem.url}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() =>
          audioRef.current?.duration && setDuration(audioRef.current.duration)
        }
        onEnded={() => setIsPlaying(false)}
      />

      {/* Title & File Info */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>{formatLabel} Ready for Download</span>
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xs sm:max-w-md" title={audioItem.outputFileName}>
            {audioItem.outputFileName} • {formatFileSize(audioItem.size)}
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/80 rounded-full border border-cyan-500/30 shrink-0 font-mono">
          {formatLabel}
        </span>
      </div>

      {/* Target Folder Badge */}
      <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300 min-w-0">
          <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="truncate">
            <span className="text-slate-400">Save Folder: </span>
            <span className="font-mono font-semibold text-cyan-300">
              Download / {defaultFolderName}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowLocationModal(true)}
          className="text-pink-400 hover:text-pink-300 font-semibold shrink-0 cursor-pointer text-xs underline decoration-pink-500/40"
        >
          View Location
        </button>
      </div>

      {/* Audio Player Scrubber */}
      <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 flex items-center gap-3">
        <button
          type="button"
          id="audio-play-pause-btn"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center hover:bg-cyan-300 transition-all cursor-pointer shrink-0 shadow-sm shadow-cyan-400/30"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-slate-950" />
          ) : (
            <Play className="w-4 h-4 ml-0.5 fill-slate-950" />
          )}
        </button>

        <div className="flex-1 space-y-1">
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.05"
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              if (audioRef.current) audioRef.current.currentTime = val;
            }}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Success feedback alert */}
      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Saved successfully! The file has been stored in your device's <b>Downloads / {defaultFolderName}</b> folder.
          </span>
        </div>
      )}

      {/* Main Save / Export Actions */}
      <div className="space-y-2.5 pt-1">
        {/* Primary Save Button */}
        <button
          type="button"
          id="download-audio-btn"
          onClick={handleSaveToDevice}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-400 to-pink-500 hover:from-cyan-300 hover:to-pink-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>Save to {defaultFolderName}</span>
          <span className="text-xs bg-slate-950/20 px-2 py-0.5 rounded font-mono font-semibold">
            {formatFileSize(audioItem.size)}
          </span>
        </button>

        {/* Secondary Action Grid: Open File & Open Location */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Open File Button */}
          <button
            type="button"
            id="open-audio-file-btn"
            onClick={handleOpenFile}
            className="py-2.5 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 hover:border-slate-650 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="Directly open and play the audio file"
          >
            <FileAudio className="w-4 h-4 text-cyan-400" />
            <span>Open File</span>
            <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {/* Open Location Button */}
          <button
            type="button"
            id="open-file-location-btn"
            onClick={() => setShowLocationModal(true)}
            className="py-2.5 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 hover:border-slate-650 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="View file location on your device"
          >
            <FolderOpen className="w-4 h-4 text-pink-400" />
            <span>File Location</span>
          </button>
        </div>

        {/* Share to Files option for mobile users */}
        {isShareSupported && (
          <button
            type="button"
            id="share-to-files-btn"
            onClick={handleShareToFiles}
            className="w-full py-2 px-3 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-slate-300 border border-slate-800 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Share or Save directly to Mobile Files App</span>
          </button>
        )}
      </div>

      {/* Convert another button */}
      <div className="text-center pt-1">
        <button
          type="button"
          id="convert-another-btn"
          onClick={onConvertAnother}
          className="text-xs font-semibold text-slate-400 hover:text-cyan-400 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Convert another video</span>
        </button>
      </div>

      {/* Location Modal / Drawer */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">
                  Where to find your file
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Path display box */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] text-slate-400 font-medium">
                File save folder & path:
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <span className="font-mono text-xs text-cyan-300 truncate">
                  Internal Storage &gt; Download &gt; {defaultFolderName}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                  title="Copy path"
                >
                  {copiedPath ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="text-[11px] font-mono text-slate-400 break-all">
                File Name: <span className="text-pink-300">{audioItem.outputFileName}</span>
              </div>
            </div>

            {/* Step-by-step guidance */}
            <div className="text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-pink-400" />
                <span>How to find on mobile?</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1 leading-relaxed">
                <li>
                  Open your phone's <b>Files by Google</b> or <b>My Files (Samsung/Xiaomi)</b> app.
                </li>
                <li>
                  Go to the <b>Downloads</b> folder.
                </li>
                <li>
                  You will find the file inside the <b>PlayVear Audio</b> folder or as <b>PlayVear_Audio_...</b>.
                </li>
              </ol>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {isShareSupported && (
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    handleShareToFiles();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Save to Files</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowLocationModal(false);
                  handleOpenFile();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileAudio className="w-3.5 h-3.5 text-cyan-400" />
                <span>Listen Now</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="py-2 px-4 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
