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
          <div className="w-12 h-12 rounded-xl bg-white border border-rose-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/logo.svg" alt="Niswah Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
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
      // Don't auto-hide too quickly, let them see it
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
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSHint(false)}
              className="fixed inset-0 bg-rose-900/20 z-[200] backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-10 left-4 right-4 p-6 bg-white rounded-3xl z-[201] text-center shadow-2xl border border-rose-100"
              dir="rtl"
            >
              <button 
                onClick={() => setShowIOSHint(false)}
                className="absolute top-4 left-4 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">تثبيت نسوة على آيفون</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                لإضافة التطبيق إلى شاشتك الرئيسية، اتبعي الخطوات التالية:
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 text-right">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 font-bold text-gray-500">1</div>
                  <p className="text-sm text-gray-700">اضغطي على أيقونة <b>"مشاركة"</b> (المربع مع سهم للأعلى) في أسفل المتصفح</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 font-bold text-gray-500">2</div>
                  <p className="text-sm text-gray-700">اسحبي القائمة للأعلى واختاري <span className="font-bold text-rose-600">"إضافة إلى الشاشة الرئيسية"</span></p>
                </div>
              </div>

              <button 
                onClick={() => setShowIOSHint(false)}
                className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold shadow-lg shadow-rose-200"
              >
                فهمت
              </button>

              {/* Arrow pointing to Safari share button */}
              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white"
              >
                <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[20px] border-t-rose-500"></div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
