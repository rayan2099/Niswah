/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Baby,
  CalendarDays,
  CheckCircle2,
  Heart,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Utensils,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import * as api from '../api/index.ts';
import { useTranslation } from '../i18n/LanguageContext.tsx';

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
  symptoms: string[];
  mood: 'calm' | 'tired' | 'anxious' | 'low' | null;
  lastMoodAt: string | null;
  prepDone: string[];
};

type SymptomLevel = 'green' | 'yellow' | 'red';

const defaultNotes: PregnancyDashboardNotes = {
  movementLogs: [],
  symptoms: [],
  mood: null,
  lastMoodAt: null,
  prepDone: [],
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

const SYMPTOMS: { id: string; level: SymptomLevel; ar: string; en: string }[] = [
  { id: 'nausea', level: 'green', ar: 'غثيان خفيف', en: 'Mild nausea' },
  { id: 'heartburn', level: 'green', ar: 'حموضة', en: 'Heartburn' },
  { id: 'backache', level: 'green', ar: 'ألم ظهر خفيف', en: 'Mild backache' },
  { id: 'fatigue', level: 'green', ar: 'تعب', en: 'Fatigue' },
  { id: 'swelling', level: 'yellow', ar: 'تورم واضح', en: 'Noticeable swelling' },
  { id: 'vomiting', level: 'yellow', ar: 'قيء مستمر', en: 'Persistent vomiting' },
  { id: 'contractions', level: 'yellow', ar: 'انقباضات متكررة', en: 'Repeated contractions' },
  { id: 'reduced_movement', level: 'red', ar: 'نقص حركة الجنين', en: 'Reduced baby movement' },
  { id: 'bleeding', level: 'red', ar: 'نزيف', en: 'Bleeding' },
  { id: 'severe_headache', level: 'red', ar: 'صداع شديد أو زغللة', en: 'Severe headache or vision changes' },
  { id: 'chest_pain', level: 'red', ar: 'ألم صدر أو ضيق نفس شديد', en: 'Chest pain or severe shortness of breath' },
  { id: 'severe_pain', level: 'red', ar: 'ألم بطن شديد', en: 'Severe abdominal pain' },
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

  const selectedSymptoms = SYMPTOMS.filter(symptom => notes.symptoms.includes(symptom.id));
  const symptomLevel: SymptomLevel = selectedSymptoms.some(s => s.level === 'red')
    ? 'red'
    : selectedSymptoms.some(s => s.level === 'yellow')
      ? 'yellow'
      : 'green';

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

  const toggleSymptom = (id: string) => {
    persistNotes({
      ...notes,
      symptoms: notes.symptoms.includes(id) ? notes.symptoms.filter(item => item !== id) : [...notes.symptoms, id],
    });
  };

  const setMood = (mood: PregnancyDashboardNotes['mood']) => {
    persistNotes({ ...notes, mood, lastMoodAt: new Date().toISOString() });
  };

  const togglePrep = (id: string) => {
    persistNotes({
      ...notes,
      prepDone: notes.prepDone.includes(id) ? notes.prepDone.filter(item => item !== id) : [...notes.prepDone, id],
    });
  };

  const appointmentWindow = week < 28
    ? (isRTL ? 'زيارة كل 4 أسابيع تقريباً' : 'About every 4 weeks')
    : week < 36
      ? (isRTL ? 'زيارة كل أسبوعين تقريباً' : 'About every 2 weeks')
      : (isRTL ? 'متابعة أسبوعية غالباً' : 'Often weekly check-ins');

  const prepItems = [
    {
      id: 'provider',
      label: isRTL ? 'أسأل الطبيبة عن الحركة، النزيف، الألم، والأدوية' : 'Ask about movement, bleeding, pain, and medicine',
    },
    {
      id: 'worship',
      label: isRTL ? 'أجهز سؤال الصلاة والصيام عند المشقة' : 'Prepare prayer and fasting questions',
    },
    {
      id: 'hospital',
      label: week >= 32 ? (isRTL ? 'أراجع حقيبة الولادة وخطة المرافق' : 'Review hospital bag and support person') : (isRTL ? 'أحفظ قائمة تجهيزات الولادة لاحقاً' : 'Save the birth prep list for later'),
    },
    {
      id: 'nifas',
      label: isRTL ? 'أعرف متى أبدأ تسجيل النفاس بعد الولادة' : 'Know when to start nifas tracking after birth',
    },
  ];

  const moodOptions = [
    { id: 'calm', ar: 'مطمئنة', en: 'Calm' },
    { id: 'tired', ar: 'مرهقة', en: 'Tired' },
    { id: 'anxious', ar: 'قلقة', en: 'Anxious' },
    { id: 'low', ar: 'حزينة', en: 'Low' },
  ] as const;

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

      <section className="grid gap-3 md:grid-cols-[1fr_1fr]">
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

        <article className="rounded-[28px] border border-rose-100 bg-white p-5 shadow-lg shadow-rose-950/5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-500">{isRTL ? 'أمان الحمل' : 'Pregnancy safety'}</p>
              <h3 className="mt-1 text-xl font-serif font-bold text-rose-950">{isRTL ? 'فحص الأعراض' : 'Symptom check'}</h3>
            </div>
            <ShieldAlert className="h-6 w-6 text-rose-600" />
          </div>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map((symptom) => {
              const selected = notes.symptoms.includes(symptom.id);
              return (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id)}
                  className={cn(
                    'rounded-full border px-3 py-2 text-xs font-bold transition',
                    selected ? symptomTone[symptom.level].selected : 'border-gray-100 bg-gray-50 text-gray-500'
                  )}
                >
                  {isRTL ? symptom.ar : symptom.en}
                </button>
              );
            })}
          </div>
          <div className={cn('mt-4 rounded-3xl border p-4', symptomTone[symptomLevel].panel)}>
            <p className="text-sm font-bold">{triageCopy[symptomLevel][isRTL ? 'arTitle' : 'enTitle']}</p>
            <p className="mt-2 text-xs leading-6">{triageCopy[symptomLevel][isRTL ? 'arText' : 'enText']}</p>
            <p className="mt-3 text-[11px] leading-5 opacity-70">
              {isRTL ? 'هذا الفحص لا يغني عن التقييم الطبي.' : 'This check does not replace medical evaluation.'}
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[28px] border border-indigo-100 bg-white p-5 shadow-lg shadow-indigo-950/5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">{isRTL ? 'الدعم النفسي' : 'Emotional support'}</p>
              <h3 className="mt-1 text-xl font-serif font-bold text-indigo-950">{isRTL ? 'كيف حالك اليوم؟' : 'How are you today?'}</h3>
            </div>
            <Heart className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {moodOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setMood(option.id)}
                className={cn(
                  'rounded-2xl border px-3 py-4 text-sm font-bold transition',
                  notes.mood === option.id ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-gray-100 bg-gray-50 text-gray-500'
                )}
              >
                {isRTL ? option.ar : option.en}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-3xl bg-indigo-50 p-4 text-xs leading-6 text-indigo-900/80">
            {notes.mood === 'anxious' || notes.mood === 'low'
              ? (isRTL ? 'خذي نفساً هادئاً، أخبري شخصاً تثقين به، واطلبي دعماً طبياً إذا استمر الضيق أو زاد.' : 'Take a slow breath, tell someone you trust, and seek medical support if distress persists or increases.')
              : (isRTL ? 'المشاعر تتغير في الحمل. تسجيلها يساعدك تلاحظين النمط وتطلبين الدعم مبكراً.' : 'Feelings shift in pregnancy. Logging them helps you notice patterns and ask for support early.')}
          </div>
        </article>

        <article className="rounded-[28px] border border-amber-100 bg-white p-5 shadow-lg shadow-amber-950/5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">{isRTL ? 'الزيارة والاستعداد' : 'Visit and preparation'}</p>
              <h3 className="mt-1 text-xl font-serif font-bold text-amber-950">{appointmentWindow}</h3>
            </div>
            <Stethoscope className="h-6 w-6 text-amber-700" />
          </div>
          <div className="grid gap-2">
            {prepItems.map((item) => (
              <button
                key={item.id}
                onClick={() => togglePrep(item.id)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start text-sm font-bold leading-6 transition',
                  notes.prepDone.includes(item.id) ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-100 bg-gray-50 text-gray-600'
                )}
              >
                <span>{item.label}</span>
                <span className={cn(
                  'grid h-6 w-6 flex-none place-items-center rounded-full border text-[11px]',
                  notes.prepDone.includes(item.id) ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 text-transparent'
                )}>
                  ✓
                </span>
              </button>
            ))}
          </div>
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

