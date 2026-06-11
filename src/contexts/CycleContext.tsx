/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { clearLocalSessionCache, onAuthStateChanged } from '../auth.ts';
import { supabase } from '../supabase.ts';
import * as api from '../api/index.ts';
import * as logic from '../logic/index.ts';
import { notificationService } from '../services/NotificationService.ts';
import { State, User, CycleEntry, AdahRecord, Madhhab, PrayerTime, CycleStats, PredictionResult, OvulationResult } from '../logic/types.ts';
import { DBCycleEntry, DBAdahLedger, DBUser, DBPrayerLog } from '../api/db-types.ts';

interface CycleContextType {
  user: User | null;
  entries: DBCycleEntry[];
  ledger: DBAdahLedger[];
  prayers: DBPrayerLog[];
  prayerTimes: PrayerTime[];
  prayerTimesLoading: boolean;
  prayerTimesError: string | null;
  fiqhState: State;
  currentDay: number;
  cycleStats: CycleStats;
  prediction: PredictionResult | null;
  ovulation: OvulationResult | null;
  loading: boolean;
  nextPeriodDate: string | null;
  refresh: () => Promise<void>;
  updatePrayerTimes: (force?: boolean) => Promise<void>;
}

const CycleContext = createContext<CycleContextType | undefined>(undefined);

const readLocalJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch (e) {
    console.error(`Failed to parse ${key}`, e);
    return fallback;
  }
};

const readScopedLocalUser = (authUser: any): DBUser | null => {
  const localUser = readLocalJson<DBUser | null>('niswah_local_user', null);
  if (!authUser) return localUser;
  return localUser?.id === authUser.id ? localUser : null;
};

const normalizeNotificationPrefs = (prefs: Record<string, any> = {}) => ({
  ...prefs,
  prayer_alerts: prefs.prayer_alerts ?? prefs.prayer_updates ?? false,
  haid_prediction_alerts: prefs.haid_prediction_alerts ?? prefs.period_prediction ?? false,
  ghusl_reminders: prefs.ghusl_reminders ?? prefs.ghusl_reminder ?? false,
  daily_insight_alerts: prefs.daily_insight_alerts ?? prefs.daily_insights ?? false,
});

