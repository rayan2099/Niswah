/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Baby,
  CalendarDays,
  MessageCircle,
  Heart,
  Moon,
  ShieldCheck,
  Send,
  Sparkles,
  Stethoscope,
  Utensils,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import * as api from '../api/index.ts';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { callGemini } from '../utils/aiClient.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PregnancyTrackerProps {
  currentWeek: number;
  userId?: string;
  onLogBirth: () => void;
}

type WeekGuide = {
  week: number;
  stageAr: string;
  stageEn: string;
  sizeAr: string;
  sizeEn: string;
  babyAr: string;
  babyEn: string;
  motherAr: string;
  motherEn: string;
  worshipAr: string;
  worshipEn: string;
  nutritionAr: string;
  nutritionEn: string;
};

type PregnancyDashboardNotes = {
  movementLogs: { id: string; at: string }[];
  doctorMessages: PregnancyDoctorMessage[];
};

type PregnancyDoctorMessage = {
  role: 'ai' | 'user';
  text: string;
  timestamp: string;
};

const defaultNotes: PregnancyDashboardNotes = {
  movementLogs: [],
  doctorMessages: [],
};

const GUIDES: WeekGuide[] = [
  {
    week: 4,
    stageAr: 'مرحلة النطفة',
    stageEn: 'Nutfah stage',
    sizeAr: 'بحجم بذرة صغيرة',
    sizeEn: 'Tiny seed size',
    babyAr: 'تبدأ البويضة المخصبة بالانغراس وتتشكل البدايات الأولى للمشيمة.',
    babyEn: 'Implantation begins and the earliest foundations of the placenta form.',
    motherAr: 'قد يظهر تعب، غثيان، حساسية في الثدي، أو تغير في المزاج.',
    motherEn: 'Fatigue, nausea, breast tenderness, or mood shifts may appear.',
    worshipAr: 'الأصل الصلاة المعتادة، ومع الغثيان أو الدوخة اختاري الهيئة الأيسر بحسب الاستطاعة.',
    worshipEn: 'Standard prayer remains the default; with nausea or dizziness, choose the easiest posture you can.',
    nutritionAr: 'ركزي على حمض الفوليك والماء ووجبات صغيرة عند الغثيان.',
    nutritionEn: 'Prioritize folate, hydration, and small meals if nausea appears.',
  },
  {
    week: 12,
    stageAr: 'مرحلة العلقة',
    stageEn: 'Alaqah stage',
    sizeAr: 'بحجم ليمونة',
    sizeEn: 'Lime size',
    babyAr: 'تتشكل الأعضاء الأساسية وتبدأ ملامح الوجه والأطراف بالوضوح.',
    babyEn: 'Major organs are forming and facial features and limbs become clearer.',
    motherAr: 'قد يخف الغثيان تدريجياً، لكن التعب والحساسية قد يستمران.',
    motherEn: 'Nausea may begin to ease, though fatigue and tenderness can continue.',
    worshipAr: 'عند التعب الواضح، خذي الرخصة المناسبة بعد سؤال أهل العلم عند الحاجة.',
    worshipEn: 'With clear hardship, use appropriate ease and ask trusted scholars when needed.',
    nutritionAr: 'ادعمي الكالسيوم والبروتين: الزبادي، البيض، البقول، والمكسرات.',
    nutritionEn: 'Support calcium and protein: yogurt, eggs, legumes, and nuts.',
  },
  {
    week: 20,
    stageAr: 'منتصف الحمل',
    stageEn: 'Mid-pregnancy',
    sizeAr: 'بحجم موزة',
    sizeEn: 'Banana size',
    babyAr: 'قد تبدأ الحركة بالوضوح، وهذا وقت مهم لمتابعة النمو والسونار.',
    babyEn: 'Movement may become clearer; this is an important growth and scan window.',
    motherAr: 'قد يظهر ألم ظهر خفيف، شد في البطن، أو زيادة في الشهية.',
    motherEn: 'Mild back pain, belly stretching, or appetite changes may appear.',
    worshipAr: 'إذا تأثر التوازن أو الظهر، اختاري وضعية ثابتة ومريحة بحسب الاستطاعة.',
    worshipEn: 'If balance or back pain is affected, choose a steady, comfortable posture as able.',
    nutritionAr: 'الحديد مهم الآن: الفاصوليا، التمر، اللحوم الخفيفة، والمشمش المجفف.',
    nutritionEn: 'Iron matters now: beans, dates, lean meats, and dried apricots.',
  },
  {
    week: 28,
    stageAr: 'بداية الثلث الأخير',
    stageEn: 'Third trimester begins',
    sizeAr: 'نمو سريع وحركة أوضح',
    sizeEn: 'Rapid growth and clearer movement',
    babyAr: 'تزداد قوة الحركة ويتطور الدماغ والرئتان بسرعة.',
    babyEn: 'Movements strengthen while the brain and lungs develop quickly.',
    motherAr: 'قد يزيد الثقل، الحموضة، ضيق النفس، وتحتاجين راحة أكثر.',
    motherEn: 'Heaviness, reflux, breathlessness, and a need for more rest may increase.',
    worshipAr: 'المشقة معتبرة، فاختاري الأيسر في القيام والركوع والسجود عند الحاجة.',
    worshipEn: 'Hardship matters; choose easier standing, bowing, or prostration when needed.',
    nutritionAr: 'وجبات أصغر ومتكررة قد تساعد مع الحموضة وثقل المعدة.',
    nutritionEn: 'Smaller frequent meals may help with reflux and heaviness.',
  },
  {
    week: 36,
    stageAr: 'الاستعداد للولادة',
    stageEn: 'Birth preparation',
    sizeAr: 'قريب من الاكتمال',
    sizeEn: 'Near full term',
    babyAr: 'يستمر اكتمال الرئتين ويبدأ الجسم بالاستعداد للولادة.',
    babyEn: 'The lungs keep maturing and the body prepares for birth.',
    motherAr: 'قد تكثر الانقباضات الخفيفة والضغط أسفل البطن والحاجة للتبول.',
    motherEn: 'Mild contractions, pelvic pressure, and frequent urination may increase.',
    worshipAr: 'جهزي أسئلتك عن الصلاة والنفاس قبل الولادة حتى تكوني مطمئنة.',
    worshipEn: 'Prepare prayer and nifas questions before birth so you feel settled.',
    nutritionAr: 'حافظي على السوائل والطاقة، وخففي الوجبات الثقيلة قبل النوم.',
    nutritionEn: 'Keep fluids and energy steady; avoid heavy meals before sleep.',
  },
  {
    week: 40,
    stageAr: 'نافذة الولادة',
    stageEn: 'Due window',
    sizeAr: 'اكتمل النمو غالباً',
    sizeEn: 'Likely full term',
    babyAr: 'راقبي علامات المخاض وحركة الجنين حسب إرشادات الطبيبة.',
    babyEn: 'Track labor signs and baby movement as advised by your clinician.',
    motherAr: 'قد تزداد الانقباضات والضغط، ويفضل أن تكون حقيبتك وخطتك جاهزة.',
    motherEn: 'Contractions and pressure may increase; your bag and plan should be ready.',
    worshipAr: 'مع الولادة يبدأ النفاس بعد نزول دم الولادة، وسجليه هنا عند حدوثه.',
    worshipEn: 'Nifas begins after postpartum bleeding starts; log birth here when it happens.',
    nutritionAr: 'التمر والسوائل والوجبات الخفيفة تساعد على الطاقة إن كانت مناسبة لك.',
    nutritionEn: 'Dates, fluids, and light meals can support energy if suitable for you.',
  },
];

