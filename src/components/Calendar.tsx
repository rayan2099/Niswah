/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Droplets,
  Sparkles,
  Heart,
  Info
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO,
  addDays,
  differenceInDays
} from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, ReferenceLine, ReferenceArea } from 'recharts';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useCycleData } from '../contexts/CycleContext.tsx';
import * as api from '../api/index.ts';
import { DBCycleEntry } from '../api/db-types.ts';
import { State, STATE_COLORS, User } from '../logic/types.ts';
import { cn } from '../utils/cn.ts';

import * as logic from '../logic/index.ts';

import { toHijri } from 'hijri-converter';

const hijriMonthNames = [
  "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
  "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

const hijriMonthNamesAr = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

export const Calendar = () => {
  const { t, isRTL } = useTranslation();
  const { user, entries, cycleStats, prediction, ovulation, loading: dataLoading } = useCycleData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarType, setCalendarType] = useState<'gregorian' | 'hijri'>('gregorian');

  const cycleLength = cycleStats.avgCycleLength;

  const monthEntries = useMemo(() => {
    if (calendarType === 'gregorian') {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      return entries.filter(e => {
        const d = parseISO(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
      });
    } else {
      const hCurrent = toHijri(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
      return entries.filter(e => {
        const d = parseISO(e.date);
        const h = toHijri(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return h.hm === hCurrent.hm && h.hy === hCurrent.hy;
      });
    }
  }, [entries, currentDate, calendarType]);

  const isHanafiPending = user?.madhhab === 'HANAFI' && user?.pendingBloodStart;

  const cycleDates = useMemo(() => {
    if (!user || !prediction || !ovulation || !cycleStats.lastPeriodDate) return null;
    
    return { 
      start: parseISO(cycleStats.lastPeriodDate), 
      ovulation: new Date(ovulation.predictedOvulationDate), 
      next: new Date(prediction.predictedStartDate),
      fertileStart: new Date(ovulation.fertileWindowStart),
      fertileEnd: new Date(ovulation.fertileWindowEnd)
    };
  }, [user, prediction, ovulation, cycleStats.lastPeriodDate]);

  const pregnancyData = useMemo(() => {
    const peakDay = Math.round(cycleLength) - 14;
    return Array.from({ length: Math.round(cycleLength) }, (_, i) => {
      const day = i + 1;
      // Normal distribution centered around peakDay
      const chance = Math.exp(-Math.pow(day - peakDay, 2) / 15) * 100;
      return { day, chance };
    });
  }, [cycleLength]);

  const { calendarDays, displayTitle, monthStart } = useMemo(() => {
    if (calendarType === 'gregorian') {
      const mStart = startOfMonth(currentDate);
      const mEnd = endOfMonth(mStart);
      const sDate = startOfWeek(mStart);
      const eDate = endOfWeek(mEnd);
      return {
        calendarDays: eachDayOfInterval({ start: sDate, end: eDate }),
        displayTitle: format(currentDate, 'MMMM yyyy'),
        monthStart: mStart
      };
    } else {
      const h = toHijri(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
      const mStart = new Date(currentDate);
      mStart.setDate(currentDate.getDate() - (h.hd - 1));
      
      const mEnd = new Date(mStart);
      mEnd.setDate(mEnd.getDate() + 28);
      let hEnd = toHijri(mEnd.getFullYear(), mEnd.getMonth() + 1, mEnd.getDate());
      while (hEnd.hm === h.hm) {
        mEnd.setDate(mEnd.getDate() + 1);
        hEnd = toHijri(mEnd.getFullYear(), mEnd.getMonth() + 1, mEnd.getDate());
      }
      mEnd.setDate(mEnd.getDate() - 1);
      
      const sDate = startOfWeek(mStart);
      const eDate = endOfWeek(mEnd);
      
      const hijriMonthName = isRTL ? hijriMonthNamesAr[h.hm - 1] : hijriMonthNames[h.hm - 1];
      
      return {
        calendarDays: eachDayOfInterval({ start: sDate, end: eDate }),
        displayTitle: `${hijriMonthName} ${h.hy}`,
        monthStart: mStart
      };
    }
  }, [currentDate, calendarType, isRTL]);

  const nextMonth = () => {
    if (calendarType === 'gregorian') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      const h = toHijri(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
      const d = new Date(currentDate);
      d.setDate(d.getDate() + (32 - h.hd));
      const h2 = toHijri(d.getFullYear(), d.getMonth() + 1, d.getDate());
      d.setDate(d.getDate() - (h2.hd - 1));
      setCurrentDate(d);
    }
  };

  const prevMonth = () => {
    if (calendarType === 'gregorian') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      const h = toHijri(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
      const d = new Date(currentDate);
      d.setDate(d.getDate() - (h.hd + 15));
      const h2 = toHijri(d.getFullYear(), d.getMonth() + 1, d.getDate());
      d.setDate(d.getDate() - (h2.hd - 1));
      setCurrentDate(d);
    }
  };

  const { fiqhState } = useCycleData();

  const getDayState = (day: Date): { state: State | null; isExpected?: boolean; isFertile?: boolean; isOvulation?: boolean } => {
    const dayString = format(day, 'yyyy-MM-dd');
    const entry = entries.find(e => e.date === dayString);
    if (entry) return { state: entry.fiqh_state as State };
    
    // Prediction logic using cycleStats
    if (user && cycleStats.lastPeriodDate) {
      const lastPeriod = parseISO(cycleStats.lastPeriodDate);
      const diff = differenceInDays(day, lastPeriod);
      const dayInCycle = diff % Math.round(cycleLength);
      
      const isTodayDay = isToday(day);
      
      // If it is today, use the official fiqhState from context
      if (isTodayDay) {
        // Also check if today is predicted fertile
        let predictedFertile = false;
        let predictedOvulation = false;
        if (ovulation) {
          const fertileStart = new Date(ovulation.fertileWindowStart);
          const fertileEnd = new Date(ovulation.fertileWindowEnd);
          const ovulationDay = new Date(ovulation.predictedOvulationDate);
          if (isSameDay(day, ovulationDay)) predictedOvulation = true;
          if (day >= fertileStart && day <= fertileEnd) predictedFertile = true;
        }
        return { 
          state: fiqhState, 
          isFertile: predictedFertile, 
          isOvulation: predictedOvulation 
        };
      }

      if (dayInCycle >= 0 && dayInCycle < Math.round(cycleStats.avgPeriodLength)) return { state: 'HAID', isExpected: true };
      
      if (ovulation) {
        const fertileStart = new Date(ovulation.fertileWindowStart);
        const fertileEnd = new Date(ovulation.fertileWindowEnd);
        const ovulationDay = new Date(ovulation.predictedOvulationDate);
        
        if (isSameDay(day, ovulationDay)) return { state: 'TAHARA', isFertile: true, isOvulation: true };
        if (day >= fertileStart && day <= fertileEnd) return { state: 'TAHARA', isFertile: true };
      }
    }
    
    return { state: null };
  };

  const monthlyStats = useMemo(() => {
    const today = new Date();
    const periodStart = startOfMonth(currentDate);
    const periodEnd = endOfMonth(currentDate);
    const monthDays = eachDayOfInterval({ start: periodStart, end: periodEnd });

    let haidDays = 0;
    let tuhrDays = 0;

    monthDays.forEach(day => {
      // Only count days up to today (inclusive) for the summary to keep it grounded in "current reality"
      // or count all if it's a past month
      if (day > today && isSameMonth(currentDate, today)) return;

      const { state } = getDayState(day);
      
      // If state is HAID (logged or predicted), count as haid
      if (state === 'HAID') {
        haidDays++;
      } else {
        // Everything else (TAHARA, ISTIHADAH, or even null/none logged) counts as Tuhr for the summary progression
        tuhrDays++;
      }
    });

    // Days remaining until next period from cycleStats
    const daysUntilNext = cycleStats?.daysUntilNext ?? null;

    // Cycle length from adah or user default
    const avgCycle = cycleStats?.avgCycleLength || user?.knownAdahDays || null;

    return { haidDays, tuhrDays, daysUntilNext, avgCycle };
  }, [entries, currentDate, prediction, cycleStats, user, getDayState]);

  const regularity = cycleStats.regularity;
  const regularityLabel = regularity === null ? '—'
    : regularity > 80 ? (isRTL ? 'منتظمة' : 'Regular')
    : regularity > 50 ? (isRTL ? 'متوسطة' : 'Moderate')
    : (isRTL ? 'غير منتظمة' : 'Irregular');

  const weekDays = isRTL 
    ? [t('sat'), t('fri'), t('thu'), t('wed'), t('tue'), t('mon'), t('sun')]
    : [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] pb-32">
      {/* Header */}
      <header className="p-6 flex items-center justify-between sticky top-0 bg-[#FDFCFB]/80 backdrop-blur-md z-50">
        <h1 className="text-xl font-serif font-bold text-emerald-900">{t('calendar')}</h1>
        <div className="flex items-center space-x-1 bg-white rounded-2xl p-1 shadow-sm border border-black/5">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <ChevronLeft className={cn("w-4 h-4 text-emerald-900", isRTL && "rotate-180")} />
          </button>
          <span className="px-2 text-sm font-bold text-emerald-900 min-w-[100px] text-center">
            {displayTitle}
          </span>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <ChevronRight className={cn("w-4 h-4 text-emerald-900", isRTL && "rotate-180")} />
          </button>
        </div>
      </header>

      <main className="px-6 space-y-8">
        {/* Calendar Grid */}
        <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-black/5 border border-black/5">
          {/* Calendar Type Toggle - Now inside the white frame */}
          <div className="flex justify-center mb-6">
            <div className="flex bg-emerald-50 p-1 rounded-xl border border-emerald-100">
              <button 
                onClick={() => setCalendarType('gregorian')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                  calendarType === 'gregorian' ? "bg-white text-emerald-900 shadow-sm" : "text-emerald-600/60"
                )}
              >
                {isRTL ? 'ميلادي' : 'Gregorian'}
              </button>
              <button 
                onClick={() => setCalendarType('hijri')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                  calendarType === 'hijri' ? "bg-white text-emerald-900 shadow-sm" : "text-emerald-600/60"
                )}
              >
                {isRTL ? 'هجري' : 'Hijri'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-4">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-4">
            {calendarDays.map((day, i) => {
              const { state, isExpected, isFertile, isOvulation } = getDayState(day);
              const hijri = toHijri(day.getFullYear(), day.getMonth() + 1, day.getDate());
              const currentHijri = toHijri(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
              
              const isCurrentMonth = calendarType === 'gregorian' 
                ? isSameMonth(day, monthStart)
                : (hijri.hm === currentHijri.hm && hijri.hy === currentHijri.hy);
              
              const isTodayDay = isToday(day);
              
              const hijriMonthName = isRTL ? hijriMonthNamesAr[hijri.hm - 1] : hijriMonthNames[hijri.hm - 1];
              const hijriDisplay = `${hijri.hd} ${hijriMonthName}`;

              return (
                <motion.div
                  key={day.toString()}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.005 }}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center text-sm font-medium transition-all",
                    !isCurrentMonth && "opacity-10",
                    isTodayDay && "text-emerald-600 font-bold"
                  )}
                >
                  {/* Fiqh State Backgrounds */}
                  {state === 'HAID' && !isExpected && (
                    <div className="absolute inset-1 rounded-[8px] bg-[#D4537E]" />
                  )}
                  {isExpected && (
                    <div className="absolute inset-1 rounded-[8px] bg-[#FBEAF0] border-[1.5px] border-dashed border-[#F4C0D1]" />
                  )}
                  {state === 'TAHARA' && !isFertile && (
                    <div className="absolute inset-1 rounded-[8px] bg-[#E1F5EE]" />
                  )}
                  {state === 'ISTIHADAH' && (
                    <div className="absolute inset-1 rounded-[8px] bg-[#4F46E5]/20 border border-[#4F46E5]/40" />
                  )}
                  {state === 'NIFAS' && (
                    <div className="absolute inset-1 rounded-[8px] bg-[#D97706]" />
                  )}

                  {/* Fertile Markers */}
                  {isFertile && (
                    <div className={cn(
                      "absolute inset-1 rounded-[8px] bg-[#FAEEDA] border-[1.5px] border-amber-200",
                      isOvulation && "border-2 border-[#D97706] scale-110 z-20"
                    )} />
                  )}

                  {/* Today Indicator */}
                  {isTodayDay && (
                    <div className="absolute inset-0 border-2 border-emerald-500 rounded-[10px] z-30" />
                  )}

                  <span className={cn(
                    "relative z-10 text-[13px]",
                    state === 'HAID' && !isExpected && "text-white font-semibold",
                    isExpected && "text-[#D4537E] font-semibold",
                    state === 'TAHARA' && !isFertile && "text-[#0F6E56]",
                    isFertile && "text-[#633806] font-semibold"
                  )}>
                    {calendarType === 'gregorian' ? format(day, 'd') : hijri.hd}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* New Pill Legend */}
          <div className="flex flex-wrap gap-2 mt-6 px-2" dir={isRTL ? "rtl" : "ltr"}>
            {[
              { label: isRTL ? 'حيض' : t('haid'), bg: '#D4537E', text: 'white' },
              { label: isRTL ? 'حيض متوقع' : t('expected_period'), bg: '#FBEAF0', text: '#D4537E', dashed: true },
              { label: isRTL ? 'طهارة' : t('tahara'), bg: '#E1F5EE', text: '#0F6E56' },
              { label: isRTL ? 'خصوبة' : t('fertile_window'), bg: '#FAEEDA', text: '#633806' },
            ].map(item => (
              <div
                key={item.label}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: item.bg,
                  color: item.text,
                  border: item.dashed ? '1.5px dashed #F4C0D1' : 'none',
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Pregnancy Chance Chart */}
        <section className="bg-white rounded-[32px] p-6 shadow-xl shadow-black/5 border border-black/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">{t('chance_of_getting_pregnant')}</h3>
            <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{t('high')}</span>
          </div>
          
          <div className="h-40 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pregnancyData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorChance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4FC3F7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4FC3F7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <Area 
                  type="monotone" 
                  dataKey="chance" 
                  stroke="#4FC3F7" 
                  strokeWidth={3}
                  strokeDasharray={(user?.adahConfidence || 0) < 50 ? "5 5" : "0"}
                  fillOpacity={1} 
                  fill="url(#colorChance)" 
                  animationDuration={1000}
                />
                {/* Fertile Window Shading */}
                {cycleDates && (
                  <ReferenceArea 
                    x1={differenceInDays(cycleDates.fertileStart, cycleDates.start) + 1} 
                    x2={differenceInDays(cycleDates.fertileEnd, cycleDates.start) + 1} 
                    fill="#4FC3F7" 
                    fillOpacity={0.1}
                    label={{ position: 'top', value: t('fertile_window'), fontSize: 8, fill: '#4FC3F7', fontWeight: 'bold' }}
                  />
                )}
                {/* Current Day Marker */}
                <ReferenceLine 
                  x={cycleStats.currentDay} 
                  stroke="#10B981" 
                  strokeWidth={2}
                  label={{ position: 'top', value: t('you_are_here'), fontSize: 8, fill: '#10B981', fontWeight: 'bold' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 text-center">
            <div className="flex flex-col">
              <span>{t('start_of_cycle')}</span>
              <span className="text-gray-900 mt-1">
                {cycleDates ? cycleDates.start.toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', { day: 'numeric', month: 'long' }) : '—'}
              </span>
            </div>
            <div className="flex flex-col">
              <span>{t('ovulation')}</span>
              <span className="text-gray-900 mt-1">
                {cycleDates ? cycleDates.ovulation.toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', { day: 'numeric', month: 'long' }) : '—'}
              </span>
            </div>
            <div className="flex flex-col">
              <span>{t('next_cycle')}</span>
              <span className="text-gray-900 mt-1">
                {cycleDates ? cycleDates.next.toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', { day: 'numeric', month: 'long' }) : '—'}
              </span>
            </div>
          </div>

          {(user?.adahConfidence || 0) < 50 && (
            <p className="text-[9px] text-amber-600 font-bold text-center bg-amber-50 py-2 rounded-xl border border-amber-100 italic">
              {t('prediction_improves_with_more_data')}
            </p>
          )}
        </section>

        {/* Stats Summary */}
        <section className="bg-emerald-50 rounded-[40px] p-8 border border-emerald-100 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-serif font-bold text-emerald-900">{t('month_summary')}</h4>
                <p className="text-[10px] text-emerald-700/60 font-bold uppercase tracking-widest">{displayTitle}</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-emerald-700/40 uppercase tracking-widest">{t('cycle_regularity')}</span>
              <span className="text-xl font-serif font-bold text-emerald-900">
                {regularityLabel}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/50 p-4 rounded-3xl space-y-1">
              <span className="text-[9px] font-bold text-emerald-700/40 uppercase tracking-widest">{t('total_haid_days')}</span>
              <div className="flex flex-col">
                <div className="flex items-baseline space-x-1">
                  <p className={cn(
                    "text-2xl font-serif font-bold text-emerald-900"
                  )}>
                    {monthlyStats.haidDays > 0 ? (
                      isRTL 
                        ? `${monthlyStats.haidDays.toLocaleString('ar-SA-u-nu-latn')} ${t('days')}`
                        : `${monthlyStats.haidDays} ${t('days')}`
                    ) : (isRTL ? 'لم يُسجَّل حيض هذا الشهر' : 'No haid logged')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white/50 p-4 rounded-3xl space-y-1">
              <span className="text-[9px] font-bold text-emerald-700/40 uppercase tracking-widest">{t('total_tahara_days')}</span>
              <div className="flex items-baseline space-x-1">
                <p className="text-2xl font-serif font-bold text-emerald-900">
                  {monthlyStats.tuhrDays > 0 ? (
                    isRTL
                      ? `${monthlyStats.tuhrDays.toLocaleString('ar-SA-u-nu-latn')} ${t('days')}`
                      : `${monthlyStats.tuhrDays} ${t('days')}`
                  ) : '—'}
                </p>
              </div>
            </div>
            <div className="bg-white/50 p-4 rounded-3xl space-y-1">
              <span className="text-[9px] font-bold text-emerald-700/40 uppercase tracking-widest">{t('avg_cycle_length')}</span>
              <div className="flex flex-col">
                <div className="flex items-baseline space-x-1">
                  <p className={cn(
                    "font-serif font-bold text-emerald-900 text-2xl"
                  )}>
                    {monthlyStats.avgCycle ? (
                      isRTL
                        ? `${Math.round(monthlyStats.avgCycle).toLocaleString('ar-SA-u-nu-latn')} ${t('days')}`
                        : `${Math.round(monthlyStats.avgCycle)} ${t('days')}`
                    ) : (isRTL ? 'غير كافٍ للحساب' : '—')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white/50 p-4 rounded-3xl space-y-1">
              <span className="text-[9px] font-bold text-emerald-700/40 uppercase tracking-widest">{t('next_period')}</span>
              <div className="flex items-baseline space-x-1">
                <p className={cn(
                  "text-2xl font-serif font-bold text-emerald-900"
                )}>
                  {monthlyStats.daysUntilNext !== null ? (
                    isRTL 
                      ? `${monthlyStats.daysUntilNext.toLocaleString('ar-SA-u-nu-latn')} ${t('days_left')}`
                      : `${monthlyStats.daysUntilNext} ${t('days_left')}`
                  ) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Visual Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-bold text-emerald-700/40 uppercase tracking-widest">
              <span>{t('cycle_progress')}</span>
              <span>{Math.round(cycleStats.progress).toLocaleString('en-US')}%</span>
            </div>
            <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${cycleStats.progress}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

import { Activity } from 'lucide-react';
