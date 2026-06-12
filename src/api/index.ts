/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from 'crypto-js';
import { supabase } from '../supabase';
import { getAuthUser, signOut } from '../auth';
import * as logic from '../logic/index';
import {
  DBUser,
  DBCycleEntry,
  DBSymptomLog,
  DBPrayerLog,
  DBAdahLedger,
  DBNifasRecord,
  DBRamadanRecord,
  DBPregnancyRecord,
  DBChatMessage,
  DBCommunityComment,
  DBCommunityPost,
} from './db-types.ts';

export type { DBCycleEntry } from './db-types';
export type ApiResponse<T> = { data: T | null; error: string | null };

const hashEmail = (email: string) => CryptoJS.SHA256(email).toString();
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dayMs = 24 * 60 * 60 * 1000;

function cleanObject<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function getScopedLocalUser(authUser: Awaited<ReturnType<typeof getAuthUser>>): DBUser | null {
  const localUser = readLocal<DBUser | null>('niswah_local_user', null);
  if (!authUser) return localUser;
  if (localUser?.id === authUser.id) return localUser;

  localStorage.removeItem('niswah_local_user');
  localStorage.removeItem('niswah_local_entries');
  return null;
}

const normalizeNotificationPrefs = (prefs: Record<string, any> = {}) => ({
  ...prefs,
  prayer_alerts: prefs.prayer_alerts ?? prefs.prayer_updates ?? false,
  haid_prediction_alerts: prefs.haid_prediction_alerts ?? prefs.period_prediction ?? false,
  ghusl_reminders: prefs.ghusl_reminders ?? prefs.ghusl_reminder ?? false,
  daily_insight_alerts: prefs.daily_insight_alerts ?? prefs.daily_insights ?? false,
});

