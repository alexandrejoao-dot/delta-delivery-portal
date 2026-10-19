import { PULSE_DIMENSIONS, type Dataset, type PulseCheck, type PulseDimension, type Squad } from '../data/model';
import { inWindow, type Window } from './period';
import { mean } from './stats';

/** Below this many respondents a pulse is not shown — protects anonymity in small squads. */
export const MIN_PULSE_RESPONDENTS = 3;

/** Latest reportable pulse per squad within the window. */
export function latestPulses(pulses: PulseCheck[], w: Window): PulseCheck[] {
  const latest = new Map<string, PulseCheck>();
  for (const p of pulses) {
    if (!inWindow(p.date, w) || p.respondents < MIN_PULSE_RESPONDENTS) continue;
    const cur = latest.get(p.squadId);
    if (!cur || Date.parse(p.date) > Date.parse(cur.date)) latest.set(p.squadId, p);
  }
  return [...latest.values()];
}

export const pulseCheckScore = (p: PulseCheck) => mean(PULSE_DIMENSIONS.map((d) => p.scores[d.id]));

/** Mean pulse score (1–5). Each squad counts once, whatever its size. */
export const pulseScore = (pulses: PulseCheck[], w: Window) => mean(latestPulses(pulses, w).map(pulseCheckScore));

/** Per-dimension mean across squads' latest pulses, lowest first — where the conversation should start. */
export function pulseDimensions(pulses: PulseCheck[], w: Window): { id: PulseDimension; label: string; score: number }[] {
  const latest = latestPulses(pulses, w);
  if (!latest.length) return [];
  return PULSE_DIMENSIONS.map((d) => ({ id: d.id, label: d.label, score: mean(latest.map((p) => p.scores[d.id])) })).sort(
    (a, b) => a.score - b.score,
  );
}

export const pulsesFor = (data: Dataset, squads: Squad[]) => {
  const ids = new Set(squads.map((s) => s.id));
  return data.pulseChecks.filter((p) => ids.has(p.squadId));
};
