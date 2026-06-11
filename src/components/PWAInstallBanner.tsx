import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { X, Download, CheckCircle2, Share, PlusSquare, WifiOff, Bell, Zap, ArrowDown } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useCycleData } from '../contexts/CycleContext.tsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PWAInstallBanner = () => {
  const { isInstalled, triggerInstall, shouldShowBanner, platform } = usePWAInstall();
  const { user } = useCycleData();
  const dismissalKey = useMemo(
    () => `niswah_install_dismissed_v3_${user?.id || 'guest'}`,
    [user?.id]
  );
  const isRecentlyDismissed = (key: string) => {
    const t = localStorage.getItem(key);
    if (!t) return false;
    return Date.now() - parseInt(t) < 7 * 24 * 60 * 60 * 1000;
  };
  const [dismissed, setDismissed] = useState(() => isRecentlyDismissed(dismissalKey));
  const [installing, setInstalling] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);

  useEffect(() => {
    setDismissed(isRecentlyDismissed(dismissalKey));
    setShowManualSteps(false);
  }, [dismissalKey]);

  const dismissPrompt = () => {
    setDismissed(true);
    localStorage.setItem(dismissalKey, Date.now().toString());
  };

  if (isInstalled || dismissed || !shouldShowBanner) return null;

  const handleInstall = async () => {
    if (platform.isIOS || platform.isSafari) {
      setShowManualSteps(true);
      return;
    }

    setInstalling(true);
    const outcome = await triggerInstall();
    setInstalling(false);
    if (outcome === 'accepted') dismissPrompt();
    if (outcome === 'unavailable') setShowManualSteps(true);
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
          onClick={dismissPrompt}
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

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { icon: Zap, text: 'أسرع بكثير' },
            { icon: WifiOff, text: 'بلا إنترنت' },
            { icon: Bell, text: 'إشعارات' },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex-1 bg-rose-50 rounded-xl p-2 text-center">
              <Icon className="mx-auto h-4 w-4 text-rose-500" />
              <div className="text-xs text-rose-700 mt-1 font-medium">{text}</div>
            </div>
          ))}
        </div>

        {showManualSteps && (
          <div className="mb-3 space-y-2 rounded-2xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-rose-500">
                <Share className="h-4 w-4" />
              </span>
              <span>افتحي قائمة المشاركة في المتصفح.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-rose-500">
                <PlusSquare className="h-4 w-4" />
              </span>
              <span>اختاري “إضافة إلى الشاشة الرئيسية”.</span>
            </div>
          </div>
        )}

        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        >
          <Download className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
          {installing ? 'جارٍ التثبيت...' : platform.isIOS || platform.isSafari ? 'اعرضي خطوات الإضافة' : 'تثبيت على الشاشة الرئيسية'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-2">مجاني — لا يتطلب App Store</p>

        {(platform.isIOS || platform.isSafari) && showManualSteps && (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: [0, 10, 0] }}
            transition={{ opacity: { duration: 0.2 }, y: { repeat: Infinity, duration: 1.3, ease: 'easeInOut' } }}
            className="pointer-events-none fixed bottom-8 left-1/2 z-[151] -translate-x-1/2 text-rose-500 drop-shadow-[0_8px_12px_rgba(244,63,94,0.35)]"
          >
            <div className="flex flex-col items-center">
              <span className="mb-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-rose-600 shadow-sm">
                زر المشاركة هنا
              </span>
              <ArrowDown className="h-14 w-14 stroke-[2.5]" />
            </div>
          </motion.div>
        )}
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
              
              <div className="space-y-8 mb-10">
                <div className="flex items-start gap-5 text-right">
                  <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0 font-bold shadow-sm">1</div>
                  <div className="flex-1">
                    <p className="text-base text-gray-800 leading-relaxed font-medium">
                      اضغطي على أيقونة <span className="text-blue-600 font-bold">"مشاركة"</span> في شريط الأدوات بالأسفل
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border-2 border-blue-100 shadow-md animate-pulse">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div className="text-xs text-gray-400 font-medium">هذه الأيقونة تجدينها في منتصف الشريط السفلي</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-5 text-right">
                  <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0 font-bold shadow-sm">2</div>
                  <div className="flex-1">
                    <p className="text-base text-gray-800 leading-relaxed font-medium">
                      اسحبي القائمة للأعلى واختاري <span className="text-rose-600 font-bold">"إضافة إلى الشاشة الرئيسية"</span>
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border-2 border-rose-100 shadow-md">
                        <div className="w-8 h-8 border-2 border-gray-400 rounded-lg flex items-center justify-center">
                          <span className="text-2xl font-bold text-gray-400">+</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 font-medium">ستجدينها في القائمة المنسدلة</div>
                    </div>
                  </div>
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
