/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Moon,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Utensils,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useTranslation } from '../i18n/LanguageContext.tsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PregnancyTrackerProps {
  currentWeek: number;
  onLogBirth: () => void;
  onWeekChange?: (week: number) => void | Promise<void>;
}

type WeekGuide = {
  week: number;
  stageAr: string;
  stageEn: string;
  sizeAr: string;
  sizeEn: string;
  medicalAr: string;
  medicalEn: string;
  nutritionAr: string;
  nutritionEn: string;
  prayerAr: string;
  prayerEn: string;
  dua: string;
  checklistAr: string[];
  checklistEn: string[];
};

const GUIDES: WeekGuide[] = [
  {
    week: 4,
    stageAr: 'مرحلة النطفة',
    stageEn: 'Nutfah stage',
    sizeAr: 'بحجم بذرة صغيرة',
    sizeEn: 'Tiny seed size',
    medicalAr: 'تثبيت الحمل يبدأ. راقبي النزيف أو الألم الشديد وراجعي الطبيبة عند القلق.',
    medicalEn: 'Implantation begins. Watch for heavy bleeding or severe pain and seek care if worried.',
    nutritionAr: 'ركزي على حمض الفوليك: السبانخ، العدس، الحمضيات، والحبوب المدعمة.',
    nutritionEn: 'Prioritize folate: spinach, lentils, citrus, and fortified grains.',
    prayerAr: 'الصلاة المعتادة مناسبة، وخذي الراحة عند الغثيان أو الدوخة.',
    prayerEn: 'Standard prayer is fine; rest if nausea or dizziness appears.',
    dua: 'Rabbi hab li min ladunka dhurriyyatan tayyibatan',
    checklistAr: ['تأكيد موعد أول زيارة', 'بدء فيتامين الحمل', 'تسجيل أي أعراض غير معتادة'],
    checklistEn: ['Schedule first visit', 'Start prenatal vitamin', 'Log unusual symptoms'],
  },
  {
    week: 12,
    stageAr: 'مرحلة العلقة',
    stageEn: 'Alaqah stage',
    sizeAr: 'بحجم ليمونة',
    sizeEn: 'Lime size',
    medicalAr: 'تتشكل الأعضاء الأساسية وتبدأ المؤشرات الحيوية بالاستقرار غالباً.',
    medicalEn: 'Major organs are forming and early pregnancy often starts to stabilize.',
    nutritionAr: 'ادعمي الكالسيوم والبروتين: الزبادي، البيض، البقول، والمكسرات.',
    nutritionEn: 'Support calcium and protein: yogurt, eggs, legumes, and nuts.',
    prayerAr: 'إن زاد التعب، يجوز أداء الصلاة بالهيئة الأرفق حسب الحاجة.',
    prayerEn: 'If fatigue increases, pray in the position that is easiest as needed.',
    dua: "Rabbi ij'alni muqima as-salati wa min dhurriyyati",
    checklistAr: ['مراجعة نتائج التحاليل', 'تجهيز أسئلة الزيارة', 'متابعة الماء والنوم'],
    checklistEn: ['Review lab results', 'Prepare visit questions', 'Track water and sleep'],
  },
  {
    week: 20,
    stageAr: 'منتصف الحمل',
    stageEn: 'Mid-pregnancy',
    sizeAr: 'بحجم موزة',
    sizeEn: 'Banana size',
    medicalAr: 'قد تشعرين بالحركة بوضوح. هذا وقت مهم لمتابعة النمو والسونار.',
    medicalEn: 'Movement may be clearer. This is an important growth and scan window.',
    nutritionAr: 'الحديد مهم الآن: اللحوم الخفيفة، الفاصوليا، التمر، والمشمش المجفف.',
    nutritionEn: 'Iron matters now: lean meats, beans, dates, and dried apricots.',
    prayerAr: 'اختاري وضعية ثابتة ومريحة إذا تأثر التوازن أو الظهر.',
    prayerEn: 'Choose a stable, comfortable posture if balance or back pain is affected.',
    dua: 'Allahumma barik lana fi ma razaqtana',
    checklistAr: ['متابعة حركة الجنين', 'مراجعة الحديد', 'تخفيف الوقوف الطويل'],
    checklistEn: ['Notice movement', 'Check iron intake', 'Reduce long standing'],
  },
  {
    week: 32,
    stageAr: 'مرحلة الاستعداد',
    stageEn: 'Preparation stage',
    sizeAr: 'نمو سريع ووزن أكبر',
    sizeEn: 'Rapid growth',
    medicalAr: 'يزداد الضغط على الظهر والتنفس. راقبي التورم المفاجئ أو الصداع الشديد.',
    medicalEn: 'Back and breathing pressure can rise. Watch sudden swelling or severe headache.',
    nutritionAr: 'وجبات أصغر ومتكررة قد تساعد مع الحموضة وثقل المعدة.',
    nutritionEn: 'Smaller frequent meals may help with reflux and heaviness.',
    prayerAr: 'الصلاة جلوساً خيار رحيم عند المشقة أو ثقل الحركة.',
    prayerEn: 'Sitting prayer is a merciful option when movement is difficult.',
    dua: 'Rabbi yassir wa la tu’assir',
    checklistAr: ['تجهيز حقيبة الولادة', 'مراجعة خطة المستشفى', 'الراحة بين الأعمال'],
    checklistEn: ['Prepare hospital bag', 'Review birth plan', 'Rest between tasks'],
  },
  {
    week: 40,
    stageAr: 'موعد الولادة',
    stageEn: 'Due window',
    sizeAr: 'اكتمل النمو غالباً',
    sizeEn: 'Likely full term',
    medicalAr: 'الجنين جاهز غالباً. تابعي علامات المخاض وحركة الجنين حسب إرشادات الطبيبة.',
    medicalEn: 'Baby is likely ready. Track labor signs and movement as advised by your clinician.',
    nutritionAr: 'التمر والسوائل والوجبات الخفيفة تساعد على الطاقة إن كانت مناسبة لك.',
    nutritionEn: 'Dates, fluids, and light meals can support energy if suitable for you.',
    prayerAr: 'اختاري الوضعية الأيسر، ومع الولادة يبدأ النفاس بعد نزول الدم.',
    prayerEn: 'Use the easiest posture; nifas begins after postpartum bleeding starts.',
    dua: "Rabbi yassir wa la tu'assir",
    checklistAr: ['الاتصال عند علامات المخاض', 'متابعة حركة الجنين', 'تجهيز بداية النفاس'],
    checklistEn: ['Call for labor signs', 'Track movement', 'Prepare for nifas'],
  },
];

