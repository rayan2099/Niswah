import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { X, Download, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PWAInstallBanner = () => {
  const { isInstalled, triggerInstall, shouldShowBanner } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    const t = localStorage.getItem('niswah_install_dismissed');
    if (!t) return false;
    return Date.now() - parseInt(t) < 7 * 24 * 60 * 60 * 1000;
  });
  const [installing, setInstalling] = useState(false);

  if (isInstalled || dismissed || !shouldShowBanner) return null;

  const handleInstall = async () => {
    setInstalling(true);
    const outcome = await triggerInstall();
    setInstalling(false);
    if (outcome === 'accepted') setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="fixed bottom-24 left-4 right-4 z-[150] bg-white rounded-2xl shadow-xl border border-rose-100 p-4"
        dir="rtl"
      >
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('niswah_install_dismissed', Date.now().toString());
          }}
          className="absolute top-3 left-3 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-serif text-rose-500">ن</span>
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">أضيفي نسوة لشاشتك الرئيسية</p>
            <p className="text-xs text-gray-500 mt-0.5">وصول سريع — تعمل بلا إنترنت — إشعارات فورية</p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          {[
            { icon: '⚡', text: 'أسرع بكثير' },
            { icon: '📴', text: 'بلا إنترنت' },
            { icon: '🔔', text: 'إشعارات' },
          ].map((f, i) => (
            <div key={i} className="flex-1 bg-rose-50 rounded-xl p-2 text-center">
              <div style={{ fontSize: '16px' }}>{f.icon}</div>
              <div className="text-xs text-rose-700 mt-1 font-medium">{f.text}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        >
          <Download className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
          {installing ? 'جارٍ التثبيت...' : 'تثبيت على الشاشة الرئيسية'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-2">مجاني — لا يتطلب App Store</p>
      </motion.div>
    </AnimatePresence>
  );
};

export const PWAInstallButton = ({ showLabel = false }: { showLabel?: boolean }) => {
  const { canInstall, isInstalled, triggerInstall, platform } = usePWAInstall();
  const [done, setDone] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const { isRTL } = useTranslation();

  if (isInstalled || done) return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-100 rounded-full", showLabel && "w-full justify-between")}>
      {showLabel && (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
            <Download className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-sm font-bold text-gray-700">{isRTL ? 'تثبيت التطبيق' : 'Install App'}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3 h-3 text-green-500" />
        <span className="text-[10px] text-green-600 font-bold">مثبت</span>
      </div>
    </div>
  );

  const handleInstall = async () => {
    if (platform.isIOS) {
      setShowIOSHint(true);
      setTimeout(() => setShowIOSHint(false), 5000);
      return;
    }
    const r = await triggerInstall();
    if (r === 'accepted') setDone(true);
  };

  return (
    <div className={cn("relative", showLabel && "w-full")}>
      <button
        onClick={handleInstall}
        className={cn(
          "flex items-center gap-1.5 transition-all active:scale-[0.98]",
          showLabel 
            ? "w-full justify-between py-1" 
            : "px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full"
        )}
      >
        {showLabel ? (
          <>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                <Download className="w-4 h-4 text-rose-400" />
              </div>
              <span className="text-sm font-bold text-gray-700">{isRTL ? 'تثبيت التطبيق' : 'Install App'}</span>
            </div>
            <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full flex items-center gap-1.5">
              <Download style={{ width: '12px', height: '12px' }} className="text-rose-500" />
              <span className="text-xs text-rose-600 font-medium">تثبيت</span>
            </div>
          </>
        ) : (
          <>
            <Download style={{ width: '12px', height: '12px' }} className="text-rose-500" />
            <span className="text-xs text-rose-600 font-medium">تثبيت</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {showIOSHint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-3 bg-black/80 backdrop-blur text-white text-[10px] rounded-xl z-50 text-center leading-relaxed"
          >
            <div className="mb-1 font-bold">لمستخدمي آيفون:</div>
            اضغطي على أيقونة "مشاركة" ثم "إضافة إلى الشاشة الرئيسية"
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