const userFromSupabase = (row: any): DBUser => ({
  id: row.id,
  email_hash: row.email_hash || '',
  madhhab: row.madhhab || 'HANBALI',
  language: row.language || 'ar',
  birth_year: row.birth_year || 1995,
  display_name: row.display_name || 'Sister',
  anonymous_mode: row.anonymous_mode ?? false,
  onboarding_completed: row.onboarding_completed ?? false,
  premium_status: row.premium_status ?? true,
  premium_expires_at: row.premium_expires_at || null,
  avg_cycle_length: row.avg_cycle_length || 28,
  avg_haid_duration: row.avg_haid_duration || 5,
  known_adah_days: row.known_adah_days ?? null,
  adah_confidence: row.adah_confidence || 0,
  goal_flags: row.goal_flags || [],
  conditions: row.conditions || [],
  notification_prefs: normalizeNotificationPrefs(row.notification_prefs || {}),
  pregnant: row.pregnant || false,
  pregnancy_week: row.pregnancy_week || 0,
  reflect_health: row.reflect_health || false,
  prayerCity: row.prayer_city || '',
  prayerCountry: row.prayer_country || '',
  prayerCityAr: row.prayer_city_ar || '',
  prayerCountryAr: row.prayer_country_ar || '',
  prayerLat: row.prayer_lat ?? row.location_lat ?? 0,
  prayerLon: row.prayer_lon ?? row.location_lng ?? 0,
  location_lat: row.location_lat ?? row.prayer_lat ?? 0,
  location_lng: row.location_lng ?? row.prayer_lon ?? 0,
  location_name: row.location_name || '',
  manual_prayer_offsets: row.manual_prayer_offsets || {},
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const CycleProvider = ({ children }: { children: ReactNode }) => {
  const t = useCallback((key: string) => key, []);
  const [dbUser, setDbUser] = useState<DBUser | null>(null);
  const [entries, setEntries] = useState<DBCycleEntry[]>([]);
  const [ledger, setLedger] = useState<DBAdahLedger[]>([]);
  const [prayers, setPrayers] = useState<DBPrayerLog[]>([]);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [prayerTimesLoading, setPrayerTimesLoading] = useState(false);
  const [prayerTimesError, setPrayerTimesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const clearUserState = useCallback(() => {
    setDbUser(null);
    setEntries([]);
    setLedger([]);
    setPrayers([]);
  }, []);

  // Derived states using useMemo to avoid stale data and satisfy Scenario 5
  const user = useMemo(() => {
    if (!dbUser || !dbUser.id) return null;
    try {
      return api.mapDBUserToLogicUser(dbUser, ledger);
    } catch (e) {
      console.error("Mapping failed in CycleContext", e);
      return null;
    }
  }, [dbUser, ledger]);

  const fiqhState = useMemo(() => {
    if (!dbUser || !dbUser.madhhab) return 'TAHARA' as State;
    try {
      return logic.calculateFiqhState(entries, dbUser.madhhab as Madhhab);
    } catch (e) {
      return 'TAHARA' as State;
    }
  }, [entries, dbUser?.madhhab]);

  const cycleStats = useMemo(() => {
    if (!user) {
      return {
        currentDay: 1,
        daysUntilNext: 27,
        isOverdue: false,
        overdueDays: 0,
        progress: 0,
        avgCycleLength: 28,
        avgPeriodLength: 5,
        regularity: null,
        lastPeriodDate: null
      } as CycleStats;
    }
    return logic.calculateCycleStats(entries, user);
  }, [entries, user]);

  const currentDay = cycleStats.currentDay;

  const prediction = useMemo(() => {
    if (!user) return null;
    return logic.predictNextPeriod(user);
  }, [user]);

  const nextPeriodDate = prediction?.nextPeriodDate || null;

  const ovulation = useMemo(() => {
    if (!user) return null;
    return logic.predictOvulation(user);
  }, [user]);

  const loadInitialData = useCallback(async () => {
    if (authUser) {
      setLoading(false);
      return;
    }

    const hasLocalUser = localStorage.getItem('niswah_local_user') !== null;
    const hasLocalEntries = localStorage.getItem('niswah_local_entries') !== null;

    if (hasLocalUser) {
      setDbUser(readLocalJson<DBUser | null>('niswah_local_user', null));
    } else if (!authUser) {
      setDbUser(null);
    }

    if (hasLocalEntries) {
      setEntries(readLocalJson<DBCycleEntry[]>('niswah_local_entries', []));
    } else if (!authUser) {
      setEntries([]);
    }

    setLoading(false);
  }, [authUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      setAuthUser((previousUser: any) => {
        if (previousUser?.id !== user?.id) {
          clearUserState();
          if (!user) clearLocalSessionCache();
        }
        return user;
      });
      if (!user) {
        setLoading(false);
      } else {
        setLoading(true);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [clearUserState]);

  const loadRemoteData = useCallback(async () => {
    if (!authUser) return;

    try {
      const localUser = readScopedLocalUser(authUser);
      const [{ data: userData, error: userError }, { data: entryRows, error: entriesError }, { data: ledgerRows, error: ledgerError }, { data: prayerRows, error: prayersError }] = await Promise.all([
        api.getUser(),
        supabase.from('cycle_entries').select('*').eq('user_id', authUser.id).order('date', { ascending: false }).order('time_logged', { ascending: false }),
        supabase.from('adah_ledger').select('*').eq('user_id', authUser.id).order('cycle_number', { ascending: false }),
        supabase.from('prayer_log').select('*').eq('user_id', authUser.id).order('date', { ascending: false }),
      ]);

      if (userError) throw new Error(userError);
      if (entriesError) throw entriesError;
      if (ledgerError) throw ledgerError;
      if (prayersError) throw prayersError;

      if (userData?.id === authUser.id) {
        setDbUser(userData);
        localStorage.setItem('niswah_local_user', JSON.stringify(userData));
      } else {
        setDbUser(null);
        if (!localUser) localStorage.removeItem('niswah_local_user');
      }

      const remoteEntries = (entryRows || []) as DBCycleEntry[];
      setEntries(remoteEntries);
      localStorage.setItem('niswah_local_entries', JSON.stringify(remoteEntries));
      setLedger((ledgerRows || []) as DBAdahLedger[]);
      setPrayers((prayerRows || []) as DBPrayerLog[]);
    } catch (error) {
      console.error('Supabase realtime bootstrap failed', error);
      const localUser = readScopedLocalUser(authUser);
      const localEntries = readLocalJson<DBCycleEntry[]>('niswah_local_entries', []);
      setDbUser(localUser);
      setEntries(localUser && localEntries.length > 0 ? localEntries : []);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  const refreshData = useCallback(async () => {
    if (!authReady) return;

    if (authUser) {
      await loadRemoteData();
    } else {
      await loadInitialData();
    }
  }, [authReady, authUser, loadInitialData, loadRemoteData]);

  useEffect(() => {
    if (!authReady) return;

    if (!authUser) {
      loadInitialData();
      return;
    }

    loadRemoteData();

    const userChannel = supabase.channel(`user-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${authUser.id}` }, () => {
        api.getUser().then(({ data }) => {
          if (data?.id === authUser.id) {
            setDbUser(data);
            localStorage.setItem('niswah_local_user', JSON.stringify(data));
          }
        });
      })
      .subscribe();

    const pregnancyChannel = supabase.channel(`pregnancy-records-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pregnancy_records', filter: `user_id=eq.${authUser.id}` }, () => {
        api.getUser().then(({ data }) => {
          if (data?.id === authUser.id) {
            setDbUser(data);
            localStorage.setItem('niswah_local_user', JSON.stringify(data));
          }
        });
      })
      .subscribe();

    const entriesChannel = supabase.channel(`cycle-entries-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cycle_entries', filter: `user_id=eq.${authUser.id}` }, () => {
        api.getCycleEntries().then(({ data }) => {
          if (data) {
            setEntries(data);
            localStorage.setItem('niswah_local_entries', JSON.stringify(data));
          }
        });
      })
      .subscribe();

    const ledgerChannel = supabase.channel(`adah-ledger-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adah_ledger', filter: `user_id=eq.${authUser.id}` }, () => {
        api.getAdahLedger().then(({ data }) => data && setLedger(data));
      })
      .subscribe();

    const prayersChannel = supabase.channel(`prayer-log-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prayer_log', filter: `user_id=eq.${authUser.id}` }, async () => {
        const { data } = await supabase.from('prayer_log').select('*').eq('user_id', authUser.id).order('date', { ascending: false });
        if (data) setPrayers(data as DBPrayerLog[]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(pregnancyChannel);
      supabase.removeChannel(entriesChannel);
      supabase.removeChannel(ledgerChannel);
      supabase.removeChannel(prayersChannel);
    };
  }, [authReady, authUser, loadInitialData, loadRemoteData]);

  // Update logic user and state when raw data changes
  // Derived states are now handled by useMemo above

  const updatePrayerTimes = useCallback(async (force: boolean = false) => {
    if (user && (user.prayerCity || (user.prayerLat && user.prayerLon))) {
      setPrayerTimesLoading(true);
      setPrayerTimesError(null);
      try {
        const { times } = await logic.getPrayerTimes(user, new Date(), force);
        if (times.length > 0) {
          setPrayerTimes(times);
          localStorage.setItem('last_prayer_fetch_date', new Date().toISOString().split('T')[0]);
        } else {
          setPrayerTimesError("تعذّر تحميل أوقات الصلاة");
        }
      } catch (err) {
        console.error("Failed to fetch prayer times", err);
        setPrayerTimesError("تعذّر تحميل أوقات الصلاة");
      } finally {
        setPrayerTimesLoading(false);
      }
    }
  }, [user?.prayerCity, user?.prayerCountry, user?.madhhab, user?.manualPrayerOffsets, user?.prayerLat, user?.prayerLon]);

  // Fetch prayer times separately to optimize performance and avoid redundant calls
  useEffect(() => {
    updatePrayerTimes();

    // Check for daily update every hour
    const interval = setInterval(() => {
      const lastFetch = localStorage.getItem('last_prayer_fetch_date');
      const today = new Date().toISOString().split('T')[0];
      if (lastFetch !== today) {
        updatePrayerTimes(true);
        localStorage.setItem('last_prayer_fetch_date', today);
      }
    }, 3600000);

    return () => clearInterval(interval);
  }, [updatePrayerTimes]);

  useEffect(() => {
    if (user && prayerTimes.length > 0) {
      notificationService.schedulePrayerReminders(user, prayerTimes, t);
    }
  }, [user, prayerTimes, t]);

  useEffect(() => {
    if (user && prediction) {
      notificationService.scheduleCycleReminders(user, prediction, t);
    }
  }, [user, prediction, t]);

  useEffect(() => {
    if (user) {
      notificationService.scheduleDailyInsight(user, t);
    }
  }, [user, t]);

  return (
    <CycleContext.Provider value={{ 
      user, 
      entries, 
      ledger, 
      prayers, 
      prayerTimes,
      prayerTimesLoading,
      prayerTimesError,
      fiqhState, 
      currentDay, 
      cycleStats,
      prediction,
      ovulation,
      nextPeriodDate,
      loading,
      updatePrayerTimes,
      refresh: refreshData
    }}>
      {children}
    </CycleContext.Provider>
  );
};

export const useCycleData = () => {
  const context = useContext(CycleContext);
  if (context === undefined) {
    throw new Error('useCycleData must be used within a CycleProvider');
  }
  return context;
};
