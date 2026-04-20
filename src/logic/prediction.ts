/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { addDays, subDays, startOfDay, differenceInDays } from 'date-fns';
import { User, PredictionResult, OvulationResult, CycleStats } from './types.ts';

// Part H — PREDICTION ENGINE

export function getAverageCycleLength(user: User): number {
  const ledger = user.adahLedger || [];
  if (ledger.length === 0) return user.knownAdahDays || 28;
  
  const totalCycleLengthDays = ledger.reduce((sum, cycle) => sum + (cycle.haidDurationHours / 24) + cycle.tuhrDurationDays, 0);
  return totalCycleLengthDays / ledger.length;
}

export function getAverageHaidDuration(user: User): number {
  const ledger = user.adahLedger || [];
  if (ledger.length === 0) return user.avgHaidDuration || 5;
  
  const relevantCycles = ledger.slice(-6);
  const totalHaidDurationDays = relevantCycles.reduce((sum, cycle) => sum + (cycle.haidDurationHours / 24), 0);
  return totalHaidDurationDays / relevantCycles.length;
}

export function predictNextPeriod(user: User): PredictionResult {
  const ledger = user.adahLedger || [];
  if (ledger.length === 0) {
    // Default fallback: 28 day cycle, 5 day period
    const nextStart = addDays(new Date(), 28).getTime();
    return {
      predictedStartDate: nextStart,
      predictedEndDate: addDays(new Date(nextStart), 5).getTime(),
      confidenceScore: 0,
      nextPeriodDate: new Date(nextStart).toISOString()
    };
  }

  const averageCycleLengthDays = getAverageCycleLength(user);
  
  const relevantCycles = ledger.slice(-6);
  const totalHaidDurationDays = relevantCycles.reduce((sum, cycle) => sum + (cycle.haidDurationHours / 24), 0);
  const averageHaidDurationDays = totalHaidDurationDays / relevantCycles.length;

  const lastHaidStart = ledger[ledger.length - 1].haidStart;
  const predictedStartDate = addDays(new Date(lastHaidStart), averageCycleLengthDays).getTime();
  const predictedEndDate = addDays(new Date(predictedStartDate), averageHaidDurationDays).getTime();

  return {
    predictedStartDate,
    predictedEndDate,
    confidenceScore: user.adahConfidence,
    nextPeriodDate: new Date(predictedStartDate).toISOString()
  };
}

export function calculateRegularity(user: User): number | null {
  const ledger = user.adahLedger || [];
  if (ledger.length < 3) return null;

  const cycleLengths = ledger.map(c => (c.haidDurationHours / 24) + c.tuhrDurationDays);
  
  const average = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
  const variance = cycleLengths.reduce((a, b) => a + Math.pow(b - average, 2), 0) / cycleLengths.length;
  const stdDev = Math.sqrt(variance);
  
  const regularity = 100 - (stdDev / average * 100);
  return Math.round(Math.min(100, Math.max(0, regularity)));
}

