/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Baby,
  CalendarDays,
  Heart,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Utensils,
  Moon,
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
    prayerAr: 'الأصل الصلاة المعتادة، ومع الغثيان أو الدوخة خذي الهيئة الأيسر بحسب الاستطاعة.',
    prayerEn: 'Standard prayer remains the default; with nausea or dizziness, use the easiest posture you can.',
  },
  {
    week: 12,
    stageAr: 'مرحلة العلقة',
    stageEn: 'Alaqah stage',
    sizeAr: 'بحجم ليمونة',
    sizeEn: 'Lime size',
    medicalAr: 'تتشكل الأعضاء الأساسية وغالباً تبدأ أعراض البداية بالاستقرار.',
    medicalEn: 'Major organs are forming and early pregnancy symptoms often begin to settle.',
    nutritionAr: 'ادعمي الكالسيوم والبروتين: الزبادي، البيض، البقول، والمكسرات.',
    nutritionEn: 'Support calcium and protein: yogurt, eggs, legumes, and nuts.',
    prayerAr: 'عند التعب الواضح، اختاري هيئة صلاة أرفق مع المحافظة على الطمأنينة قدر القدرة.',
    prayerEn: 'When fatigue is strong, choose an easier prayer posture while keeping calmness as able.',
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
    prayerAr: 'إذا تأثر التوازن أو الظهر، اختاري وضعية ثابتة ومريحة بحسب الاستطاعة.',
    prayerEn: 'If balance or back pain is affected, choose a steady, comfortable posture as able.',
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
    prayerAr: 'عند المشقة، الصلاة جلوساً أو بالهيئة الأيسر تكون بحسب القدرة والحاجة.',
    prayerEn: 'When hardship exists, sitting or easier prayer postures are based on ability and need.',
  },
  {
    week: 40,
    stageAr: 'موعد الولادة',
    stageEn: 'Due window',
    sizeAr: 'اكتمل النمو غالباً',
    sizeEn: 'Likely full term',
    medicalAr: 'تابعي علامات المخاض وحركة الجنين حسب إرشادات الطبيبة.',
    medicalEn: 'Track labor signs and baby movement as advised by your clinician.',
    nutritionAr: 'التمر والسوائل والوجبات الخفيفة تساعد على الطاقة إن كانت مناسبة لك.',
    nutritionEn: 'Dates, fluids, and light meals can support energy if suitable for you.',
    prayerAr: 'اختاري الوضعية الأيسر، ومع الولادة يبدأ النفاس بعد نزول الدم.',
    prayerEn: 'Use the easiest posture; nifas begins after postpartum bleeding starts.',
  },
];

const clampWeek = (week: number) => Math.min(40, Math.max(1, Math.round(week || 1)));
const getGuide = (week: number) => [...GUIDES].reverse().find(item => week >= item.week) || GUIDES[0];

