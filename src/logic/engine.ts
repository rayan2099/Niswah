/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Madhhab, State } from './types.ts';

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
