/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Madhhab, State } from './types.ts';
import { toGregorian } from 'hijri-converter';

export const MADHAB_RULES = {
  HANAFI: { haidMin: 72, haidMax: 240, tuhrMin: 360 },
  SHAFII: { haidMin: 24, haidMax: 360, tuhrMin: 360 },
  MALIKI: { haidMin: 0, haidMax: 360, tuhrMin: 360 },
  HANBALI: { haidMin: 24, haidMax: 360, tuhrMin: 312 },
};

// Part B — TRANSITION RULES

export function calculateFiqhState(entries: any[], madhhab: Madhhab): State {
  if (!entries || entries.length === 0) return 'TAHARA';
  
  // Get all logs where is_predicted !== true
  const actualEntries = entries.filter(e => e.is_predicted === false || e.is_predicted === undefined || e.is_predicted === null);

  if (actualEntries.length === 0) {
    // Predictions only apply if there are zero actual logs
    // For now, return TAHARA as default if no actual logs
    return 'TAHARA';
  }

  const getTimestamp = (entry: any) => {
    if (entry.time_logged && entry.time_logged.includes('T')) {
      try {
        const t = new Date(entry.time_logged).getTime();
        if (!isNaN(t)) return t;
      } catch (e) {}
    }
    
    const time = entry.time_logged || '00:00:00';
    try {
      const parts = time.split(':');
      const formattedTime = parts.length === 2 ? `${time}:00` : (parts.length === 3 ? time : '00:00:00');
      const t = new Date(`${entry.date}T${formattedTime}`).getTime();
      if (!isNaN(t)) return t;
    } catch (e) {}
    return new Date(entry.date).getTime();
  };

  // Sort by date descending
  const sorted = [...actualEntries].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  
  // Take the most recent one
  const latest = sorted[0];
  
  // If its flow is anything other than "none" or null -> return HAID
  if (latest.flow_intensity && latest.flow_intensity !== 'none') {
    return 'HAID';
  }

  // If it explicitly marks end of period -> return TAHARA
  // (In this app, intensity 'none' is the end of period)
  if (latest.flow_intensity === 'none') {
    return 'TAHARA';
  }

  return 'TAHARA';
}

export function detectIstihadah(entries: any[], madhhab: Madhhab, adah: { duration: number }): boolean {
  const rules = MADHAB_RULES[madhhab];
  const validAdah = adah.duration > 0 &&
    (rules.haidMin === 0 || adah.duration * 24 >= rules.haidMin) &&
    adah.duration * 24 <= rules.haidMax;
  const effectiveAdahDays = validAdah ? adah.duration : Math.floor(rules.haidMax / 24);

  // Logic to detect if current bleeding exceeds haidMax or adah
  // For now returning false as placeholder for complex logic
  return false;
}

export function getGhuslSteps(madhhab: Madhhab): { fard: string[], sunnah: string[] } {
  const commonSunnah = [
    'التسمية في البداية',
    'غسل اليدين ثلاثاً',
    'غسل الفرج وما حوله',
    'الوضوء الكامل قبل الغسل',
    'تخليل أصول الشعر بالماء',
    'إفاضة الماء على الرأس ثلاثاً',
    'إفاضة الماء على سائر الجسد',
    'البدء بالجانب الأيمن ثم الأيسر'
  ];

  const commonFard = ['النية', 'تعميم الجسد بالماء'];

  if (madhhab === 'HANAFI') {
    return {
      fard: [...commonFard, 'المضمضة', 'الاستنشاق'],
      sunnah: commonSunnah
    };
  }

  if (madhhab === 'MALIKI') {
    return {
      fard: [...commonFard, 'الدلك', 'الموالاة'],
      sunnah: commonSunnah
    };
  }

  if (madhhab === 'SHAFII' || madhhab === 'HANBALI') {
    return {
      fard: commonFard,
      sunnah: [...commonSunnah, 'المضمضة والاستنشاق (عند الحنابلة واجب)']
    };
  }

  return { fard: commonFard, sunnah: commonSunnah };
}

export function calculateRamadanQadha(allEntries: any[], hijriYear: number): number {
  // Find Gregorian dates for Ramadan month 9 of hijriYear
  const ramadanStart = toGregorian(hijriYear, 9, 1);
  const ramadanEnd = toGregorian(hijriYear, 10, 1); // Roughly

  const startDate = new Date(ramadanStart.gy, ramadanStart.gm - 1, ramadanStart.gd);
  const endDate = new Date(ramadanEnd.gy, ramadanEnd.gm - 1, ramadanEnd.gd);

  const ramadanEntries = allEntries.filter(e => {
    const d = new Date(e.date);
    return d >= startDate && d < endDate && e.fiqh_state === 'HAID';
  });

  // Count unique days of HAID during Ramadan
  const uniqueDays = new Set(ramadanEntries.map(e => e.date));
  return uniqueDays.size;
}