export function calculateCycleStats(entries: any[], user?: User): CycleStats {
  const cycleLength = user ? getAverageCycleLength(user) : 28;
  const regularity = user ? calculateRegularity(user) : null;

  if (!entries || entries.length === 0) {
    return { 
      currentDay: 1, 
      daysUntilNext: Math.round(cycleLength) - 1, 
      isOverdue: false, 
      overdueDays: 0,
      progress: 0,
      avgCycleLength: cycleLength,
      avgPeriodLength: user ? getAverageHaidDuration(user) : 5,
      regularity,
      lastPeriodDate: null
    };
  }

  // Find the most recent period start, ignoring predicted entries
  const actualEntries = entries.filter(e => e.is_predicted === false);
  
  if (actualEntries.length === 0) {
    // If no actual entries, check if there are any entries at all that might be missing the flag
    const fallbackEntries = entries.filter(e => e.is_predicted === undefined || e.is_predicted === null);
    if (fallbackEntries.length > 0) {
      actualEntries.push(...fallbackEntries);
    } else {
      return { 
        currentDay: 1, 
        daysUntilNext: Math.round(cycleLength) - 1, 
        isOverdue: false, 
        overdueDays: 0,
        progress: 0,
        avgCycleLength: cycleLength,
        avgPeriodLength: user ? getAverageHaidDuration(user) : 5,
        regularity,
        lastPeriodDate: null
      };
    }
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

  const sortedEntries = [...actualEntries].sort((a, b) => getTimestamp(a) - getTimestamp(b));
  let lastPeriodStart: Date | null = null;

  for (let i = 0; i < sortedEntries.length; i++) {
    if (sortedEntries[i].fiqh_state === 'HAID') {
      if (i === 0 || sortedEntries[i - 1].fiqh_state !== 'HAID') {
        lastPeriodStart = new Date(sortedEntries[i].date);
      }
    }
  }

  if (!lastPeriodStart) {
    return { 
      currentDay: 1, 
      daysUntilNext: Math.round(cycleLength) - 1, 
      isOverdue: false, 
      overdueDays: 0,
      progress: 0,
      avgCycleLength: cycleLength,
      avgPeriodLength: user ? getAverageHaidDuration(user) : 5,
      regularity,
      lastPeriodDate: null
    };
  }

  const today = startOfDay(new Date());
  const diffDays = differenceInDays(today, startOfDay(lastPeriodStart)) + 1;

  // Calculate actual period duration if we are currently in or just finished one
  let currentPeriodLength = user ? getAverageHaidDuration(user) : 5;
  const periodEntries = actualEntries.filter(e => {
    const d = new Date(e.date);
    return e.fiqh_state === 'HAID' && d >= lastPeriodStart!;
  });
  
  if (periodEntries.length > 0) {
    const entryDates = periodEntries.map(e => new Date(e.date).getTime());
    const lastEntryDate = new Date(Math.max(...entryDates));
    const actualSpan = differenceInDays(lastEntryDate, lastPeriodStart) + 1;
    // If currently in HAID, we use max of avg and actual so far. 
    // If TAHARA, the actual length is precisely what was logged.
    const latestState = [...actualEntries].sort((a,b) => b.date.localeCompare(a.date))[0]?.fiqh_state;
    if (latestState === 'HAID') {
      currentPeriodLength = Math.max(currentPeriodLength, actualSpan);
    } else {
      currentPeriodLength = actualSpan;
    }
  }

  // Fix: If today is Day 28 and cycle is 28, daysUntilNext should be 1 (for tomorrow), not 0.
  const daysUntilNext = Math.max(0, Math.round(cycleLength) - diffDays + 1);
  const isOverdue = diffDays > Math.round(cycleLength);
  const overdueDays = isOverdue ? diffDays - Math.round(cycleLength) : 0;
  const progress = Math.min(100, Math.max(0, (diffDays / cycleLength) * 100));

  return {
    currentDay: diffDays,
    daysUntilNext,
    isOverdue,
    overdueDays,
    progress,
    avgCycleLength: cycleLength,
    avgPeriodLength: currentPeriodLength,
    regularity,
    lastPeriodDate: lastPeriodStart.toISOString()
  };
}

export type CyclePhaseId = 'haid' | 'tahara' | 'fertile' | 'pre_period' | 'expected';

export interface CycleSegment {
  id: CyclePhaseId;
  duration: number;
}

export function getCycleSegments(cycleStats: CycleStats, ovulation: OvulationResult | null): CycleSegment[] {
  const cycleLength = Math.round(cycleStats.avgCycleLength || 28);
  const avgPeriodLength = Math.round(cycleStats.avgPeriodLength || 5);

  let fertileStart = Math.floor(cycleLength / 2) - 3;
  let fertileEnd = fertileStart + 5;
  
  if (ovulation && cycleStats.lastPeriodDate) {
    const lastPeriod = startOfDay(new Date(cycleStats.lastPeriodDate));
    fertileStart = differenceInDays(startOfDay(new Date(ovulation.fertileWindowStart)), lastPeriod) + 1;
    fertileEnd = differenceInDays(startOfDay(new Date(ovulation.fertileWindowEnd)), lastPeriod) + 1;
  }

  // Ensure logical order
  fertileStart = Math.max(avgPeriodLength + 1, fertileStart);
  fertileEnd = Math.min(cycleLength - 4, fertileEnd);
  const fertileDuration = Math.max(0, fertileEnd - fertileStart + 1);

  const prePeriodDuration = 3;
  const expectedDuration = 1;
  
  const tahara1Duration = Math.max(0, fertileStart - avgPeriodLength - 1);
  const tahara2Duration = Math.max(0, (cycleLength - prePeriodDuration - expectedDuration) - fertileEnd);
  
  const segments: CycleSegment[] = [
    { id: 'haid' as CyclePhaseId, duration: avgPeriodLength },
    { id: 'tahara' as CyclePhaseId, duration: tahara1Duration },
    { id: 'fertile' as CyclePhaseId, duration: fertileDuration },
    { id: 'tahara' as CyclePhaseId, duration: tahara2Duration },
    { id: 'pre_period' as CyclePhaseId, duration: prePeriodDuration },
    { id: 'expected' as CyclePhaseId, duration: expectedDuration },
  ].filter(s => s.duration > 0);

  // Merge adjacent Tahara segments
  const merged: CycleSegment[] = [];
  for (const s of segments) {
    const last = merged[merged.length - 1];
    if (last && last.id === s.id && s.id === 'tahara') {
      last.duration += s.duration;
    } else {
      merged.push(s);
    }
  }
  return merged;
}

export function getPhaseForDayInCycle(dayInCycle: number, segments: CycleSegment[]): CyclePhaseId {
  let accumulated = 0;
  for (const s of segments) {
    if (dayInCycle <= accumulated + s.duration) {
      return s.id;
    }
    accumulated += s.duration;
  }
  return segments[segments.length - 1]?.id || 'tahara';
}

export function predictOvulation(user: User): OvulationResult {
  const prediction = predictNextPeriod(user);
  const predictedStartDate = new Date(prediction.predictedStartDate);
  
  // Ovulation = predictedStartDate minus 14 days
  const ovulationDate = subDays(predictedStartDate, 14);
  
  return {
    predictedOvulationDate: ovulationDate.getTime(),
    fertileWindowStart: subDays(ovulationDate, 5).getTime(),
    fertileWindowEnd: addDays(ovulationDate, 1).getTime()
  };
}
