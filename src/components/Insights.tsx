/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart2, 
  TrendingUp, 
  Activity, 
  Calendar as CalendarIcon,
  ChevronRight,
  Sparkles,
  Heart,
  Brain,
  Wind,
  Zap,
  Moon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useCycleData } from '../contexts/CycleContext.tsx';
import { cn } from '../utils/cn.ts';
import { generateSmartAlerts } from '../logic/healthEngine.ts';

export const Insights = ({ onNavigateToToday }: { onNavigateToToday?: () => void }) => {
  const { t, isRTL } = useTranslation();
  const { user, ledger, cycleStats, entries, prediction, ovulation, loading } = useCycleData();
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const isPregnant = Boolean(user?.pregnant || user?.conditions?.includes('pregnant'));
  const isPostpartum = Boolean(user?.conditions?.includes('postpartum'));
  const isTtc = Boolean(user?.conditions?.includes('ttc'));
  const actualEntries = useMemo(() => entries.filter(entry => !entry.is_predicted), [entries]);
  const numberLocale = isRTL ? 'ar-SA-u-nu-latn' : 'en-US';
  const formatNumber = (value: number) => value.toLocaleString(numberLocale);
  const pregnancyWeek = Math.min(40, Math.max(1, Math.round(user?.pregnancy_week || 1)));
  const pregnancyDaysRemaining = Math.max(0, (40 - pregnancyWeek) * 7);
  const daysUntilNext = typeof cycleStats?.daysUntilNext === 'number' ? cycleStats.daysUntilNext : null;
  const nextPeriodDate = prediction?.predictedStartDate ? new Date(prediction.predictedStartDate) : null;
  const ovulationDate = ovulation?.predictedOvulationDate ? new Date(ovulation.predictedOvulationDate) : null;

  const symptomData = useMemo(() => {
    if (!actualEntries || actualEntries.length === 0) return null;
    
    const symptomCounts: Record<string, number> = {};
    let totalSignificantEntries = 0;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    
    actualEntries.forEach(entry => {
      const entryTime = new Date(entry.date || entry.time_logged).getTime();
      if (!Number.isNaN(entryTime) && entryTime < ninetyDaysAgo) return;

      const hasSymptoms = entry.symptoms && Object.values(entry.symptoms).some(v => v > 0);
      const hasLowEnergy = entry.energy_level !== undefined && entry.energy_level <= 2;
      const hasPoorSleep = entry.sleep_quality !== undefined && entry.sleep_quality <= 2;

      if (hasSymptoms || hasLowEnergy || hasPoorSleep) {
        totalSignificantEntries++;
        
        if (entry.symptoms) {
          Object.entries(entry.symptoms).forEach(([s, level]) => {
            if (level > 0) {
              symptomCounts[s] = (symptomCounts[s] || 0) + 1;
            }
          });
        }
        
        if (hasLowEnergy) {
          symptomCounts['energy'] = (symptomCounts['energy'] || 0) + 1;
        }
        
        if (hasPoorSleep) {
          symptomCounts['sleep'] = (symptomCounts['sleep'] || 0) + 1;
        }
      }
    });
    
    if (totalSignificantEntries === 0) return null;
    
    const results: Record<string, number> = {};
    Object.entries(symptomCounts).forEach(([key, count]) => {
      results[key] = (count / totalSignificantEntries) * 100;
    });
    return results;
  }, [actualEntries]);

  const hasAnySymptomData = symptomData && Object.keys(symptomData).length > 0;

  const insights = useMemo(() => {
    const list = [];
    
    // Only add if we have real ledger data
    if (isPregnant) {
      list.push({
        title: isRTL ? `أنتِ في الأسبوع ${formatNumber(pregnancyWeek)}` : `Week ${pregnancyWeek}`,
        subtitle: isRTL
          ? `متبقّي تقريباً ${formatNumber(pregnancyDaysRemaining)} يوماً حتى موعد الولادة المتوقع. سجّلي أي أعراض غير معتادة.`
          : `About ${pregnancyDaysRemaining} days remain until the estimated due window. Keep logging unusual symptoms.`,
        icon: Heart,
        color: 'bg-emerald-50 text-emerald-600'
      });
    } else if (isPostpartum) {
      list.push({
        title: isRTL ? 'توقعات الدورة متوقفة أثناء النفاس' : 'Cycle prediction is paused during nifas',
        subtitle: isRTL
          ? 'بعد انتهاء النفاس وعودة الحيض، ستتحسن التوقعات تدريجياً مع التسجيل.'
          : 'After nifas ends and cycle logs return, predictions will improve gradually.',
        icon: Heart,
        color: 'bg-rose-50 text-rose-600'
      });
    } else if (ledger.length >= 3) {
      const cycleLengths = ledger.map(l => 
        (l.tuhr_duration_days || 0) + ((l.haid_duration_hours || 0) / 24)
      ).filter(length => Number.isFinite(length) && length > 0);
      if (cycleLengths.length < 3) return list;
      const avg = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
      const variance = Math.max(...cycleLengths) - Math.min(...cycleLengths);
      
      if (variance <= 3) {
        list.push({
          title: t('cycle_regularity_high'),
          subtitle: isRTL 
            ? `كانت آخر ${formatNumber(cycleLengths.length)} دورات لك ${formatNumber(Math.round(avg))} يوماً`
            : `Your last ${ledger.length} cycles were ${Math.round(avg)} days`,
          icon: Heart,
          color: 'bg-rose-50 text-rose-600'
        });
      } else {
        list.push({
          title: t('cycle_variance_detected' as any) || 'تفاوت في طول الدورة',
          subtitle: isRTL
            ? `تراوحت دوراتك بين ${formatNumber(Math.round(Math.min(...cycleLengths)))} و${formatNumber(Math.round(Math.max(...cycleLengths)))} يوماً`
            : `Your cycles ranged from ${Math.round(Math.min(...cycleLengths))} to ${Math.round(Math.max(...cycleLengths))} days`,
          icon: Activity,
          color: 'bg-amber-50 text-amber-600'
        });
      }
    }
    
    // Only add if we have prediction data
    if (!isPregnant && !isPostpartum && cycleStats?.daysUntilNext !== undefined) {
      const daysUntil = cycleStats.daysUntilNext;
      if (daysUntil <= 5 && daysUntil > 0) {
        list.push({
          title: isRTL ? `الحيض المتوقع خلال ${formatNumber(daysUntil)} أيام` : `Period expected in ${daysUntil} days`,
          subtitle: t('prepare_and_rest' as any) || 'استعدي واحرصي على الراحة الكافية',
          icon: CalendarIcon,
          color: 'bg-rose-50 text-rose-600'
        });
      }
    }
    
    // If no real insights available
    if (list.length === 0) {
      list.push({
        title: t('log_more_for_insights' as any) || 'سجلي دورتك لرؤية رؤى مخصصة',
        subtitle: t('more_logs_better_accuracy' as any) || 'كلما سجلتِ أكثر، كانت الرؤى أدق',
        icon: Sparkles,
        color: 'bg-gray-50 text-gray-400'
      });
    }
    
    return list;
  }, [ledger, cycleStats, t, isRTL, isPregnant, isPostpartum, pregnancyWeek, pregnancyDaysRemaining]);

  const smartAlerts = useMemo(() => {
    const avgHaid = cycleStats?.avgPeriodLength || 5;
    const avgCycle = cycleStats?.avgCycleLength || 28;
    
    const symptomHistory: Record<string, number[]> = {};
    actualEntries.forEach(e => {
      if (e.symptoms) {
        Object.entries(e.symptoms).forEach(([s, v]) => {
          if (!symptomHistory[s]) symptomHistory[s] = [];
          symptomHistory[s].push(v as number);
        });
      }
    });

    return generateSmartAlerts(ledger, avgHaid, avgCycle, symptomHistory);
  }, [ledger, cycleStats, actualEntries]);

  const validCycleLengths = ledger
    .map(c => (c.tuhr_duration_days || 0) + ((c.haid_duration_hours || 0) / 24))
    .filter(length => Number.isFinite(length) && length > 0);

  const avgCycleLength = !isPregnant && !isPostpartum && validCycleLengths.length >= 1
    ? Math.round(validCycleLengths.reduce((a, c) => a + c, 0) / validCycleLengths.length)
    : null;

  const regularityScore = !isPregnant && !isPostpartum && ledger.length >= 3 ? (cycleStats.regularity || 0) : null;

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className={cn("flex flex-col min-h-screen bg-[#FDFCFB] pb-32", isRTL && "font-arabic")}>
      {/* Header */}
      <header className="p-6 pt-12 space-y-2">
        <h1 className="text-3xl font-serif font-bold text-[#8E244D]">{t('insights')}</h1>
        <p className="text-sm text-gray-400">{t('insights_desc')}</p>
      </header>

      <main className="px-6 space-y-8">
        {/* Summary Stats */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-[32px] shadow-sm border border-black/5 space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isPregnant ? (isRTL ? 'أسبوع الحمل' : 'Pregnancy week') : t('avg_cycle_length')}
            </p>
            <div className="flex items-baseline space-x-1 rtl:space-x-reverse">
              {isPregnant ? (
                <>
                  <span className="text-2xl font-serif font-bold text-emerald-600">{formatNumber(pregnancyWeek)}</span>
                  <span className="text-xs text-gray-400">{isRTL ? 'من 40' : 'of 40'}</span>
                </>
              ) : avgCycleLength !== null ? (
                <>
                  <span className="text-2xl font-serif font-bold text-rose-600">{formatNumber(avgCycleLength)}</span>
                  <span className="text-xs text-gray-400">{t('days')}</span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-400">{t('insufficient_data' as any) || (isRTL ? 'بيانات غير كافية' : 'Insufficient data')}</span>
              )}
            </div>
          </div>
          <div className="bg-white p-5 rounded-[32px] shadow-sm border border-black/5 space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isPregnant ? (isRTL ? 'المتبقي تقريباً' : 'Approx. remaining') : t('regularity')}
            </p>
            <div className="flex items-baseline space-x-1 rtl:space-x-reverse">
              {isPregnant ? (
                <>
                  <span className="text-2xl font-serif font-bold text-rose-600">{formatNumber(pregnancyDaysRemaining)}</span>
                  <span className="text-xs text-gray-400">{t('days')}</span>
                </>
              ) : regularityScore !== null ? (
                <>
                  <span className="text-2xl font-serif font-bold text-emerald-600">
                    {formatNumber(regularityScore)}%
                  </span>
                  <span className="text-xs text-gray-400">
                    {regularityScore >= 80 ? t('high' as any) : regularityScore >= 55 ? (isRTL ? 'متوسط' : 'Medium') : (isRTL ? 'منخفض' : 'Low')}
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-400">{t('insufficient_data' as any) || (isRTL ? 'بيانات غير كافية' : 'Insufficient data')}</span>
              )}
            </div>
          </div>
        </section>

        {!isPregnant && !isPostpartum && (nextPeriodDate || ovulationDate || isTtc) && (
          <section className="bg-gradient-to-br from-rose-50 to-white rounded-[32px] p-5 shadow-sm border border-rose-100 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-right">
                <h3 className="text-lg font-serif font-bold text-rose-900">
                  {isTtc ? (isRTL ? 'توقعات الخصوبة' : 'Fertility outlook') : (isRTL ? 'التوقع القادم' : 'Next outlook')}
                </h3>
                <p className="text-xs text-gray-500">
                  {isRTL ? 'تتحسن الدقة مع كل تسجيل حقيقي.' : 'Accuracy improves with each real log.'}
                </p>
              </div>
              <CalendarIcon className="w-7 h-7 text-rose-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nextPeriodDate && (
                <div className="rounded-3xl bg-white p-4 border border-rose-100 text-right">
                  <p className="text-[10px] font-bold text-rose-400">{isRTL ? 'الحيض المتوقع' : 'Expected period'}</p>
                  <p className="text-lg font-bold text-rose-900">
                    {new Intl.DateTimeFormat(numberLocale, { day: 'numeric', month: 'long' }).format(nextPeriodDate)}
                  </p>
                  {daysUntilNext !== null && (
                    <p className="text-xs text-gray-400">
                      {daysUntilNext >= 0
                        ? (isRTL ? `بعد ${formatNumber(daysUntilNext)} أيام تقريباً` : `In about ${daysUntilNext} days`)
                        : (isRTL ? `متأخرة ${formatNumber(Math.abs(daysUntilNext))} أيام` : `${Math.abs(daysUntilNext)} days overdue`)}
                    </p>
                  )}
                </div>
              )}
              {ovulationDate && (
                <div className="rounded-3xl bg-white p-4 border border-emerald-100 text-right">
                  <p className="text-[10px] font-bold text-emerald-500">{isRTL ? 'التبويض المتوقع' : 'Expected ovulation'}</p>
                  <p className="text-lg font-bold text-emerald-900">
                    {new Intl.DateTimeFormat(numberLocale, { day: 'numeric', month: 'long' }).format(ovulationDate)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isRTL ? 'للتخطيط فقط، وليس تأكيداً طبياً.' : 'For planning only, not medical confirmation.'}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Symptom Trends Enhanced */}
        <section className="bg-white rounded-[32px] p-6 shadow-xl shadow-black/5 border border-black/5 space-y-8">
          <div className="flex items-center justify-between">
            <div className={cn("flex items-center", isRTL ? "space-x-reverse space-x-2" : "space-x-2")}>
              <TrendingUp className="w-5 h-5 text-[#FF5C8D]" />
              <h3 className="text-sm font-bold text-gray-800">{t('symptom_trends')}</h3>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('last_3_months')}</span>
          </div>

          {(() => {
            const symptoms = [
              { key: 'fatigue', labelAr: 'تعب', labelEn: 'Fatigue', color: '#1D9E75' },
              { key: 'headache', labelAr: 'صداع', labelEn: 'Headache', color: '#378ADD' },
              { key: 'cramps', labelAr: 'تشنجات', labelEn: 'Cramps', color: '#b8325f' },
              { key: 'mood', labelAr: 'المزاج', labelEn: 'Mood', color: '#A09CF7' },
              { key: 'bloating', labelAr: 'انتفاخ', labelEn: 'Bloating', color: '#F0997B' },
              { key: 'backache', labelAr: 'ألم الظهر', labelEn: 'Backache', color: '#E24B4A' },
              { key: 'energy', labelAr: 'طاقة منخفضة', labelEn: 'Low energy', color: '#F59E0B' },
              { key: 'sleep', labelAr: 'نوم سيء', labelEn: 'Poor sleep', color: '#6366F1' },
              { key: 'nausea', labelAr: 'غثيان', labelEn: 'Nausea', color: '#FAC775' },
              { key: 'acne', labelAr: 'حبوب', labelEn: 'Acne', color: '#B45309' },
              { key: 'tender_breasts', labelAr: 'آلام الثدي', labelEn: 'Breast tenderness', color: '#b8325f' },
            ];

            return (
              <>
                <div className="space-y-4">
                  {symptoms.map((symptom) => {
                    const hasData = symptomData?.[symptom.key];
                    const value = hasData ? symptomData[symptom.key] : 0;
                    const pct = hasData ? Math.round(value) : 0;
                    const label = isRTL ? symptom.labelAr : symptom.labelEn;
                    
                    return (
                      <div key={symptom.key} className={cn("flex items-center gap-3", isRTL ? "flex-row" : "flex-row-reverse")}>
                        <span
                          className={cn(
                            "min-w-[76px] shrink-0 text-[13px] font-medium",
                            hasData ? "text-gray-700" : "text-gray-400",
                            isRTL ? "text-right" : "text-left"
                          )}
                        >
                          {label}
                        </span>
                        
                        <div style={{
                          flex: 1,
                          height: '8px',
                          background: '#F3F4F6',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          position: 'relative',
                        }}>
                          {hasData ? (
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: symptom.color,
                              borderRadius: '4px',
                              transition: 'width 0.6s ease',
                            }}/>
                          ) : (
                            /* Placeholder shimmer bar */
                            <div style={{
                              height: '100%',
                              width: '100%',
                              background: 'repeating-linear-gradient(90deg, #F3F4F6 0px, #EBEBEB 20px, #F3F4F6 40px)',
                              borderRadius: '4px',
                              opacity: 0.6,
                            }}/>
                          )}
                        </div>
                        
                        <span style={{
                          fontSize: '11px',
                          fontWeight: hasData ? 500 : 400,
                          color: hasData ? symptom.color : '#C4C4C4',
                          minWidth: '36px',
                          textAlign: isRTL ? 'left' : 'right',
                          flexShrink: 0,
                        }}>
                          {hasData ? `${formatNumber(pct)}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Footer prompt if no data */}
                {!hasAnySymptomData && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 14px',
                    background: '#F9FAFB',
                    borderRadius: '10px',
                    border: '1px dashed #E5E7EB',
                    textAlign: 'center',
                  }}>
                    <p style={{
                      fontSize: '12px',
                      color: '#9CA3AF',
                      margin: 0,
                    }}>
                      {isRTL ? 'سجّلي أعراضك يومياً لرؤية الاتجاهات هنا' : 'Log symptoms daily to see trends here'}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => onNavigateToToday?.()}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '10px',
                    borderRadius: '12px',
                    border: '1px solid #F4C0D1',
                    background: '#FBEAF0',
                    color: '#b8325f',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isRTL ? 'سجّلي أعراض اليوم ←' : 'Log today’s symptoms →'}
                </button>
              </>
            );
          })()}

          <div className="pt-4 border-t border-black/5">
            <p className="text-[11px] text-gray-400 leading-relaxed italic">
              {t('mood_pattern_desc')}
            </p>
          </div>
        </section>

        {/* Cycle Regularity Dot Matrix */}
        {!isPregnant && !isPostpartum && (
        <section className="bg-white rounded-[32px] p-6 shadow-xl shadow-black/5 border border-black/5 space-y-6">
          <div className="flex items-center justify-between">
            <div className={cn("flex items-center", isRTL ? "space-x-reverse space-x-2" : "space-x-2")}>
              <BarChart2 className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold text-gray-800">{t('cycle_regularity')}</h3>
            </div>
            <div className="flex space-x-1 rtl:space-x-reverse">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="w-2 h-2 rounded-full bg-gray-100" />
            </div>
          </div>

          {actualEntries && actualEntries.length > 0 && regularityScore !== null ? (
            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: 30 }).map((_, i) => {
                const isActive = regularityScore !== null && i < (regularityScore / 3.33);
                return (
                  <motion.div 
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className={cn(
                      "aspect-square rounded-full",
                      isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-gray-100"
                    )}
                  />
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <div className="grid grid-cols-10 gap-2 opacity-20 mb-4">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-full bg-gray-300" />
                ))}
              </div>
              <p className="text-xs text-gray-400 font-medium">
                {t('log_cycle_for_regularity' as any) || (isRTL ? 'سجلي دورتك لرؤية مخطط الانتظام' : 'Log your cycle to see regularity chart')}
              </p>
            </div>
          )}
          
          <p className="text-[10px] text-gray-400 text-center font-medium">
            {t('cycle_regularity_desc')}
          </p>
        </section>
        )}

        {/* AI Insights Cards */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">{t('health_insights')}</h3>
          <div className="space-y-3">
            {/* Smart Health Alerts */}
            {smartAlerts.map((alert, i) => (
              <motion.div
                key={`smart-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "p-4 rounded-2xl border flex gap-3",
                  alert.type === 'warning' ? "bg-rose-50 border-rose-100" :
                  alert.type === 'success' ? "bg-emerald-50 border-emerald-100" :
                  "bg-blue-50 border-blue-100"
                )}
              >
                {alert.type === 'warning' ? <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" /> :
                 alert.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> :
                 <Info className="w-5 h-5 text-blue-500 shrink-0" />}
                <div className="text-right">
                  <div className={cn(
                    "text-sm font-bold",
                    alert.type === 'warning' ? "text-rose-900" :
                    alert.type === 'success' ? "text-emerald-900" :
                    "text-blue-900"
                  )}>{alert.titleAr}</div>
                  <div className={cn(
                    "text-xs opacity-70",
                    alert.type === 'warning' ? "text-rose-700" :
                    alert.type === 'success' ? "text-emerald-700" :
                    "text-blue-700"
                  )}>{alert.bodyAr}</div>
                </div>
              </motion.div>
            ))}

            {insights.map((insight, i) => (
              <InsightCard 
                key={i}
                icon={insight.icon} 
                title={insight.title} 
                desc={insight.subtitle}
                color={insight.color}
                isRTL={isRTL}
              />
            ))}
          </div>
        </section>

        {/* Cycle History List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('cycle_history')}</h3>
            <span className="text-[10px] font-bold text-[#FF5C8D] uppercase tracking-widest">
              {ledger.length > 0 ? `${formatNumber(ledger.length)} ${isRTL ? 'سجل' : 'records'}` : t('view_all')}
            </span>
          </div>
          
          <div className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-black/5 border border-black/5">
            {ledger.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CalendarIcon className="w-12 h-12 text-gray-200 mx-auto" />
                <p className="text-sm text-gray-400 font-medium">{t('no_cycle_history_yet')}</p>
              </div>
            ) : (
              ledger.slice(0, 5).map((record, i) => {
                const durationDays = record.haid_duration_hours ? Math.max(1, Math.round(record.haid_duration_hours / 24)) : null;
                const cycleDays = durationDays !== null && record.tuhr_duration_days ? record.tuhr_duration_days + durationDays : null;
                return (
                <HistoryItem 
                  key={record.cycle_number}
                  startDate={new Date(record.haid_start)} 
                  endDate={record.haid_end ? new Date(record.haid_end) : null} 
                  durationDays={durationDays} 
                  cycleDays={cycleDays} 
                  isRTL={isRTL}
                  t={t}
                  last={i === Math.min(ledger.length, 5) - 1}
                  onClick={() => setSelectedHistory({ 
                    startDate: new Date(record.haid_start),
                    endDate: record.haid_end ? new Date(record.haid_end) : null,
                    durationDays,
                    cycleDays
                  })}
                />
              )})
            )}
          </div>
        </section>

        {/* History Detail Sheet */}
        <AnimatePresence>
          {selectedHistory && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedHistory(null)}
                className="fixed inset-0 bg-black/40 z-[200] backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[201] p-8 space-y-6"
              >
                <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto" />
                <div className="space-y-4">
                  <h3 className="text-2xl font-serif font-bold text-rose-800">{t('cycle_history_details')}</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-rose-50 rounded-2xl">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">{t('start_of_cycle' as any)}</p>
                      <p className="text-sm font-bold text-rose-800">
                        {new Intl.DateTimeFormat(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', { day: 'numeric', month: 'long' }).format(selectedHistory.startDate)}
                      </p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">{t('duration' as any)}</p>
                      <p className="text-sm font-bold text-emerald-800">
                        {selectedHistory.durationDays
                          ? (isRTL
                            ? `${selectedHistory.durationDays.toLocaleString('en-US')} أيام`
                            : `${selectedHistory.durationDays} days`)
                          : (isRTL ? 'قيد التسجيل' : 'In progress')}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50 rounded-[32px] space-y-3">
                    <h4 className="text-sm font-bold text-gray-800">{t('guidance' as any)}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed rtl:text-right">
                      {t('cycle_history_details_desc' as any) || "This cycle was regular. Your average duration is 5 days. Tracking consistently helps Niswah AI provide better predictions."}
                    </p>
                  </div>

                  <button 
                    onClick={() => setSelectedHistory(null)}
                    className="w-full py-4 bg-rose-400 text-white rounded-2xl font-bold"
                  >
                    {t('close' as any)}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const InsightCard = ({ icon: Icon, title, desc, color, isRTL }: any) => (
  <motion.div 
    whileTap={{ scale: 0.98 }}
    className={cn(
      "bg-white p-5 rounded-[32px] shadow-sm border border-black/5 flex items-start",
      isRTL ? "space-x-reverse space-x-4 text-right" : "space-x-4"
    )}
  >
    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", color)}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="space-y-1">
      <h4 className="text-sm font-bold text-gray-800">{title}</h4>
      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

const HistoryItem = ({ startDate, endDate, durationDays, cycleDays, last, isRTL, t, onClick }: any) => {
  const locale = isRTL ? 'ar-SA-u-nu-latn' : 'en-US';
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  const dateRange = endDate
    ? `${dateFormatter.format(startDate)} – ${dateFormatter.format(endDate)}`
    : `${dateFormatter.format(startDate)} – ${isRTL ? 'مستمرة' : 'Ongoing'}`;
  
  const formattedDuration = isRTL 
    ? (durationDays ? `${durationDays.toLocaleString('en-US')} أيام` : 'قيد التسجيل')
    : (durationDays ? `${durationDays} days` : 'In progress');
    
  const formattedCycle = isRTL
    ? (cycleDays ? `${cycleDays.toLocaleString('en-US')} يوماً` : '—')
    : (cycleDays ? `${cycleDays} days` : '—');

  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-6 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer",
        !last && "border-b border-black/5",
        isRTL && "flex-row-reverse"
      )}
    >
      {/* Right side in RTL (Primary) */}
      <div className={cn("flex items-center", isRTL ? "flex-row-reverse space-x-reverse space-x-4" : "space-x-4")}>
        <div className={isRTL ? "text-right" : "text-left"}>
          <p className="text-sm font-bold text-gray-800">{dateRange}</p>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{formattedDuration}</p>
          <p className="text-[9px] text-[#FF5C8D] font-bold mt-1">{t('view_details')}</p>
        </div>
        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-400">
          <CalendarIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Left side in RTL (Secondary) */}
      <div className={cn("flex items-center", isRTL ? "flex-row-reverse space-x-reverse space-x-3" : "space-x-3")}>
        <div className={isRTL ? "text-left" : "text-right"}>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{t('cycle_length')}</p>
          <p className="text-xs font-bold text-gray-800">{formattedCycle}</p>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-gray-300", isRTL && "rotate-180")} />
      </div>
    </div>
  );
};