const userFromDb = (row: any): DBUser => ({
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

const userToDb = (user: Partial<DBUser>) => cleanObject({
  id: user.id,
  email_hash: user.email_hash,
  madhhab: user.madhhab,
  language: user.language,
  birth_year: user.birth_year,
  display_name: user.display_name,
  anonymous_mode: user.anonymous_mode,
  onboarding_completed: user.onboarding_completed,
  premium_status: user.premium_status,
  premium_expires_at: user.premium_expires_at,
  avg_cycle_length: user.avg_cycle_length,
  avg_haid_duration: user.avg_haid_duration,
  known_adah_days: user.known_adah_days,
  adah_confidence: user.adah_confidence,
  goal_flags: user.goal_flags,
  conditions: user.conditions,
  notification_prefs: user.notification_prefs,
  pregnant: user.pregnant,
  pregnancy_week: user.pregnancy_week,
  reflect_health: user.reflect_health,
  prayer_city: user.prayerCity,
  prayer_country: user.prayerCountry,
  prayer_city_ar: user.prayerCityAr,
  prayer_country_ar: user.prayerCountryAr,
  prayer_lat: user.prayerLat,
  prayer_lon: user.prayerLon,
  location_lat: user.location_lat ?? user.prayerLat,
  location_lng: user.location_lng ?? user.prayerLon,
  location_name: user.location_name,
  manual_prayer_offsets: user.manual_prayer_offsets,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const ensureUser = async () => {
  const user = await getAuthUser();
  if (!user) return null;
  return user;
};

const toDateInputValue = (date: Date) => date.toISOString().split('T')[0];

const estimateLmpFromWeek = (week: number) => {
  const clampedWeek = Math.min(40, Math.max(1, Math.round(week || 1)));
  return new Date(Date.now() - (clampedWeek - 1) * 7 * dayMs);
};

const calculatePregnancyWeek = (record: DBPregnancyRecord, fallbackWeek = 1) => {
  if (!record.lmp_date) return Math.min(40, Math.max(1, record.current_week || fallbackWeek || 1));
  const lmp = new Date(record.lmp_date);
  if (Number.isNaN(lmp.getTime())) return Math.min(40, Math.max(1, record.current_week || fallbackWeek || 1));
  return Math.min(40, Math.max(1, Math.floor((Date.now() - lmp.getTime()) / (7 * dayMs)) + 1));
};

async function getActivePregnancyRecordForUser(userId: string): Promise<ApiResponse<DBPregnancyRecord>> {
  const { data, error } = await supabase
    .from('pregnancy_records')
    .select('*')
    .eq('user_id', userId)
    .is('birth_date', null)
    .limit(1)
    .maybeSingle();

  return error ? { data: null, error: error.message } : { data: data as DBPregnancyRecord | null, error: null };
}

export async function getUser(): Promise<ApiResponse<DBUser>> {
  const authUser = await ensureUser();
  const localUser = getScopedLocalUser(authUser);
  if (!authUser) return { data: localUser, error: null };

  const { data, error } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
  if (error) {
    console.warn('Supabase getUser failed, falling back to local storage:', error.message);
    return localUser ? { data: localUser, error: null } : { data: null, error: error.message };
  }

  if (!data) return { data: null, error: null };
  const mapped = userFromDb(data);
  const activePregnancy = await getActivePregnancyRecordForUser(authUser.id);
  if (activePregnancy.data) {
    mapped.pregnant = true;
    mapped.pregnancy_week = calculatePregnancyWeek(activePregnancy.data, mapped.pregnancy_week || 1);
  } else {
    mapped.pregnant = false;
    mapped.pregnancy_week = 0;
  }
  localStorage.setItem('niswah_local_user', JSON.stringify(mapped));
  return { data: mapped, error: null };
}

export async function upsertUser(updates: Partial<DBUser>): Promise<ApiResponse<DBUser>> {
  const authUser = await ensureUser();
  const defaults: Partial<DBUser> = {
    birth_year: 1995,
    display_name: authUser?.user_metadata?.display_name || authUser?.user_metadata?.full_name || 'Sister',
    anonymous_mode: false,
    onboarding_completed: false,
    premium_status: true,
    adah_confidence: 0,
    prayerCity: '',
    prayerCountry: '',
    prayerCityAr: '',
    prayerCountryAr: '',
    prayerLat: 0,
    prayerLon: 0,
    goal_flags: [],
    conditions: [],
    notification_prefs: {},
    created_at: new Date().toISOString(),
  };

  const userData: DBUser = {
    ...defaults,
    ...cleanObject(updates),
    id: authUser?.id || 'demo-user-id',
    email_hash: hashEmail(authUser?.email || 'anonymous'),
    updated_at: new Date().toISOString(),
  } as DBUser;

  localStorage.setItem('niswah_local_user', JSON.stringify(userData));
  if (!authUser) return { data: userData, error: null };

  const { error } = await supabase.from('users').upsert(userToDb(userData), { onConflict: 'id' });
  if (error) {
    console.warn('Supabase upsertUser failed, keeping local copy:', error.message);
  }

  return { data: userData, error: null };
}

async function buildUserProfileFromAuth(authUser: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>, updates: Partial<DBUser>): Promise<DBUser> {
  const defaults: Partial<DBUser> = {
    birth_year: 1995,
    display_name: authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || 'Sister',
    anonymous_mode: false,
    onboarding_completed: false,
    premium_status: true,
    avg_cycle_length: 28,
    avg_haid_duration: 5,
    adah_confidence: 0,
    prayerCity: '',
    prayerCountry: '',
    prayerCityAr: '',
    prayerCountryAr: '',
    prayerLat: 0,
    prayerLon: 0,
    goal_flags: [],
    conditions: [],
    notification_prefs: {},
    pregnant: false,
    pregnancy_week: 0,
    reflect_health: false,
    created_at: new Date().toISOString(),
  };

  return {
    ...defaults,
    ...cleanObject(updates),
    id: authUser.id,
    email_hash: hashEmail(authUser.email || 'anonymous'),
    updated_at: new Date().toISOString(),
  } as DBUser;
}

export async function updateUser(updates: Partial<DBUser>): Promise<ApiResponse<DBUser>> {
  const authUser = await ensureUser();
  const localUser = getScopedLocalUser(authUser);
  const nextLocal = localUser
    ? { ...localUser, ...cleanObject(updates), updated_at: new Date().toISOString() } as DBUser
    : null;

  if (nextLocal) localStorage.setItem('niswah_local_user', JSON.stringify(nextLocal));
  if (!authUser) return { data: nextLocal, error: null };

  const { data, error } = await supabase
    .from('users')
    .update(userToDb({ ...updates, updated_at: new Date().toISOString() }))
    .eq('id', authUser.id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    const repairedUser = nextLocal || await buildUserProfileFromAuth(authUser, updates);
    const { data: upserted, error: upsertError } = await supabase
      .from('users')
      .upsert(userToDb(repairedUser), { onConflict: 'id' })
      .select('*')
      .single();

    if (upsertError) {
      console.warn('Supabase updateUser failed:', upsertError.message || error?.message);
      return { data: nextLocal, error: upsertError.message || error?.message || 'Profile update failed' };
    }

    const mapped = userFromDb(upserted);
    localStorage.setItem('niswah_local_user', JSON.stringify(mapped));
    return { data: mapped, error: null };
  }

  const mapped = data ? userFromDb(data) : nextLocal;
  if (mapped) localStorage.setItem('niswah_local_user', JSON.stringify(mapped));
  return { data: mapped, error: null };
}

export async function ensurePregnancyRecord(currentWeek = 1): Promise<ApiResponse<DBPregnancyRecord>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const lmpDate = estimateLmpFromWeek(currentWeek);
  const dueDate = new Date(lmpDate.getTime() + 280 * dayMs);
  const payload = {
    current_week: Math.min(40, Math.max(1, Math.round(currentWeek || 1))),
    lmp_date: toDateInputValue(lmpDate),
    due_date: toDateInputValue(dueDate),
  };

  const existing = await getActivePregnancyRecordForUser(authUser.id);
  if (existing.error) return existing;
  if (existing.data) {
    const { data, error } = await supabase
      .from('pregnancy_records')
      .update(payload)
      .eq('id', existing.data.id)
      .select('*')
      .single();

    return error ? { data: null, error: error.message } : { data: data as DBPregnancyRecord, error: null };
  }

  const { data, error } = await supabase
    .from('pregnancy_records')
    .insert({
      user_id: authUser.id,
      ...payload,
      weekly_notes: {},
    })
    .select('*')
    .single();

  return error ? { data: null, error: error.message } : { data: data as DBPregnancyRecord, error: null };
}

export async function getActivePregnancyRecord(): Promise<ApiResponse<DBPregnancyRecord>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };
  return getActivePregnancyRecordForUser(authUser.id);
}

export async function updatePregnancyNotes(notes: Record<string, any>): Promise<ApiResponse<DBPregnancyRecord>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const existing = await getActivePregnancyRecordForUser(authUser.id);
  if (existing.error) return existing;
  if (!existing.data) return { data: null, error: 'No active pregnancy record' };

  const weeklyNotes = {
    ...(existing.data.weekly_notes || {}),
    ...notes,
    updatedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('pregnancy_records')
    .update({ weekly_notes: weeklyNotes })
    .eq('id', existing.data.id)
    .select('*')
    .single();

  return error ? { data: null, error: error.message } : { data: data as DBPregnancyRecord, error: null };
}

export async function clearActivePregnancyRecords(): Promise<ApiResponse<null>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { error } = await supabase
    .from('pregnancy_records')
    .delete()
    .eq('user_id', authUser.id)
    .is('birth_date', null);

  return error ? { data: null, error: error.message } : { data: null, error: null };
}