export const PregnancyTracker = ({ currentWeek, onLogBirth }: PregnancyTrackerProps) => {
  const { t, language } = useTranslation();
  const isRTL = language === 'ar';
  const week = clampWeek(currentWeek);
  const guide = useMemo(() => getGuide(week), [week]);
  const trimester = Math.min(3, Math.max(1, Math.ceil(week / 13)));
  const trimesterRange = trimester === 1 ? '1-13' : trimester === 2 ? '14-27' : '28-40';
  const daysRemaining = Math.max(0, (40 - week) * 7);
  const progress = Math.round((week / 40) * 100);
  const weeksToBirth = Math.max(0, 40 - week);
  const nextMilestone = GUIDES.find(item => item.week > week);

  const copy = {
    stage: isRTL ? guide.stageAr : guide.stageEn,
    size: isRTL ? guide.sizeAr : guide.sizeEn,
    medical: isRTL ? guide.medicalAr : guide.medicalEn,
    nutrition: isRTL ? guide.nutritionAr : guide.nutritionEn,
    prayer: isRTL ? guide.prayerAr : guide.prayerEn,
    daysRemaining: isRTL ? `${daysRemaining} يوم تقريباً` : `About ${daysRemaining} days`,
    weeksToBirth: isRTL ? `${weeksToBirth} أسبوع متبقٍ` : `${weeksToBirth} weeks left`,
    trimesterRange: isRTL ? `أسابيع ${trimesterRange}` : `Weeks ${trimesterRange}`,
    nextMilestone: nextMilestone
      ? (isRTL ? `المحطة القادمة: أسبوع ${nextMilestone.week}` : `Next milestone: week ${nextMilestone.week}`)
      : (isRTL ? 'أنتِ في نافذة الولادة' : 'You are in the due window'),
    prayerMetric: isRTL ? 'حسب الاستطاعة عند المشقة' : 'As able when hardship exists',
  };

  const insights = [
    {
      icon: Stethoscope,
      label: isRTL ? 'صحة' : 'Health',
      text: copy.medical,
      tone: 'emerald' as const,
    },
    {
      icon: Utensils,
      label: isRTL ? 'تغذية' : 'Nutrition',
      text: copy.nutrition,
      tone: 'amber' as const,
    },
    {
      icon: Moon,
      label: isRTL ? 'الصلاة' : 'Prayer',
      text: copy.prayer,
      tone: 'indigo' as const,
    },
  ];

  return (
    <div className="w-full max-w-5xl space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-xl shadow-emerald-950/5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-rose-400 via-amber-300 to-emerald-500" />
        <div className="grid gap-6 p-5 md:grid-cols-[1.05fr_0.95fr] md:p-7">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600/70">
                  {isRTL ? 'رحلة الحمل' : 'Pregnancy Journey'}
                </p>
                <h2 className="mt-1 text-4xl font-serif font-bold leading-tight text-emerald-950 md:text-5xl">
                  {t('week')} {week}
                </h2>
                <p className="mt-1 text-sm font-bold text-rose-700">
                  {copy.stage} · {copy.size}
                </p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-gray-600">
                  {isRTL
                    ? 'يتم حساب الأسبوع تلقائياً من تاريخ بداية الحمل الذي اخترته في الإعداد.'
                    : 'Your week updates automatically from the pregnancy start date saved in setup.'}
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
                <StatusChip label={isRTL ? 'التتبع' : 'Tracking'} value={isRTL ? 'تلقائي من يوم التفعيل' : 'Automatic from setup'} />
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <Metric icon={CalendarDays} label={isRTL ? 'حتى الموعد' : 'Until due'} value={copy.daysRemaining} tone="emerald" />
            <Metric icon={Heart} label={isRTL ? 'المتبقي' : 'Remaining'} value={copy.weeksToBirth} tone="rose" />
            <Metric icon={ShieldCheck} label={isRTL ? 'الصلاة' : 'Prayer'} value={copy.prayerMetric} tone="indigo" />
          </div>
        </div>

        <div className="border-t border-emerald-50 bg-gradient-to-b from-emerald-50/40 to-white p-5 md:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-emerald-950">{isRTL ? 'مهم هذا الأسبوع' : 'This Week Matters'}</h3>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-emerald-700 shadow-sm">
              {isRTL ? 'مختصر وعملي' : 'Short and practical'}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {insights.map((item) => (
              <Insight key={item.label} {...item} />
            ))}
          </div>
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

const StatusChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
    <p className="mt-1 text-xs font-bold leading-5 text-gray-800">{value}</p>
  </div>
);

const Insight = ({ icon: Icon, label, text, tone }: { icon: any; label: string; text: string; tone: keyof typeof toneClasses }) => (
  <article className={cn('rounded-2xl border p-4 shadow-sm', toneClasses[tone])}>
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4" />
      <h4 className="text-xs font-bold">{label}</h4>
    </div>
    <p className="text-xs leading-6">{text}</p>
  </article>
);
