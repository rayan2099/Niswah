import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Baby, Bot, CalendarDays, FileText, HeartHandshake, Phone, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import {
  sendPasswordReset,
  signInWithEmail,
  signInWithPhonePassword,
  signInWithProvider,
  signUpWithEmail,
  signUpWithPhonePassword,
} from '../auth';
import { useTranslation } from '../i18n/LanguageContext';
import { PWAInstallBanner } from './PWAInstallBanner';

type AuthMode = 'welcome' | 'email' | 'phone' | 'reset';
const SAUDI_PHONE_PREFIX = '+966';

export const AuthScreen = ({ onSuccess }: { onSuccess: () => void }) => {
  const { t, isRTL } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isPhoneRegistering, setIsPhoneRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const welcomeFeatures = [
    {
      icon: CalendarDays,
      title: 'تتبع الدورة',
      tint: 'rose'
    },
    {
      icon: HeartHandshake,
      title: 'تخطيط للحمل',
      tint: 'amber'
    },
    {
      icon: Baby,
      title: 'تتبع الحمل',
      tint: 'emerald'
    },
    {
      icon: Bot,
      title: 'طبيبة ذكية',
      tint: 'sky'
    },
    {
      icon: UsersRound,
      title: 'مجتمع نسائي',
      tint: 'violet'
    },
    {
      icon: FileText,
      title: 'تقارير PDF',
      tint: 'slate'
    },
    {
      icon: ShieldCheck,
      title: 'خصوصية عالية',
      tint: 'teal'
    },
    {
      icon: Sparkles,
      title: 'رؤى يومية',
      tint: 'pink'
    },
  ];

  // Loading timeout to prevent getting stuck
  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (loading) {
      timeout = setTimeout(() => {
        setLoading(false);
        setError('استغرق الطلب وقتاً طويلاً. يرجى المحاولة مرة أخرى');
      }, 15000); // 15 seconds timeout
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  const getErrorMessage = (code: string): string => {
    const errors: Record<string, string> = {
      'User already registered': 'البريد الإلكتروني مسجل مسبقاً',
      'Invalid login credentials': 'بيانات الاعتماد غير صالحة. تأكدي من البريد وكلمة المرور',
      'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      'Email not confirmed': 'يرجى تأكيد البريد الإلكتروني أولاً',
    };
    return errors[code] || `حدث خطأ (${code || 'غير معروف'}). حاولي مرة أخرى`;
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    if (!agreed) {
      setError('يرجى الموافقة على سياسة الخصوصية وشروط الاستخدام');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        if (!name.trim()) { 
          setError('يرجى إدخال اسمك لإكمال التسجيل'); 
          setLoading(false); 
          return; 
        }
        const { error: signUpError } = await signUpWithEmail(email, password, name);
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            setIsRegistering(false);
            setError('هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول باستخدام كلمة المرور الخاصة بكِ');
            setLoading(false);
            return;
          }
          throw signUpError;
        }
        await onSuccess();
      } else {
        const { error: signInError } = await signInWithEmail(email, password);
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials') && !isRegistering) {
            setIsRegistering(true);
            setError('يبدو أنكِ مستخدمة جديدة، يرجى إدخال اسمكِ لإكمال التسجيل');
            setLoading(false);
            return;
          }
          throw signInError;
        }
        await onSuccess();
      }
    } catch (err: any) {
      setError(getErrorMessage(err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!agreed) {
      setError('يرجى الموافقة على سياسة الخصوصية وشروط الاستخدام أولاً');
      // Scroll to checkbox
      document.getElementById('consent-checkbox')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: providerError } = await signInWithProvider('google');
      if (providerError) setError(getErrorMessage(providerError.message));
    } catch (err: any) {
      setError(getErrorMessage(err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    if (!agreed) {
      setError('يرجى الموافقة على سياسة الخصوصية وشروط الاستخدام');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: providerError } = await signInWithProvider('apple');
      if (providerError) setError(getErrorMessage(providerError.message));
    } catch (err: any) {
      setError(getErrorMessage(err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (value: string) => {
    const compact = value.replace(/[\s()-]/g, '');
    if (!compact) return '';
    if (compact.startsWith('00')) return `+${compact.slice(2)}`;
    if (compact.startsWith('+')) return compact;
    if (compact.startsWith('966')) return `+${compact}`;
    if (compact.startsWith('05')) return `+966${compact.slice(1)}`;
    if (compact.startsWith('5') && compact.length === 9) return `+966${compact}`;
    return `${SAUDI_PHONE_PREFIX}${compact.replace(/^0+/, '')}`;
  };

  const displayPhone = (value: string) => {
    const normalized = normalizePhone(value);
    if (normalized.startsWith(SAUDI_PHONE_PREFIX)) {
      return normalized.slice(SAUDI_PHONE_PREFIX.length);
    }
    return value.replace(/^\+?966/, '').replace(/^0/, '');
  };

  const handlePhoneChange = (value: string) => {
    setPhone(displayPhone(value).replace(/[^\d]/g, '').slice(0, 9));
  };

  const handlePhoneAuth = async () => {
    if (!agreed) {
      setError('يرجى الموافقة على سياسة الخصوصية وشروط الاستخدام');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('اكتبي رقم الجوال بصيغة دولية مثل +9665XXXXXXXX');
      return;
    }
    if (!password || password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (isPhoneRegistering && !name.trim()) {
      setError('يرجى إدخال اسمك لإكمال التسجيل');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (isPhoneRegistering) {
        const { error: signUpError } = await signUpWithPhonePassword(normalizedPhone, password, name);
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            setIsPhoneRegistering(false);
            setError('هذا الرقم مسجل مسبقاً، سجّلي الدخول بكلمة المرور');
            setLoading(false);
            return;
          }
          throw signUpError;
        }
      } else {
        const { error: signInError } = await signInWithPhonePassword(normalizedPhone, password);
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            setIsPhoneRegistering(true);
            setError('يبدو أن الرقم جديد. اكتبي اسمك لإكمال التسجيل');
            setLoading(false);
            return;
          }
          throw signInError;
        }
      }
      await onSuccess();
    } catch (err: any) {
      setError(getErrorMessage(err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('يرجى إدخال بريدك الإلكتروني'); return; }
    setLoading(true);
    try {
      const { error: resetError } = await sendPasswordReset(email);
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: any) {
      setError(getErrorMessage(err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col" dir="rtl">
      <PWAInstallBanner placement="auth" />
      
      {/* Welcome Screen */}
      {mode === 'welcome' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col items-center justify-between px-8 pb-12 pt-10"
        >
          {/* Logo area */}
          <div className="w-full flex flex-col items-center gap-5">
            <div className="w-24 h-24 rounded-[32px] bg-white border border-rose-100 flex items-center justify-center shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src="/logo.svg" alt="Niswah Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="text-center px-2">
              <h1 className="text-[34px] leading-tight font-bold text-rose-900 mb-2">
                <span className="sr-only">نسوة</span>
                ابدئي بثقة
              </h1>
              <p className="text-sm text-gray-500 max-w-xs text-center leading-7">
                رفيقتك للحيض والطهارة والحمل، بوعي صحي وفقهي وخصوصية كاملة.
              </p>
            </div>

            <div className="w-full rounded-[28px] border border-rose-100 bg-white/85 p-3 shadow-sm shadow-rose-100/40">
              <div className="grid grid-cols-2 gap-2">
                {welcomeFeatures.map(({ icon: Icon, title, tint }) => (
                  <div key={title} className="flex min-h-[54px] items-center gap-2 rounded-2xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-black/[0.03]">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                      tint === 'amber' ? 'bg-amber-50 text-amber-600' :
                      tint === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                      tint === 'sky' ? 'bg-sky-50 text-sky-600' :
                      tint === 'violet' ? 'bg-violet-50 text-violet-600' :
                      tint === 'slate' ? 'bg-slate-50 text-slate-600' :
                      tint === 'teal' ? 'bg-teal-50 text-teal-600' :
                      tint === 'pink' ? 'bg-pink-50 text-pink-600' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="text-[12px] font-bold leading-5 text-slate-800">{title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Auth buttons */}
          <div className="w-full flex flex-col gap-3 mt-6">
            
            {/* Consent — required for ALL auth methods */}
            <ConsentCheckbox 
              agreed={agreed} 
              setAgreed={setAgreed} 
              setError={setError} 
              onPrivacy={() => setShowPrivacy(true)} 
              onTerms={() => setShowTerms(true)} 
            />

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2"
              >
                <p className="text-xs text-red-600 text-right">{error}</p>
              </motion.div>
            )}

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

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('phone')}
                className="w-full py-4 bg-emerald-50 border border-emerald-200 rounded-2xl font-bold text-emerald-700 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" />
                الجوال
              </button>

              <button
                onClick={() => setMode('email')}
                className="w-full py-4 bg-rose-50 border border-rose-200 rounded-2xl font-bold text-rose-600 active:scale-95 transition-transform"
              >
                البريد الإلكتروني
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showPrivacy && (
              <LegalModal 
                title="سياسة الخصوصية" 
                onClose={() => setShowPrivacy(false)}
              >
                <div className="space-y-6 text-right" dir="rtl">
                  <div className="text-xs text-gray-400 mb-4">آخر تحديث: محرم ١٤٤٧ هـ</div>
                  
                  <div className="space-y-4">
                    <p className="font-bold text-rose-600">مقدمة</p>
                    <p className="text-sm leading-relaxed">
                      تطبيق نسوة ("التطبيق") مُصمَّم خصيصاً للمرأة المسلمة لتتبع دورتها الشهرية بوعي فقهي وعناية صحية. نحن نُدرك حساسية البيانات الصحية التي تشاركينها معنا، ونلتزم بحمايتها بأعلى معايير الخصوصية.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">١. البيانات التي نجمعها</p>
                    <p className="text-sm">نجمع فقط ما تحتاجه لتشغيل التطبيق:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pr-2">
                      <li>بيانات الدورة الشهرية: أيام الحيض، الطهارة، الكثافة، اللون، الأعراض</li>
                      <li>المذهب الفقهي المختار</li>
                      <li>الموقع الجغرافي (لحساب أوقات الصلاة فقط — لا يُخزَّن)</li>
                      <li>البريد الإلكتروني عند إنشاء الحساب</li>
                      <li>اسم العرض (اختياري)</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٢. كيف نستخدم بياناتك</p>
                    <p className="text-sm">تُستخدم بياناتك حصراً لـ:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pr-2">
                      <li>حساب حالتك الفقهية (حيض، طهارة، استحاضة)</li>
                      <li>عرض تقويمك الشخصي وتوقعات الدورة</li>
                      <li>إرسال الإشعارات التي طلبتِها فقط</li>
                      <li>إعداد تقارير PDF التي تطلبينها</li>
                    </ul>
                    <p className="text-sm font-bold text-rose-500">لا نستخدم بياناتك للإعلانات. لا نبيعها. لا نشاركها مع أي طرف ثالث.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٣. تخزين البيانات وحمايتها</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pr-2">
                      <li>تُخزَّن بياناتك في Supabase بتشفير وحماية على مستوى الصفوف</li>
                      <li>لا يمكن لأحد — بما في ذلك فريق نسوة — الاطلاع على بياناتك الشخصية</li>
                      <li>أنتِ الوحيدة التي تملك الوصول الكامل إلى بياناتك</li>
                      <li>نستخدم بروتوكولات HTTPS وسياسات Supabase RLS لضمان عزل بيانات كل مستخدمة</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٤. حقوقك الكاملة</p>
                    <p className="text-sm">يحق لكِ في أي وقت:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pr-2">
                      <li>تصدير بياناتك كاملةً كتقارير PDF</li>
                      <li>تعديل أي معلومة سجّلتِها</li>
                      <li>حذف حسابك وجميع بياناتك نهائياً وفورياً من إعدادات الملف الشخصي</li>
                      <li>تفعيل الوضع المجهول لإخفاء اسمك في أي مكان بالتطبيق</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٥. البيانات الصحية الحساسة</p>
                    <p className="text-sm">نُعامل بيانات الدورة الشهرية كبيانات صحية بالغة الحساسية. لا نشاركها مع:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pr-2 text-red-500">
                      <li>شركات التأمين</li>
                      <li>جهات التوظيف</li>
                      <li>المعلنين</li>
                      <li>أي طرف ثالث بأي شكل</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٦. الأطفال</p>
                    <p className="text-sm">التطبيق مخصص للنساء البالغات. لا نجمع بيانات من أي شخص دون سن ١٢ عاماً.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٧. التغييرات على هذه السياسة</p>
                    <p className="text-sm">في حال تغيير هذه السياسة، سنُخطركِ داخل التطبيق قبل ٧ أيام من تطبيق أي تغيير.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٨. التواصل معنا</p>
                    <p className="text-sm">
                      لأي استفسار أو طلب متعلق ببياناتك:<br />
                      البريد الإلكتروني: <a href="mailto:mayson.ogc@gmail.com" className="text-rose-500 font-bold">mayson.ogc@gmail.com</a>
                    </p>
                  </div>
                </div>
              </LegalModal>
            )}
            {showTerms && (
              <LegalModal 
                title="شروط الاستخدام" 
                onClose={() => setShowTerms(false)}
              >
                <div className="space-y-6 text-right" dir="rtl">
                  <div className="text-xs text-gray-400 mb-4">آخر تحديث: محرم ١٤٤٧ هـ</div>

                  <div className="space-y-3">
                    <p className="font-bold">١. قبول الشروط</p>
                    <p className="text-sm">باستخدامك تطبيق نسوة، فإنك توافقين على هذه الشروط. إن لم توافقي عليها، يُرجى عدم استخدام التطبيق.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٢. طبيعة الخدمة</p>
                    <p className="text-sm">نسوة أداة مساعدة للتتبع والإرشاد الفقهي العام. يجب أن تعلمي أن:</p>
                    <ul className="list-disc list-inside text-sm space-y-2 pr-2">
                      <li>المعلومات الفقهية المقدَّمة مبنية على المذاهب الأربعة المعتمدة وتُعرَض للإرشاد العام فقط</li>
                      <li>التطبيق لا يُغني عن استشارة عالمة دين أو فقيهة متخصصة في المسائل الدقيقة</li>
                      <li>المعلومات الصحية المقدَّمة للتوعية فقط ولا تُعدّ تشخيصاً طبياً</li>
                      <li>يجب استشارة طبيبة مختصة لأي قرار طبي</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٣. الاستخدام المقبول</p>
                    <p className="text-sm">يُسمح باستخدام التطبيق لـ:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pr-2 mb-2">
                      <li>تتبع الدورة الشهرية الشخصية</li>
                      <li>الاطلاع على الأحكام الفقهية العامة المتعلقة بالحيض والطهارة</li>
                      <li>استخراج التقارير الشخصية</li>
                    </ul>
                    <p className="text-sm">يُحظر استخدام التطبيق لـ:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pr-2">
                      <li>انتهاك خصوصية أي شخص آخر</li>
                      <li>أي غرض مخالف للأنظمة والقوانين المعمول بها</li>
                      <li>محاولة اختراق أو التلاعب بالبيانات</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٤. الملكية الفكرية</p>
                    <p className="text-sm">جميع محتويات التطبيق من تصميم وكود وخوارزميات وأحكام فقهية مُعالَجة هي ملك حصري لنسوة. لا يحق نسخها أو توزيعها دون إذن كتابي مسبق.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٥. إخلاء المسؤولية</p>
                    <ul className="list-disc list-inside text-sm space-y-2 pr-2">
                      <li>نسوة غير مسؤولة عن أي قرار ديني أو طبي يُتخذ بناءً على معطيات التطبيق وحدها</li>
                      <li>دقة التوقعات تعتمد على انتظام الدورة وكمية البيانات المُسجَّلة</li>
                      <li>لسنا مسؤولين عن أي اضطراب في الخدمة ناتج عن ظروف خارجة عن إرادتنا</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٦. تعليق الحساب</p>
                    <p className="text-sm">نحتفظ بحق تعليق أي حساب يُستخدم بطريقة مخالفة لهذه الشروط.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٧. تغيير الشروط</p>
                    <p className="text-sm">نحتفظ بحق تعديل هذه الشروط مع إشعار مسبق داخل التطبيق.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٨. القانون المطبَّق</p>
                    <p className="text-sm">تخضع هذه الشروط لأنظمة المملكة العربية السعودية.</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-bold">٩. التواصل</p>
                    <p className="text-sm">لأي استفسار: <a href="mailto:support@niswah.app" className="text-rose-500 font-bold">support@niswah.app</a></p>
                  </div>
                </div>
              </LegalModal>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Phone Auth */}
      {mode === 'phone' && (
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex-1 flex flex-col p-6 pt-12"
        >
          <button onClick={() => {
            setMode('welcome');
            setIsPhoneRegistering(false);
            setError('');
          }} className="text-gray-400 text-right mb-8">
            → رجوع
          </button>

          <div className="mb-8 text-right">
            <div className="mx-0 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Phone className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold mb-1">الدخول برقم الجوال</h2>
            <p className="text-sm text-gray-400 leading-7">
              استخدمي رقمك وكلمة مرور خاصة بنسوة. لا نحتاج رسالة SMS ولا مزود خارجي.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePhoneAuth();
            }}
            className="flex flex-col gap-4"
          >
            <AnimatePresence>
              {isPhoneRegistering && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="overflow-hidden"
                >
                  <label className="text-sm text-gray-500 text-right block mb-1">الاسم</label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="اسمك الأول"
                    className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-right focus:outline-none focus:border-emerald-300"
                    required={isPhoneRegistering}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-sm text-gray-500 text-right block mb-1">رقم الجوال</label>
              <div dir="ltr" className="flex w-full items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-50">
                <div className="flex h-full items-center gap-2 border-r border-gray-200 bg-white px-4 py-3 text-sm font-extrabold text-emerald-700">
                  <span className="text-base leading-none">🇸🇦</span>
                  <span>{SAUDI_PHONE_PREFIX}</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="5XXXXXXXX"
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-left tracking-wide text-slate-900 outline-none placeholder:text-gray-300"
                  dir="ltr"
                  maxLength={9}
                  required
                />
              </div>
              <p className="mt-2 text-right text-xs text-gray-400">اكتبي رقمك بدون الصفر الأول، مثل 5XXXXXXXX</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 text-right block mb-1">كلمة المرور</label>
              <input
                type="password"
                autoComplete={isPhoneRegistering ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-right focus:outline-none focus:border-emerald-300"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600 text-right">{error}</p>
              </div>
            )}

            <ConsentCheckbox
              agreed={agreed}
              setAgreed={setAgreed}
              setError={setError}
              onPrivacy={() => setShowPrivacy(true)}
              onTerms={() => setShowTerms(true)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold disabled:opacity-50 active:scale-95 transition-transform mt-2"
            >
              {loading ? 'جارٍ التحميل...' : isPhoneRegistering ? 'إنشاء حساب بالجوال' : 'الدخول بالجوال'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPhoneRegistering(value => !value);
                setError('');
              }}
              className="text-center text-sm font-bold text-emerald-700"
            >
              {isPhoneRegistering ? 'لدي حساب بالفعل' : 'رقمي جديد، أريد إنشاء حساب'}
            </button>
          </form>
        </motion.div>
      )}

      {/* Email Auth */}
      {mode === 'email' && (
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex-1 flex flex-col p-6 pt-12"
        >
          <button onClick={() => {
            setMode('welcome');
            setIsRegistering(false);
            setError('');
          }} className="text-gray-400 text-right mb-8">
            → رجوع
          </button>

          <h2 className="text-2xl font-bold text-right mb-1">
            {isRegistering ? 'إنشاء حساب جديد' : 'مرحباً بعودتك'}
          </h2>
          <p className="text-sm text-gray-400 text-right mb-8">
            {isRegistering ? 'رحلتك الصحية تبدأ هنا' : 'سجّلي الدخول لمتابعة تتبع دورتك'}
          </p>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailAuth();
            }}
            className="flex flex-col gap-4"
          >
            <AnimatePresence>
              {isRegistering && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="overflow-hidden"
                >
                  <label className="text-sm text-gray-500 text-right block mb-1">الاسم</label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="اسمك أو لقبك"
                    className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-right focus:outline-none focus:border-rose-300"
                    dir="rtl"
                    required={isRegistering}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-sm text-gray-500 text-right block mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                autoComplete="email"
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
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
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

            <ConsentCheckbox 
              agreed={agreed} 
              setAgreed={setAgreed} 
              setError={setError} 
              onPrivacy={() => setShowPrivacy(true)} 
              onTerms={() => setShowTerms(true)} 
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold disabled:opacity-50 active:scale-95 transition-transform mt-2"
            >
              {loading ? 'جارٍ التحميل...' : isRegistering ? 'إكمال التسجيل' : 'تسجيل الدخول'}
            </button>

            {!isRegistering && (
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
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-rose-500 text-sm font-medium"
              >
                {isRegistering ? 'لدي حساب بالفعل' : 'إنشاء حساب جديد'}
              </button>
              <span className="text-gray-400 text-sm">
                {isRegistering ? 'لديكِ حساب؟' : 'ليس لديكِ حساب؟'}
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
          <button onClick={() => setMode('email')} className="text-gray-400 text-right mb-8">
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
              <button onClick={() => setMode('email')} className="mt-4 text-rose-500 text-sm">
                العودة لتسجيل الدخول
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <input
                type="email"
                autoComplete="email"
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
    </div>
  );
};

const ConsentCheckbox = ({ agreed, setAgreed, setError, onPrivacy, onTerms }: { 
  agreed: boolean; 
  setAgreed: (v: boolean) => void; 
  setError: (v: string) => void;
  onPrivacy: () => void;
  onTerms: () => void;
}) => (
  <div className="flex items-start gap-2 w-full mb-2" dir="rtl">
    <input
      type="checkbox"
      id="consent-checkbox"
      checked={agreed}
      onChange={e => { setAgreed(e.target.checked); setError(''); }}
      className="mt-1 w-4 h-4 accent-rose-500 flex-shrink-0"
    />
    <label htmlFor="consent-checkbox" className="text-xs text-gray-500 text-right leading-relaxed">
      أوافق على{' '}
      <button type="button" onClick={onPrivacy} className="text-rose-500 underline">
        سياسة الخصوصية
      </button>
      {' '}و{' '}
      <button type="button" onClick={onTerms} className="text-rose-500 underline">
        شروط الاستخدام
      </button>
    </label>
  </div>
);

const LegalModal = ({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
    >
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-rose-50/30">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          ✕
        </button>
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
      </div>
      <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {children}
      </div>
      <div className="p-6 bg-gray-50 flex justify-center">
        <button
          onClick={onClose}
          className="px-8 py-3 bg-rose-500 text-white rounded-2xl font-bold shadow-lg shadow-rose-200 active:scale-95 transition-transform"
        >
          فهمت ذلك
        </button>
      </div>
    </motion.div>
  </motion.div>
);