export async function logCycleEntry(entry: Partial<DBCycleEntry>): Promise<ApiResponse<DBCycleEntry>> {
  const authUser = await ensureUser();
  const entryData: DBCycleEntry = {
    flow_intensity: 'medium',
    blood_color: 'red',
    blood_thickness: 'normal',
    kursuf_used: false,
    discharge_internal: false,
    is_predicted: false,
    prediction_confidence: 1,
    created_at: new Date().toISOString(),
    ...cleanObject(entry),
    user_id: authUser?.id || 'demo-user-id',
    id: entry.id || crypto.randomUUID(),
  } as DBCycleEntry;

  const existingEntries = readLocal<DBCycleEntry[]>('niswah_local_entries', []);
  const index = existingEntries.findIndex(e => (e.id && e.id === entryData.id) || (e.date === entryData.date && e.fiqh_state === entryData.fiqh_state));
  if (index >= 0) existingEntries[index] = entryData;
  else existingEntries.push(entryData);
  localStorage.setItem('niswah_local_entries', JSON.stringify(existingEntries));

  if (!authUser) return { data: entryData, error: null };

  const payload = cleanObject({
    ...entryData,
    id: uuidRegex.test(entryData.id) ? entryData.id : undefined,
    user_id: authUser.id,
  });

  const { data, error } = await supabase.from('cycle_entries').upsert(payload, { onConflict: 'id' }).select('*').single();
  if (error) {
    console.warn('Supabase logCycleEntry failed, keeping local copy:', error.message);
    return { data: entryData, error: null };
  }

  const saved = data as DBCycleEntry;
  const updatedEntries = readLocal<DBCycleEntry[]>('niswah_local_entries', []);
  const localIdx = updatedEntries.findIndex(e => e.id === entryData.id || (e.date === entryData.date && e.fiqh_state === entryData.fiqh_state));
  if (localIdx >= 0) {
    updatedEntries[localIdx] = saved;
    localStorage.setItem('niswah_local_entries', JSON.stringify(updatedEntries));
  }
  return { data: saved, error: null };
}

