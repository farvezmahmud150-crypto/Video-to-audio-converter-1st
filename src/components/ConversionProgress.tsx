import React from 'react';
import { Loader2 } from 'lucide-react';
import { ConversionPhase } from '../types';

interface ConversionProgressProps {
  progress: number;
  phase: ConversionPhase;
}

export const ConversionProgress: React.FC<ConversionProgressProps> = ({
  progress,
  phase,
}) => {
  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">
            {phase === 'decoding' ? 'Extracting audio...' : 'Encoding MP3...'}
          </span>
        </div>
        <span className="font-mono text-sm font-bold text-cyan-400">
          {progress}%
        </span>
      </div>

      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.25 border border-slate-800">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-cyan-400 to-pink-500 rounded-full transition-all duration-200 shadow-sm shadow-cyan-500/20"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
