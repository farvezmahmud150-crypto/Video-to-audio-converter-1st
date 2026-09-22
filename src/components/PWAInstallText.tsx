import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallText: React.FC = () => {
  const { isInstalled, install, isInstallable } = usePWAInstall();

  // If already installed as standalone app, hide the text
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      // If browser hasn't fired beforeinstallprompt yet, trigger install or show guidance
      const success = await install();
      if (!success) {
        // Direct feedback
        alert('To install this app, please open it in a supported mobile browser (such as Chrome) or try again shortly.');
      }
    }
  };

  return (
    <button
      type="button"
      id="pwa-install-text-btn"
      onClick={handleClick}
      className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1 cursor-pointer underline-offset-2 hover:underline focus:outline-none shrink-0"
    >
      <Download className="w-3 h-3" />
      <span>Install App</span>
    </button>
  );
};