export async function logSymptoms(symptoms: Partial<DBSymptomLog>[]): Promise<ApiResponse<DBSymptomLog[]>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const rows = symptoms.map(symptom => cleanObject({ ...symptom, user_id: authUser.id }));
  const { data, error } = await supabase.from('symptoms_log').insert(rows).select('*');
  return error ? { data: null, error: error.message } : { data: data as DBSymptomLog[], error: null };
}

export async function updatePrayerStatus(prayer: string, status: string, date: string): Promise<ApiResponse<DBPrayerLog>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const prayerData = {
    id: `${authUser.id}_${date}_${prayer}`,
    user_id: authUser.id,
    date,
    prayer_name: prayer as DBPrayerLog['prayer_name'],
    status: status as DBPrayerLog['status'],
  };
  const { data, error } = await supabase.from('prayer_log').upsert(prayerData, { onConflict: 'id' }).select('*').single();
  return error ? { data: null, error: error.message } : { data: data as DBPrayerLog, error: null };
}

export async function getCalendarData(month: number, year: number): Promise<ApiResponse<DBCycleEntry[]>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('cycle_entries')
    .select('*')
    .eq('user_id', authUser.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .order('time_logged', { ascending: false });
  return error ? { data: null, error: error.message } : { data: data as DBCycleEntry[], error: null };
}

export async function getCycleEntries(): Promise<ApiResponse<DBCycleEntry[]>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('cycle_entries')
    .select('*')
    .eq('user_id', authUser.id)
    .order('date', { ascending: false })
    .order('time_logged', { ascending: false });
  return error ? { data: null, error: error.message } : { data: data as DBCycleEntry[], error: null };
}

export async function getAdahLedger(): Promise<ApiResponse<DBAdahLedger[]>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('adah_ledger')
    .select('*')
    .eq('user_id', authUser.id)
    .order('cycle_number', { ascending: false });
  return error ? { data: null, error: error.message } : { data: data as DBAdahLedger[], error: null };
}

export async function getInsightsData(): Promise<ApiResponse<any>> {
  const { data: user } = await getUser();
  if (!user) return { data: null, error: 'User not found' };
  return {
    data: {
      avgCycleLength: user.avg_cycle_length,
      avgHaidDuration: user.avg_haid_duration,
      adahConfidence: user.adah_confidence,
    },
    error: null,
  };
}

export function mapDBUserToLogicUser(userData: DBUser, ledger: DBAdahLedger[] = []): logic.User {
  if (!userData) throw new Error('Cannot map null user data');

  const logicLedger: logic.AdahRecord[] = (ledger || []).map(l => {
    const start = l.haid_start ? new Date(l.haid_start).getTime() : Date.now();
    const end = l.haid_end ? new Date(l.haid_end).getTime() : 0;
    return {
      cycleNumber: l.cycle_number || 0,
      haidStart: isNaN(start) ? Date.now() : start,
      haidEnd: isNaN(end) ? 0 : end,
      haidDurationHours: l.haid_duration_hours || 0,
      tuhrDurationDays: l.tuhr_duration_days || 0,
      bloodColorPattern: l.blood_color_pattern || [],
      bloodThicknessPattern: l.blood_thickness_pattern || [],
      istihadahEpisode: l.istihadah_episode || false,
      scholarConsulted: l.scholar_consulted || false,
    };
  });

  return {
    id: userData.id || 'unknown',
    madhhab: (userData.madhhab as logic.Madhhab) || 'HANAFI',
    currentState: 'TAHARA',
    stateStartTime: Date.now(),
    knownAdahDays: userData.avg_cycle_length || userData.known_adah_days || 28,
    avgHaidDuration: userData.avg_haid_duration || 5,
    adahConfidence: userData.adah_confidence || 0,
    adahLedger: logicLedger,
    prayerCity: userData.prayerCity || '',
    prayerCountry: userData.prayerCountry || '',
    prayerCityAr: userData.prayerCityAr || '',
    prayerCountryAr: userData.prayerCountryAr || '',
    prayerLat: userData.prayerLat,
    prayerLon: userData.prayerLon,
    locationName: userData.location_name || '',
    manualPrayerOffsets: userData.manual_prayer_offsets || {},
    pregnant: userData.pregnant || false,
    pregnancy_week: userData.pregnancy_week || 0,
    reflect_health: userData.reflect_health || false,
    conditions: userData.conditions || [],
    display_name: userData.display_name || '',
    anonymous_mode: userData.anonymous_mode || false,
    onboarding_completed: userData.onboarding_completed || false,
    notification_prefs: userData.notification_prefs || {},
    language: userData.language || 'ar',
    qadhaFastingDays: 0,
    qadhaCompleted: 0,
    qadhaRemaining: 0,
    pendingBloodStart: null,
  };
}

