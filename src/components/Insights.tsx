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

const SYMPTOM_DATA = []; // Removed hardcoded data

export const Insights = ({ onNavigateToToday }: { onNavigateToToday?: () => void }) => {
  const { t, isRTL } = useTranslation();
  const { user, ledger, cycleStats, entries, loading } = useCycleData();
  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  const symptomData = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    
    const symptomCounts: Record<string, number> = {};
    let totalEntriesWithSymptoms = 0;
    
    entries.forEach(entry => {
      if (entry.symptoms && Object.keys(entry.symptoms).length > 0) {
        totalEntriesWithSymptoms++;
        Object.entries(entry.symptoms).forEach(([s, level]) => {
          // If level is a number (1, 2, 3), we can use it to weight the trend or just count occurrences
          symptomCounts[s] = (symptomCounts[s] || 0) + 1;
        });
      }
    });
    
    if (totalEntriesWithSymptoms === 0) return null;
    
    const results: Record<string, number> = {};
    Object.entries(symptomCounts).forEach(([key, count]) => {
      results[key] = (count / totalEntriesWithSymptoms) * 100;
    });
    return results;
  }, [entries]);

  const hasAnySymptomData = symptomData && Object.keys(symptomData).length > 0;

  const insights = useMemo(() => {
    const list = [];
    
    // Only add if we have real ledger data
    if (ledger.length >= 3) {
      const cycleLengths = ledger.map(l => 
        (l.tuhr_duration_days || 0) + ((l.haid_duration_hours || 0) / 24)
      );
      const avg = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
      const variance = Math.max(...cycleLengths) - Math.min(...cycleLengths);
      
      if (variance <= 3) {
        list.push({
          title: t('cycle_regularity_high'),
          subtitle: isRTL 
            ? `كانت آخر ${ledger.length.toLocaleString('ar-SA-u-nu-latn')} دورات لك ${Math.round(avg).toLocaleString('ar-SA-u-nu-latn')} يوماً`
            : `Your last ${ledger.length} cycles were ${Math.round(avg)} days`,
          icon: Heart,
          color: 'bg-rose-50 text-rose-600'
        });
      } else {
        list.push({
          title: t('cycle_variance_detected' as any) || 'تفاوت في طول الدورة',
          subtitle: isRTL
            ? `تراوحت دوراتك بين ${Math.min(...cycleLengths).toLocaleString('ar-SA-u-nu-latn')} و${Math.max(...cycleLengths).toLocaleString('ar-SA-u-nu-latn')} يوماً`
            : `Your cycles ranged from ${Math.round(Math.min(...cycleLengths))} to ${Math.round(Math.max(...cycleLengths))} days`,
          icon: Activity,
          color: 'bg-amber-50 text-amber-600'
        });
      }
    }
    
    // Only add if we have prediction data
    if (cycleStats?.daysUntilNext !== undefined) {
      const daysUntil = cycleStats.daysUntilNext;
      if (daysUntil <= 5 && daysUntil > 0) {
        list.push({
          title: isRTL ? `الحيض المتوقع خلال ${daysUntil.toLocaleString('ar-SA-u-nu-latn')} أيام` : `Period expected in ${daysUntil} days`,
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
  }, [ledger, cycleStats, t, isRTL]);

  const smartAlerts = useMemo(() => {
    const avgHaid = cycleStats?.avgPeriodLength || 5;
    const avgCycle = cycleStats?.avgCycleLength || 28;
    
    const symptomHistory: Record<string, number[]> = {};
    entries.forEach(e => {
      if (e.symptoms) {
        Object.entries(e.symptoms).forEach(([s, v]) => {
          if (!symptomHistory[s]) symptomHistory[s] = [];
          symptomHistory[s].push(v as number);
        });
      }
    });

    return generateSmartAlerts(ledger, avgHaid, avgCycle, symptomHistory);
  }, [ledger, cycleStats, entries]);

  const avgCycleLength = ledger.length >= 1
    ? Math.round(ledger.reduce((a, c) => a + (c.tuhr_duration_days || 0) + ((c.haid_duration_hours || 0) / 24), 0) / ledger.length)
    : null;

  const regularityScore = ledger.length >= 3 ? (cycleStats.regularity || 0) : null;

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
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('avg_cycle_length')}</p>
            <div className="flex items-baseline space-x-1 rtl:space-x-reverse">
              {avgCycleLength !== null ? (
                <>
                  <span className="text-2xl font-serif font-bold text-rose-600">{avgCycleLength.toLocaleString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US')}</span>
                  <span className="text-xs text-gray-400">{t('days')}</span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-400">{t('insufficient_data' as any) || (isRTL ? 'بيانات غير كافية' : 'Insufficient data')}</span>
              )}
            </div>
          </div>
          <div className="bg-white p-5 rounded-[32px] shadow-sm border border-black/5 space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('regularity')}</p>
            <div className="flex items-baseline space-x-1 rtl:space-x-reverse">
              {regularityScore !== null ? (
                <>
                  <span className="text-2xl font-serif font-bold text-emerald-600">
                    {regularityScore.toLocaleString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US')}%
                  </span>
                  <span className="text-xs text-gray-400">{t('high' as any)}</span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-400">{t('insufficient_data' as any) || (isRTL ? 'بيانات غير كافية' : 'Insufficient data')}</span>
              )}
            </div>
          </div>
        </section>

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
              { key: 'cramps', labelAr: 'تشنجات', icon: '⚡', color: '#D4537E' },
              { key: 'mood', labelAr: 'المزاج', icon: '🫀', color: '#A09CF7' },
              { key: 'headache', labelAr: 'صداع', icon: '🧠', color: '#378ADD' },
              { key: 'energy', labelAr: 'الطاقة', icon: '⚡', color: '#1D9E75' },
              { key: 'sleep', labelAr: 'النوم', icon: '🌙', color: '#FAC775' },
              { key: 'bloating', labelAr: 'انتفاخ', icon: '💫', color: '#F0997B' },
              { key: 'backache', labelAr: 'ألم الظهر', icon: '🔴', color: '#E24B4A' },
            ];

            return (
              <>
                <div className="space-y-4">
                  {symptoms.map((symptom) => {
                    const hasData = symptomData?.[symptom.key];
                    const value = hasData ? symptomData[symptom.key] : 0;
                    const pct = hasData ? Math.round(value) : 0;
                    
                    return (
                      <div key={symptom.key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        direction: 'rtl',
                        marginBottom: '14px',
                      }}>
                        {/* Label */}
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: hasData ? '#374151' : '#9CA3AF',
                          minWidth: '64px',
                          textAlign: 'right',
                          flexShrink: 0,
                        }}>
                          {symptom.labelAr}
                        </span>
                        
                        {/* Bar track */}
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
                        
                        {/* Percentage or "سجّلي" prompt */}
                        <span style={{
                          fontSize: '11px',
                          fontWeight: hasData ? 500 : 400,
                          color: hasData ? symptom.color : '#C4C4C4',
                          minWidth: '36px',
                          textAlign: 'left',
                          flexShrink: 0,
                        }}>
                          {hasData ? `${pct}%` : '—'}
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
                      سجّلي أعراضك يومياً لرؤية الاتجاهات هنا
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
                    color: '#D4537E',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  سجّلي أعراض اليوم ←
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

          {entries && entries.length > 0 ? (
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
            <button className="text-[10px] font-bold text-[#FF5C8D] uppercase tracking-widest">{t('view_all')}</button>
          </div>
          
          <div className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-black/5 border border-black/5">
            {ledger.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CalendarIcon className="w-12 h-12 text-gray-200 mx-auto" />
                <p className="text-sm text-gray-400 font-medium">{t('no_cycle_history_yet')}</p>
              </div>
            ) : (
              ledger.slice(0, 5).map((record, i) => (
                <HistoryItem 
                  key={record.cycle_number}
                  startDate={new Date(record.haid_start)} 
                  endDate={record.haid_end ? new Date(record.haid_end) : null} 
                  durationDays={Math.round(record.haid_duration_hours / 24)} 
                  cycleDays={record.tuhr_duration_days + Math.round(record.haid_duration_hours / 24)} 
                  isRTL={isRTL}
                  t={t}
                  last={i === Math.min(ledger.length, 5) - 1}
                  onClick={() => setSelectedHistory({ 
                    startDate: new Date(record.haid_start),
                    endDate: record.haid_end ? new Date(record.haid_end) : null,
                    durationDays: Math.round(record.haid_duration_hours / 24),
                    cycleDays: record.tuhr_duration_days + Math.round(record.haid_duration_hours / 24)
                  })}
                />
              ))
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
                        {isRTL 
                          ? `${selectedHistory.durationDays.toLocaleString('en-US')} أيام` 
                          : `${selectedHistory.durationDays} days`}
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
  const dateRange = `${dateFormatter.format(startDate)} – ${dateFormatter.format(endDate)}`;
  
  const formattedDuration = isRTL 
    ? `${durationDays.toLocaleString('en-US')} أيام` 
    : `${durationDays} days`;
    
  const formattedCycle = isRTL
    ? `${cycleDays.toLocaleString('en-US')} يوماً`
    : `${cycleDays} days`;

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