const symptomTone = {
  green: {
    selected: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    panel: 'border-emerald-100 bg-emerald-50 text-emerald-900',
  },
  yellow: {
    selected: 'border-amber-200 bg-amber-50 text-amber-900',
    panel: 'border-amber-100 bg-amber-50 text-amber-950',
  },
  red: {
    selected: 'border-rose-200 bg-rose-50 text-rose-900',
    panel: 'border-rose-100 bg-rose-50 text-rose-950',
  },
};

const triageCopy = {
  green: {
    arTitle: 'أعراض شائعة غالباً',
    enTitle: 'Often common symptoms',
    arText: 'راقبيها وسجلي نمطها. إذا أصبحت شديدة أو مختلفة عن المعتاد، تواصلي مع الطبيبة.',
    enText: 'Watch and log the pattern. If they become severe or unusual for you, contact your clinician.',
  },
  yellow: {
    arTitle: 'يحتاج متابعة قريبة',
    enTitle: 'Needs closer watching',
    arText: 'خففي النشاط، اشربي ماء، واطلبي نصيحة طبية إذا استمر العرض أو تكرر.',
    enText: 'Ease activity, hydrate, and seek medical advice if the symptom persists or repeats.',
  },
  red: {
    arTitle: 'تواصلي مع الرعاية الطبية الآن',
    enTitle: 'Contact medical care now',
    arText: 'هذه علامات لا تنتظر. اتصلي بالطبيبة أو الطوارئ حسب شدة العرض وتوجيهات بلدك.',
    enText: 'These signs should not wait. Contact your clinician or emergency care depending on severity and local guidance.',
  },
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