export async function getPredictions(): Promise<ApiResponse<logic.PredictionResult>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data: ledger } = await getAdahLedger();
  const { data: userData } = await getUser();
  if (!userData) return { data: null, error: 'User not found' };
  return { data: logic.predictNextPeriod(mapDBUserToLogicUser(userData, ledger || [])), error: null };
}

export async function markGhusulComplete(timestamp: number): Promise<ApiResponse<any>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  await updateUser({ updated_at: new Date().toISOString() } as Partial<DBUser>);
  return logCycleEntry({
    date: new Date(timestamp).toISOString().split('T')[0],
    time_logged: new Date(timestamp).toISOString(),
    fiqh_state: 'TAHARA',
  });
}

export async function logBirthEvent(timestamp: number): Promise<ApiResponse<DBNifasRecord>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data: userData } = await getUser();
  if (!userData) return { data: null, error: 'User not found' };

  const maxDays = userData.madhhab === 'MALIKI' ? 60 : 40;
  const nifasData = {
    user_id: authUser.id,
    birth_date: new Date(timestamp).toISOString(),
    madhhab_max_days: maxDays,
    expected_end: new Date(timestamp + maxDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };
  const { data, error } = await supabase.from('nifas_records').insert(nifasData).select('*').single();
  return error ? { data: null, error: error.message } : { data: data as DBNifasRecord, error: null };
}

export async function getRamadanData(hijriYear: number): Promise<ApiResponse<DBRamadanRecord>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('ramadan_records')
    .select('*')
    .eq('user_id', authUser.id)
    .eq('hijri_year', hijriYear)
    .maybeSingle();
  return error ? { data: null, error: error.message } : { data: data as DBRamadanRecord | null, error: null };
}

export async function updateQadhaSchedule(dates: string[]): Promise<ApiResponse<DBRamadanRecord>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('ramadan_records')
    .update({ qadha_schedule: dates })
    .eq('user_id', authUser.id)
    .select('*')
    .limit(1)
    .maybeSingle();
  return error ? { data: null, error: error.message } : { data: data as DBRamadanRecord | null, error: data ? null : 'Ramadan record not found' };
}

export async function generateFiqhReportPDF(): Promise<ApiResponse<string>> {
  return { data: null, error: 'Use the client-side report generator in components/Reports.tsx.' };
}

export async function generateDoctorReportPDF(): Promise<ApiResponse<string>> {
  return { data: null, error: 'Use the client-side report generator in components/Reports.tsx.' };
}

export async function deleteAccount(): Promise<ApiResponse<boolean>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { data: false, error: error.message };

  localStorage.removeItem('niswah_local_user');
  localStorage.removeItem('niswah_local_entries');
  await signOut();
  return { data: true, error: null };
}

function mapChatMessage(row: any): DBChatMessage {
  return {
    id: row.id,
    user_id: row.user_id,
    chat_type: row.chat_type,
    role: row.role,
    text: row.text || row.content || '',
    content: row.content,
    timestamp: row.timestamp,
  };
}