const getGuide = (week: number) => {
  return [...GUIDES].reverse().find(item => week >= item.week) || GUIDES[0];
};

const clampWeek = (week: number) => Math.min(40, Math.max(1, week || 1));

export const PregnancyTracker = ({ currentWeek, onLogBirth, onWeekChange }: PregnancyTrackerProps) => {
  const { t, language } = useTranslation();
  const isRTL = language === 'ar';
  const [selectedWeek, setSelectedWeek] = useState(clampWeek(currentWeek));
  const [savingWeek, setSavingWeek] = useState(false);

  useEffect(() => {
    setSelectedWeek(clampWeek(currentWeek));
  }, [currentWeek]);

  const guide = useMemo(() => getGuide(selectedWeek), [selectedWeek]);
  const trimester = Math.min(3, Math.max(1, Math.ceil(selectedWeek / 13)));
  const daysRemaining = Math.max(0, (40 - selectedWeek) * 7);
  const progress = Math.round((selectedWeek / 40) * 100);
  const weeksToBirth = Math.max(0, 40 - selectedWeek);

  const copy = {
    stage: isRTL ? guide.stageAr : guide.stageEn,
    size: isRTL ? guide.sizeAr : guide.sizeEn,
    medical: isRTL ? guide.medicalAr : guide.medicalEn,
    nutrition: isRTL ? guide.nutritionAr : guide.nutritionEn,
    prayer: isRTL ? guide.prayerAr : guide.prayerEn,
    checklist: isRTL ? guide.checklistAr : guide.checklistEn,
    daysRemaining: isRTL ? `${daysRemaining} يوم تقريباً` : `About ${daysRemaining} days`,
    weeksToBirth: isRTL ? `${weeksToBirth} أسبوع متبقٍ` : `${weeksToBirth} weeks left`,
    saved: isRTL ? 'تم حفظ الأسبوع' : 'Week saved',
  };

  const updateWeek = async (nextWeek: number) => {
    const week = clampWeek(nextWeek);
    setSelectedWeek(week);
    if (!onWeekChange) return;
    setSavingWeek(true);
    try {
      await onWeekChange(week);
    } finally {
      setSavingWeek(false);
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-xl shadow-emerald-950/5">
        <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_0.9fr] md:p-7">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600/70">
                  {isRTL ? 'رحلة الحمل' : 'Pregnancy Journey'}
                </p>
                <h2 className="mt-1 text-4xl font-serif font-bold leading-tight text-emerald-950 md:text-5xl">
                  {t('week')} {selectedWeek}
                </h2>
                <p className="mt-1 text-sm font-bold text-rose-700">
                  {copy.stage} · {copy.size}
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
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                {[13, 27, 40].map((week) => (
                  <button
                    key={week}
                    onClick={() => updateWeek(week)}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-[11px] font-bold transition',
                      selectedWeek >= week
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-gray-100 bg-white text-gray-400'
                    )}
                  >
                    {isRTL ? `أسبوع ${week}` : `Week ${week}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            <Metric icon={CalendarDays} label={isRTL ? 'حتى الموعد' : 'Until due'} value={copy.daysRemaining} tone="emerald" />
            <Metric icon={Heart} label={isRTL ? 'المتبقي' : 'Remaining'} value={copy.weeksToBirth} tone="rose" />
            <Metric icon={ShieldCheck} label={isRTL ? 'حالة الصلاة' : 'Prayer note'} value={isRTL ? 'حسب القدرة' : 'As able'} tone="indigo" />
          </div>
        </div>
      </section>

      <section className="flex items-center justify-between gap-3">
        <button
          onClick={() => updateWeek(selectedWeek + (isRTL ? 1 : -1))}
          className="grid h-12 w-12 place-items-center rounded-full border border-black/5 bg-white shadow-sm transition active:scale-95"
          aria-label={isRTL ? 'الأسبوع السابق' : 'Previous week'}
        >
          {isRTL ? <ChevronRight className="h-5 w-5 text-emerald-900" /> : <ChevronLeft className="h-5 w-5 text-emerald-900" />}
        </button>
        <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden rounded-full border border-emerald-100 bg-white px-3 py-2 shadow-sm">
          {[...Array(9)].map((_, index) => {
            const week = Math.min(40, Math.max(1, selectedWeek - 4 + index));
            return (
              <button
                key={`${week}-${index}`}
                onClick={() => updateWeek(week)}
                className={cn(
                  'h-8 min-w-8 rounded-full text-xs font-bold transition',
                  week === selectedWeek ? 'bg-emerald-700 text-white shadow-md shadow-emerald-200' : 'text-gray-400 hover:bg-emerald-50'
                )}
              >
                {week}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => updateWeek(selectedWeek + (isRTL ? -1 : 1))}
          className="grid h-12 w-12 place-items-center rounded-full border border-black/5 bg-white shadow-sm transition active:scale-95"
          aria-label={isRTL ? 'الأسبوع التالي' : 'Next week'}
        >
          {isRTL ? <ChevronLeft className="h-5 w-5 text-emerald-900" /> : <ChevronRight className="h-5 w-5 text-emerald-900" />}
        </button>
      </section>

      {savingWeek && (
        <p className="text-center text-xs font-bold text-emerald-700">{copy.saved}</p>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        <InfoCard icon={Stethoscope} title={t('medical')} text={copy.medical} tone="emerald" />
        <InfoCard icon={Utensils} title={t('nutrition')} text={copy.nutrition} tone="amber" />
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <InfoCard icon={Moon} title={t('prayer_modification')} text={copy.prayer} tone="indigo" />
        <InfoCard icon={Heart} title={t('dua_for_baby')} text={`"${guide.dua}"`} tone="rose" italic />
      </section>

      <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-lg shadow-black/5">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-900">{isRTL ? 'قائمة هذا الأسبوع' : 'This Week Checklist'}</h3>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {copy.checklist.map((item) => (
            <div key={item} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
              {item}
            </div>
          ))}
        </div>
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

const InfoCard = ({ icon: Icon, title, text, tone, italic = false }: { icon: any; title: string; text: string; tone: keyof typeof toneClasses; italic?: boolean }) => (
  <article className={cn('min-h-[132px] rounded-[24px] border p-5 shadow-sm', toneClasses[tone])}>
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-5 w-5" />
      <h3 className="text-sm font-bold">{title}</h3>
    </div>
    <p className={cn('text-sm leading-7', italic && 'italic')}>{text}</p>
  </article>
);
