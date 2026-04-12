import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useTranslation } from '../i18n/LanguageContext';

type AuthMode = 'welcome' | 'login' | 'register' | 'reset';

export const AuthScreen = ({ onSuccess }: { onSuccess: () => void }) => {
  const { t, isRTL } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  React.useEffect(() => {
    const checkDb = async () => {
      try {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await getDocFromServer(doc(db, 'test', 'connection'));
        setDbStatus('ok');
      } catch (e) {
        setDbStatus('error');
      }
    };
    checkDb();
  }, []);

  // Loading timeout to prevent getting stuck
  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (loading) {
      timeout = setTimeout(() => {
        console.warn("Auth: Loading state timed out, forcing to false");
        setLoading(false);
        setError('استغرق الطلب وقتاً طويلاً. يرجى المحاولة مرة أخرى');
      }, 15000); // 15 seconds timeout
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  React.useEffect(() => {
    const checkRedirect = async () => {
      try {
        console.log("Auth: Checking for redirect result...");
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Auth: Redirect Sign-in Success:", result.user.uid);
          await onSuccess();
        }
      } catch (err: any) {
        console.error("Auth Error (Redirect):", err);
        setError(getErrorMessage(err.code));
      }
    };
    checkRedirect();
  }, [onSuccess]);

  const getErrorMessage = (code: string): string => {
    const errors: Record<string, string> = {
      'auth/email-already-in-use': 'البريد الإلكتروني مسجل مسبقاً',
      'auth/wrong-password': 'كلمة المرور غير صحيحة',
      'auth/user-not-found': 'البريد الإلكتروني غير مسجل',
      'auth/weak-password': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      'auth/invalid-email': 'البريد الإلكتروني غير صالح',
      'auth/too-many-requests': 'تم تجاوز عدد المحاولات. حاولي لاحقاً',
      'auth/network-request-failed': 'تحققي من الاتصال بالإنترنت',
      'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول',
      'auth/invalid-credential': 'بيانات الاعتماد غير صالحة. تأكدي من البريد وكلمة المرور',
      'auth/user-disabled': 'تم تعطيل هذا الحساب',
      'auth/operation-not-allowed': 'تسجيل الدخول بهذا الأسلوب غير مفعل حالياً',
      'auth/unauthorized-domain': 'هذا النطاق (Domain) غير مصرح به في إعدادات Firebase. يرجى إضافة النطاق الحالي للقائمة البيضاء.',
    };
    return errors[code] || `حدث خطأ (${code}). حاولي مرة أخرى`;
  };

  const handleEmailAuth = async () => {
    console.log("Auth: handleEmailAuth started", { mode, email: email ? 'provided' : 'missing' });
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        console.log("Auth: Attempting registration...");
        if (!name.trim()) { setError('يرجى إدخال اسمك'); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Auth: Registration success, updating profile...");
        await updateProfile(cred.user, { displayName: name });
      } else {
        console.log("Auth: Attempting login...");
        const cred = await signInWithEmailAndPassword(auth, email, password);
        console.log("Auth: Login success", cred.user.uid);
      }
      console.log("Auth: Calling onSuccess callback...");
      await onSuccess();
    } catch (err: any) {
      console.error("Auth Error (Email) FULL OBJECT:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    console.log("Auth: handleGoogle started");
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      console.log("Auth: Attempting Google Sign-in Popup...");
      try {
        const result = await signInWithPopup(auth, provider);
        console.log("Auth: Google Sign-in Popup Success:", result.user.uid);
        await onSuccess();
      } catch (popupErr: any) {
        console.warn("Auth: Google Popup Error:", popupErr.code, popupErr.message);
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request' || popupErr.code === 'auth/popup-closed-by-user') {
          console.warn("Auth: Popup issue, falling back to Redirect...");
          await signInWithRedirect(auth, provider);
        } else {
          throw popupErr;
        }
      }
    } catch (err: any) {
      console.error("Auth Error (Google) FULL OBJECT:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    console.log("Auth: handleApple started");
    setLoading(true);
    setError('');
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      
      console.log("Auth: Attempting Apple Sign-in Popup...");
      try {
        const result = await signInWithPopup(auth, provider);
        console.log("Auth: Apple Sign-in Popup Success:", result.user.uid);
        await onSuccess();
      } catch (popupErr: any) {
        console.warn("Auth: Apple Popup Error:", popupErr.code, popupErr.message);
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request' || popupErr.code === 'auth/popup-closed-by-user') {
          console.warn("Auth: Popup issue, falling back to Redirect...");
          await signInWithRedirect(auth, provider);
        } else {
          throw popupErr;
        }
      }
    } catch (err: any) {
      console.error("Auth Error (Apple) FULL OBJECT:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('يرجى إدخال بريدك الإلكتروني'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col" dir="rtl">
      
      {/* Welcome Screen */}
      {mode === 'welcome' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col items-center justify-between p-8 pb-16"
        >
          {/* Logo area */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="w-28 h-28 rounded-3xl bg-white border border-rose-100 flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/logo.svg" alt="Niswah Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-rose-600 mb-1">نسوة</h1>
              <p className="text-lg text-gray-500">Niswah</p>
              <p className="text-sm text-gray-400 mt-3 max-w-xs text-center leading-relaxed">
                تتبع دورتك بوعي فقهي وعناية صحية — خصوصيتك محمية تماماً
              </p>
            </div>
          </div>

          {/* Auth buttons */}
          <div className="w-full flex flex-col gap-3">
            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-4 bg-white border border-gray-200 rounded-2xl flex items-center justify-center gap-3 font-medium text-gray-700 active:scale-95 transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              المتابعة مع Google
            </button>

            {/* Apple */}
            <button
              onClick={handleApple}
              disabled={loading}
              className="w-full py-4 bg-black text-white rounded-2xl flex items-center justify-center gap-3 font-medium active:scale-95 transition-transform"
            >
              <svg width="18" height="20" viewBox="0 0 814 1000" fill="white">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-163.9-131.3C57.1 725 10 600.7 10 490.9c0-234.1 150.7-360.2 300.9-360.2 79.4 0 145.6 52.3 195.1 52.3 47.3 0 121.5-55.3 211.8-55.3zm-137-188.8c39.5-46.8 66.6-112.2 66.6-177.6 0-9.5-.6-19.1-2.5-27.3-63.3 2.5-138.5 42.2-183.5 96.4-35.3 40.8-69.9 106.2-69.9 172.3 0 10.2 1.9 20.3 2.5 23.4 3.8.6 10.2 1.3 16.5 1.3 57 0 128.7-38.2 170.3-88.5z"/>
              </svg>
              المتابعة مع Apple
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-200"/>
              <span className="text-xs text-gray-400">أو</span>
              <div className="flex-1 h-px bg-gray-200"/>
            </div>

            {/* Email */}
            <button
              onClick={() => setMode('login')}
              className="w-full py-4 bg-rose-50 border border-rose-200 rounded-2xl font-medium text-rose-600 active:scale-95 transition-transform"
            >
              المتابعة بالبريد الإلكتروني
            </button>

            <p className="text-xs text-gray-400 text-center mt-2 leading-relaxed">
              بالمتابعة، أنتِ توافقين على{' '}
              <span className="text-rose-500 underline">سياسة الخصوصية</span>
              {' '}و{' '}
              <span className="text-rose-500 underline">شروط الاستخدام</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Login / Register */}
      {(mode === 'login' || mode === 'register') && (
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex-1 flex flex-col p-6 pt-12"
        >
          <button onClick={() => setMode('welcome')} className="text-gray-400 text-right mb-8">
            → رجوع
          </button>

          <h2 className="text-2xl font-bold text-right mb-1">
            {mode === 'register' ? 'إنشاء حساب جديد' : 'مرحباً بعودتك'}
          </h2>
          <p className="text-sm text-gray-400 text-right mb-8">
            {mode === 'register' ? 'رحلتك الصحية تبدأ هنا' : 'سجّلي الدخول لمتابعة تتبع دورتك'}
          </p>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailAuth();
            }}
            className="flex flex-col gap-4"
          >
            {mode === 'register' && (
              <div>
                <label className="text-sm text-gray-500 text-right block mb-1">الاسم</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="اسمك أو لقبك"
                  className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-right focus:outline-none focus:border-rose-300"
                  dir="rtl"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-sm text-gray-500 text-right block mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-left focus:outline-none focus:border-rose-300"
                dir="ltr"
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 text-right block mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-left focus:outline-none focus:border-rose-300"
                dir="ltr"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600 text-right">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold disabled:opacity-50 active:scale-95 transition-transform mt-2"
            >
              {loading ? 'جارٍ التحميل...' : mode === 'register' ? 'إنشاء الحساب' : 'تسجيل الدخول'}
            </button>

            {mode === 'login' && (
              <button 
                type="button"
                onClick={() => setMode('reset')} 
                className="text-sm text-rose-400 text-right"
              >
                نسيتِ كلمة المرور؟
              </button>
            )}

            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-rose-500 text-sm font-medium"
              >
                {mode === 'login' ? 'إنشاء حساب جديد' : 'لدي حساب بالفعل'}
              </button>
              <span className="text-gray-400 text-sm">
                {mode === 'login' ? 'ليس لديكِ حساب؟' : 'لديكِ حساب؟'}
              </span>
            </div>
          </form>
        </motion.div>
      )}

      {/* Password Reset */}
      {mode === 'reset' && (
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex-1 flex flex-col p-6 pt-12"
        >
          <button onClick={() => setMode('login')} className="text-gray-400 text-right mb-8">
            → رجوع
          </button>

          <h2 className="text-2xl font-bold text-right mb-2">استعادة كلمة المرور</h2>
          <p className="text-sm text-gray-400 text-right mb-8">
            سنرسل لكِ رابط إعادة التعيين على بريدك
          </p>

          {resetSent ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-emerald-700 font-bold">تم الإرسال!</p>
              <p className="text-sm text-emerald-600 mt-2">تحققي من بريدك الإلكتروني</p>
              <button onClick={() => setMode('login')} className="mt-4 text-rose-500 text-sm">
                العودة لتسجيل الدخول
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-left focus:outline-none focus:border-rose-300"
                dir="ltr"
              />
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-600 text-right">{error}</p>
                </div>
              )}
              <button
                onClick={handleReset}
                disabled={loading}
                className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold disabled:opacity-50"
              >
                {loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
              </button>
            </div>
          )}
        </motion.div>
      )}
      {/* Debug Info (Only for troubleshooting) */}
      <div className="fixed bottom-4 left-4 right-4 p-2 bg-black/5 rounded text-[10px] font-mono text-gray-400 pointer-events-none opacity-50">
        Auth: {auth.currentUser ? `Logged in (${auth.currentUser.uid.slice(0,5)})` : 'Not logged in'} | 
        DB: {dbStatus} |
        Mode: {mode} | 
        Loading: {loading ? 'YES' : 'NO'}
      </div>
    </div>
  );
};