const clampWeek = (week: number) => Math.min(40, Math.max(1, Math.round(week || 1)));
const getGuide = (week: number) => [...GUIDES].reverse().find(item => week >= item.week) || GUIDES[0];
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export const PregnancyTracker = ({ currentWeek, userId = 'local', onLogBirth }: PregnancyTrackerProps) => {
  const { t, language } = useTranslation();
  const isRTL = language === 'ar';
  const week = clampWeek(currentWeek);
  const storageKey = `niswah_pregnancy_dashboard_${userId}`;
  const guide = useMemo(() => getGuide(week), [week]);
  const trimester = Math.min(3, Math.max(1, Math.ceil(week / 13)));
  const trimesterRange = trimester === 1 ? '1-13' : trimester === 2 ? '14-27' : '28-40';
  const daysRemaining = Math.max(0, (40 - week) * 7);
  const progress = Math.round((week / 40) * 100);
  const weeksToBirth = Math.max(0, 40 - week);
  const nextMilestone = GUIDES.find(item => item.week > week);
  const [notes, setNotes] = useState<PregnancyDashboardNotes>(defaultNotes);
  const [isSyncing, setIsSyncing] = useState(false);
  const [doctorInput, setDoctorInput] = useState('');
  const [isDoctorTyping, setIsDoctorTyping] = useState(false);
  const [doctorError, setDoctorError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const local = localStorage.getItem(storageKey);
    if (local) {
      try {
        setNotes({ ...defaultNotes, ...JSON.parse(local) });
      } catch {
        setNotes(defaultNotes);
      }
    }

    api.getActivePregnancyRecord().then(({ data }) => {
      if (!alive || !data?.weekly_notes?.dashboard) return;
      const synced = { ...defaultNotes, ...data.weekly_notes.dashboard } as PregnancyDashboardNotes;
      setNotes(synced);
      localStorage.setItem(storageKey, JSON.stringify(synced));
    });

    return () => {
      alive = false;
    };
  }, [storageKey]);

  const persistNotes = (nextNotes: PregnancyDashboardNotes) => {
      setNotes(nextNotes);
      localStorage.setItem(storageKey, JSON.stringify(nextNotes));
      setIsSyncing(true);
    api.updatePregnancyNotes({ dashboard: nextNotes })
      .catch(() => undefined)
      .finally(() => setIsSyncing(false));
  };

  const todayMovementCount = notes.movementLogs.filter(log => isToday(log.at)).length;
  const lastMovementAt = notes.movementLogs[notes.movementLogs.length - 1]?.at || null;
  const movementLabel = lastMovementAt
    ? new Intl.DateTimeFormat(isRTL ? 'ar-SA' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(lastMovementAt))
    : (isRTL ? 'لم تُسجل اليوم' : 'Not logged today');

  const copy = {
    stage: isRTL ? guide.stageAr : guide.stageEn,
    size: isRTL ? guide.sizeAr : guide.sizeEn,
    baby: isRTL ? guide.babyAr : guide.babyEn,
    mother: isRTL ? guide.motherAr : guide.motherEn,
    worship: isRTL ? guide.worshipAr : guide.worshipEn,
    nutrition: isRTL ? guide.nutritionAr : guide.nutritionEn,
    daysRemaining: isRTL ? `${daysRemaining} يوم تقريباً` : `About ${daysRemaining} days`,
    weeksToBirth: isRTL ? `${weeksToBirth} أسبوع متبقٍ` : `${weeksToBirth} weeks left`,
    trimesterRange: isRTL ? `أسابيع ${trimesterRange}` : `Weeks ${trimesterRange}`,
    nextMilestone: nextMilestone
      ? (isRTL ? `المحطة القادمة: أسبوع ${nextMilestone.week}` : `Next milestone: week ${nextMilestone.week}`)
      : (isRTL ? 'أنتِ في نافذة الولادة' : 'You are in the due window'),
    prayerMetric: isRTL ? 'حسب الاستطاعة عند المشقة' : 'As able when hardship exists',
  };

  const logMovement = () => {
    persistNotes({
      ...notes,
      movementLogs: [...notes.movementLogs.slice(-39), { id: crypto.randomUUID(), at: new Date().toISOString() }],
    });
  };

  const appointmentWindow = week < 28
    ? (isRTL ? 'زيارة كل 4 أسابيع تقريباً' : 'About every 4 weeks')
    : week < 36
      ? (isRTL ? 'زيارة كل أسبوعين تقريباً' : 'About every 2 weeks')
      : (isRTL ? 'متابعة أسبوعية غالباً' : 'Often weekly check-ins');

  const doctorMessages = notes.doctorMessages.length > 0
    ? notes.doctorMessages
    : [{
        role: 'ai' as const,
        text: isRTL
          ? 'السلام عليكِ، أنا طبيبة الحمل في نسوة. اسأليني عن الأعراض، الحركة، التغذية، القلق، الصلاة أو الصيام أثناء الحمل. إذا كان عندك نزيف، ألم شديد، صداع شديد مع زغللة، ألم صدر، أو نقص واضح في حركة الجنين فتواصلي مع الرعاية الطبية فوراً.'
          : 'I am Niswah pregnancy doctor. Ask me about symptoms, baby movement, nutrition, anxiety, prayer, or fasting during pregnancy. If you have bleeding, severe pain, severe headache with vision changes, chest pain, or clearly reduced baby movement, contact medical care now.',
        timestamp: new Date().toISOString(),
      }];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [doctorMessages.length, isDoctorTyping]);

  const quickPrompts = [
    isRTL ? 'هل هذه الأعراض طبيعية؟' : 'Are these symptoms normal?',
    isRTL ? 'متى أقلق من حركة الجنين؟' : 'When should I worry about movement?',
    isRTL ? 'هل أستطيع الصيام وأنا حامل؟' : 'Can I fast while pregnant?',
    isRTL ? 'كيف أستعد لزيارة الطبيبة؟' : 'How do I prepare for my visit?',
    isRTL ? 'أنا قلقة اليوم، ماذا أفعل؟' : 'I feel anxious today. What can I do?',
  ];

  const askPregnancyDoctor = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isDoctorTyping) return;

    setDoctorError('');
    setDoctorInput('');
    const userMessage: PregnancyDoctorMessage = {
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const history = [...doctorMessages, userMessage].slice(-10);
    persistNotes({ ...notes, doctorMessages: history });
    setIsDoctorTyping(true);

    const systemInstruction = isRTL
      ? `أنتِ "طبيبة الحمل في نسوة"، مساعدة حمل عربية مخصصة للنساء المسلمات.
السياق: المستخدم حامل في الأسبوع ${week}. المرحلة: ${copy.stage}. المتابعة المتوقعة: ${appointmentWindow}.
أجيبي بالعربية الفصحى اللطيفة، وبأسلوب مطمئن وعملي.
أنتِ لا تقدمين تشخيصاً ولا تغنين عن الطبيبة. اذكري ذلك باختصار عند الأسئلة الطبية.
عند أي علامة خطر مثل نزيف، ألم شديد، نقص واضح في حركة الجنين، صداع شديد أو زغللة، تورم مفاجئ، ألم صدر، ضيق نفس شديد، حرارة عالية، أو أفكار إيذاء النفس: وجهيها للتواصل الفوري مع الرعاية الطبية أو الطوارئ.
إذا سألت عن الصلاة أو الصيام أو النفاس: قدمي إرشاداً عاماً يحترم اختلاف المذاهب، واذكري سؤال أهل العلم الموثوقين عند التفصيل.
اجعلي الرد منظماً: 1) ماذا يعني غالباً 2) ماذا تفعل الآن 3) متى تراجع الطبيبة/الطوارئ. لا تتجاوزي 220 كلمة.`
      : `You are "Niswah Pregnancy Doctor", a pregnancy assistant for Muslim women.
Context: the user is pregnant at week ${week}. Stage: ${copy.stage}. Expected visit rhythm: ${appointmentWindow}.
Answer warmly and practically.
You do not diagnose and do not replace a clinician. Say this briefly for medical questions.
For danger signs such as bleeding, severe pain, clearly reduced fetal movement, severe headache or vision changes, sudden swelling, chest pain, severe shortness of breath, high fever, or self-harm thoughts: advise immediate medical care/emergency care.
For prayer, fasting, or nifas questions: provide general Muslim-sensitive guidance, respect scholarly differences, and encourage asking trusted scholars for detailed rulings.
Structure answers: 1) what it may mean 2) what to do now 3) when to contact clinician/emergency care. Keep under 220 words.`;

    try {
      const response = await callGemini({
        systemInstruction,
        contents: history.map(message => ({
          role: message.role === 'ai' ? 'model' as const : 'user' as const,
          parts: [{ text: message.text }],
        })),
        temperature: 0.45,
        maxOutputTokens: 1600,
      });

      const aiMessage: PregnancyDoctorMessage = {
        role: 'ai',
        text: response || (isRTL ? 'تعذر توليد رد واضح. أعيدي صياغة السؤال من فضلك.' : 'I could not generate a clear response. Please rephrase your question.'),
        timestamp: new Date().toISOString(),
      };
      persistNotes({ ...notes, doctorMessages: [...history, aiMessage].slice(-12) });
    } catch (error: any) {
      setDoctorError(error?.message || (isRTL ? 'تعذر الاتصال بالطبيبة الآن.' : 'Could not reach the doctor right now.'));
    } finally {
      setIsDoctorTyping(false);
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-xl shadow-emerald-950/5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-rose-400 via-amber-300 to-emerald-500" />
        <div className="grid gap-6 p-5 md:grid-cols-[1.08fr_0.92fr] md:p-7">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600/70">
                  {isRTL ? 'رفيقة الحمل' : 'Pregnancy Companion'}
                </p>
                <h2 className="mt-1 text-4xl font-serif font-bold leading-tight text-emerald-950 md:text-5xl">
                  {t('week')} {week}
                </h2>
                <p className="mt-1 text-sm font-bold text-rose-700">
                  {copy.stage} · {copy.size}
                </p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-gray-600">
                  {isRTL
                    ? 'ملخص شخصي يجمع نمو الجنين، تغيرات جسمك، وما تحتاجينه للعبادة والاستعداد.'
                    : 'A personal summary for baby growth, body changes, worship needs, and preparation.'}
                </p>
              </div>
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-700">
                <Baby className="h-8 w-8" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                <span>{isRTL ? `الثلث ${trimester}` : `Trimester ${trimester}`}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-emerald-50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full rounded-full bg-gradient-to-l from-rose-500 via-amber-400 to-emerald-500"
                />
              </div>
              <div className="grid gap-2 pt-1 sm:grid-cols-3">
                <StatusChip label={isRTL ? 'نطاق الثلث' : 'Trimester range'} value={copy.trimesterRange} />
                <StatusChip label={isRTL ? 'المحطة' : 'Milestone'} value={copy.nextMilestone} />
                <StatusChip label={isRTL ? 'الحفظ' : 'Saved'} value={isSyncing ? (isRTL ? 'جارٍ الحفظ' : 'Syncing') : (isRTL ? 'محفوظ' : 'Saved')} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <GuidanceCard icon={Baby} title={isRTL ? 'نمو الجنين' : 'Baby'} text={copy.baby} tone="emerald" />
              <GuidanceCard icon={Heart} title={isRTL ? 'تغيراتك' : 'You'} text={copy.mother} tone="rose" />
              <GuidanceCard icon={Moon} title={isRTL ? 'العبادة' : 'Worship'} text={copy.worship} tone="indigo" />
              <GuidanceCard icon={Utensils} title={isRTL ? 'التغذية' : 'Nutrition'} text={copy.nutrition} tone="amber" />
            </div>
          </div>

          <div className="grid gap-3">
            <Metric icon={CalendarDays} label={isRTL ? 'حتى الموعد' : 'Until due'} value={copy.daysRemaining} tone="emerald" />
            <Metric icon={Heart} label={isRTL ? 'المتبقي' : 'Remaining'} value={copy.weeksToBirth} tone="rose" />
            <Metric icon={ShieldCheck} label={isRTL ? 'الصلاة' : 'Prayer'} value={copy.prayerMetric} tone="indigo" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[0.75fr_1.25fr]">
        <article className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-lg shadow-emerald-950/5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">{isRTL ? 'متابعة يومية' : 'Daily check-in'}</p>
              <h3 className="mt-1 text-xl font-serif font-bold text-emerald-950">{isRTL ? 'حركة الجنين' : 'Baby movement'}</h3>
            </div>
            <Activity className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="rounded-3xl bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-900">{week < 20 ? (isRTL ? 'الحركة قد لا تكون واضحة بعد' : 'Movement may not be clear yet') : (isRTL ? `${todayMovementCount} حركة مسجلة اليوم` : `${todayMovementCount} movements logged today`)}</p>
            <p className="mt-2 text-xs leading-6 text-emerald-800/75">
              {week < 20
                ? (isRTL ? 'غالباً تصبح الحركة أوضح في الثلث الثاني. سنفعّل المتابعة عندما تكون مفيدة.' : 'Movement often becomes clearer in the second trimester; tracking becomes useful later.')
                : (isRTL ? `آخر تسجيل: ${movementLabel}. راقبي النمط المعتاد، واتصلي بالطبيبة عند نقص واضح.` : `Last log: ${movementLabel}. Notice the usual pattern and call your clinician if movement clearly drops.`)}
            </p>
          </div>
          <button
            onClick={logMovement}
            disabled={week < 20}
            className="mt-4 w-full rounded-2xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          >
            {isRTL ? 'سجلت حركة الآن' : 'Log movement now'}
          </button>
        </article>

        <article className="rounded-[28px] border border-rose-100 bg-white p-5 shadow-xl shadow-rose-950/5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-500">{isRTL ? 'طبيبة الحمل الذكية' : 'AI pregnancy doctor'}</p>
              <h3 className="mt-1 text-xl font-serif font-bold text-rose-950">{isRTL ? 'اسألي عن أي شيء يخص حملك' : 'Ask anything about your pregnancy'}</h3>
              <p className="mt-2 text-xs leading-6 text-gray-500">
                {isRTL
                  ? 'تجيب عن الأعراض، الحركة، التغذية، القلق، الصلاة، الصيام، والاستعداد للولادة. ليست بديلاً عن الطبيبة.'
                  : 'Answers symptoms, movement, nutrition, anxiety, prayer, fasting, and birth prep. Not a replacement for your clinician.'}
              </p>
            </div>
            <MessageCircle className="h-7 w-7 text-rose-600" />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => askPregnancyDoctor(prompt)}
                className="rounded-full border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 transition active:scale-[0.98]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-3xl bg-gray-50 p-3">
            {doctorMessages.map((message, index) => (
              <div
                key={`${message.timestamp}-${index}`}
                className={cn(
                  'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm',
                  message.role === 'user'
                    ? 'ms-auto bg-rose-600 text-white'
                    : 'me-auto bg-white text-gray-700'
                )}
              >
                {message.text}
              </div>
            ))}
            {isDoctorTyping && (
              <div className="me-auto rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-500 shadow-sm">
                {isRTL ? 'تكتب الرد...' : 'Writing...'}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {doctorError && (
            <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
              {doctorError}
            </div>
          )}

          <form
            className="mt-4 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              askPregnancyDoctor(doctorInput);
            }}
          >
            <input
              value={doctorInput}
              onChange={(event) => setDoctorInput(event.target.value)}
              placeholder={isRTL ? 'اكتبي سؤالك هنا...' : 'Write your question...'}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!doctorInput.trim() || isDoctorTyping}
              className="grid h-10 w-10 place-items-center rounded-xl bg-rose-600 text-white transition active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
              aria-label={isRTL ? 'إرسال' : 'Send'}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-3 text-[11px] leading-5 text-gray-400">
            {isRTL
              ? 'للنزيف، الألم الشديد، نقص حركة الجنين، صداع شديد مع زغللة، ألم صدر أو ضيق نفس شديد: تواصلي مع الرعاية الطبية فوراً.'
              : 'For bleeding, severe pain, reduced baby movement, severe headache with vision changes, chest pain, or severe shortness of breath: contact medical care now.'}
          </p>
        </article>
      </section>

      <button
        onClick={onLogBirth}
        className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-emerald-700 py-5 text-base font-bold text-white shadow-xl shadow-emerald-200 transition active:scale-[0.99]"
      >
        <Sparkles className="h-5 w-5" />
        <span>{t('log_birth_nifas')}</span>
      </button>
    </div>
  );
};

const toneClasses = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  amber: 'bg-amber-50 text-amber-900 border-amber-100',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-100',
  rose: 'bg-rose-50 text-rose-800 border-rose-100',
};

const Metric = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: keyof typeof toneClasses }) => (
  <div className={cn('rounded-2xl border p-4', toneClasses[tone])}>
    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-70">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
    <p className="text-lg font-serif font-bold leading-tight">{value}</p>
  </div>
);

const StatusChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
    <p className="mt-1 text-xs font-bold leading-5 text-gray-800">{value}</p>
  </div>
);

const GuidanceCard = ({ icon: Icon, title, text, tone }: { icon: any; title: string; text: string; tone: keyof typeof toneClasses }) => (
  <article className={cn('rounded-2xl border p-4', toneClasses[tone])}>
    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-70">
      <Icon className="h-4 w-4" />
      <span>{title}</span>
    </div>
    <p className="text-xs leading-6 opacity-85">{text}</p>
  </article>
);
