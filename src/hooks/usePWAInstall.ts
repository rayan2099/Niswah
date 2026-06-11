import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [platform, setPlatform] = useState({ isIOS: false, isSafari: false });

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setPlatform({ isIOS, isSafari });

    const hasCountedThisPage = sessionStorage.getItem('niswah_session_counted') === 'true';
    const previousCount = parseInt(localStorage.getItem('niswah_session_count') || '0');
    const count = hasCountedThisPage ? previousCount : previousCount + 1;
    if (!hasCountedThisPage) {
      localStorage.setItem('niswah_session_count', count.toString());
      sessionStorage.setItem('niswah_session_counted', 'true');
    }
    setSessionCount(count);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!installPrompt) return 'unavailable';
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
      setInstallPrompt(null);
    }
    return outcome;
  };

  const shouldShowBanner = !isInstalled && sessionCount >= 1 && (canInstall || platform.isIOS || platform.isSafari);

  return { canInstall, isInstalled, triggerInstall, shouldShowBanner, sessionCount, platform };
};