function mapCommunityPost(row: any): DBCommunityPost {
  const likeUserIds = Array.isArray(row.like_user_ids) ? row.like_user_ids.filter(Boolean) : [];
  const comments = Array.isArray(row.comments) ? row.comments : [];

  return {
    id: row.id,
    author_id: row.author_id,
    author_name: row.author_name || '',
    category: row.category || 'general',
    content: row.content || '',
    is_anonymous: Boolean(row.is_anonymous),
    like_user_ids: likeUserIds,
    comments: comments.map((comment: any) => ({
      id: comment.id || crypto.randomUUID(),
      author_id: comment.author_id || '',
      author_name: comment.author_name || 'Sister',
      is_anonymous: Boolean(comment.is_anonymous),
      content: comment.content || '',
      created_at: comment.created_at || row.created_at,
    })),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getCommunityPosts(): Promise<ApiResponse<DBCommunityPost[]>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: [], error: null };

  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return error ? { data: null, error: error.message } : { data: (data || []).map(mapCommunityPost), error: null };
}

export async function createCommunityPost(input: {
  content: string;
  category: DBCommunityPost['category'];
  is_anonymous: boolean;
}): Promise<ApiResponse<DBCommunityPost>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  let { data: profile } = await getUser();
  if (!profile) {
    const repaired = await upsertUser({
      display_name: authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || 'Sister',
      premium_status: true,
    });
    profile = repaired.data;
  }

  const payload = {
    author_id: authUser.id,
    author_name: input.is_anonymous ? null : (profile?.display_name || authUser.user_metadata?.display_name || 'Sister'),
    content: input.content.trim(),
    category: input.category,
    is_anonymous: input.is_anonymous,
    like_user_ids: [],
    comments: [],
  };

  const insertPost = () => supabase
    .from('community_posts')
    .insert(payload)
    .select('*')
    .single();

  let { data, error } = await insertPost();
  if (error && /foreign key|community_posts_author_id_fkey|violates/i.test(error.message)) {
    await upsertUser({
      display_name: profile?.display_name || authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || 'Sister',
      premium_status: true,
    });
    const retry = await insertPost();
    data = retry.data;
    error = retry.error;
  }

  return error ? { data: null, error: error.message } : { data: mapCommunityPost(data), error: null };
}

export async function toggleCommunityPostLike(post: DBCommunityPost): Promise<ApiResponse<DBCommunityPost>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const existingLikes = Array.isArray(post.like_user_ids) ? post.like_user_ids : [];
  const nextLikes = existingLikes.includes(authUser.id)
    ? existingLikes.filter(id => id !== authUser.id)
    : [...existingLikes, authUser.id];

  const { data, error } = await supabase
    .from('community_posts')
    .update({ like_user_ids: nextLikes, updated_at: new Date().toISOString() })
    .eq('id', post.id)
    .select('*')
    .single();

  return error ? { data: null, error: error.message } : { data: mapCommunityPost(data), error: null };
}

export async function addCommunityComment(post: DBCommunityPost, content: string, isAnonymous = false): Promise<ApiResponse<DBCommunityPost>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data: profile } = await getUser();
  const nextComment: DBCommunityComment = {
    id: crypto.randomUUID(),
    author_id: authUser.id,
    author_name: isAnonymous ? 'Sister' : (profile?.display_name || authUser.user_metadata?.display_name || 'Sister'),
    is_anonymous: isAnonymous,
    content: content.trim(),
    created_at: new Date().toISOString(),
  };
  const nextComments = [...(post.comments || []), nextComment];

  const { data, error } = await supabase
    .from('community_posts')
    .update({ comments: nextComments, updated_at: new Date().toISOString() })
    .eq('id', post.id)
    .select('*')
    .single();

  return error ? { data: null, error: error.message } : { data: mapCommunityPost(data), error: null };
}

export async function saveChatMessage(message: Omit<DBChatMessage, 'id' | 'user_id'>): Promise<ApiResponse<DBChatMessage>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const messageData = {
    chat_type: message.chat_type,
    role: message.role,
    content: message.text,
    user_id: authUser.id,
    timestamp: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('chat_history').insert(messageData).select('*').single();
  return error ? { data: null, error: error.message } : { data: mapChatMessage(data), error: null };
}

export async function getChatHistory(chatType: DBChatMessage['chat_type']): Promise<ApiResponse<DBChatMessage[]>> {
  const authUser = await ensureUser();
  if (!authUser) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('user_id', authUser.id)
    .eq('chat_type', chatType)
    .order('timestamp', { ascending: true });
  return error ? { data: null, error: error.message } : { data: (data || []).map(mapChatMessage), error: null };
}
