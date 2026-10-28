import type {
  Dataset,
  DeliveryLead,
  Domain,
  Initiative,
  PulseCheck,
  PulseDimension,
  Sprint,
  Pod,
  Squad,
  TeamType,
  ValueStream,
  WorkItem,
  WorkCategory,
  WorkItemType,
} from '../../model';
import { PULSE_DIMENSIONS } from '../../model';
import { createRng, type Rng } from '../../../lib/rng';

/**
 * Dummy data generator.
 *
 * Every squad has a behavioural "profile" so the portal has real stories to tell
 * (scope creep, a quality dip, a slowing flow…). The generator is deterministic:
 * same seed → same data, so screenshots and tests are stable.
 *
 * All names are fictional.
 */

export const MOCK_AS_OF = '2026-10-02T18:00:00.000Z';
const DAY = 86_400_000;
const HISTORY_DAYS = 220; // ~7 months of created items so 6-month windows are fully populated
const SPRINT_COUNT = 13;

interface Profile {
  /** Items completed per week at the start → end of history */
  throughput: [number, number];
  /** Median cycle time (days) at the start → end of history */
  cycleMedian: [number, number];
  cycleSigma: number;
  /** Median wait between creation and start (days) */
  waitMedian: number;
  bugShare: [number, number];
  /** Scrum only */
  velocity?: number;
  velocityNoise?: number;
  sayDo?: [number, number];
  scopeChange?: number;
  /** Share of stories not aligned to an OKR, start → end (default 0.2) */
  nonOkr?: [number, number];
  /** Pulse check mean score (1–5), start → end, plus per-dimension offsets */
  pulse?: { base: [number, number]; offsets?: Partial<Record<PulseDimension, number>> };
}

interface SquadSeed {
  id: string;
  name: string;
  domainId: string;
  valueStreamId: string;
  deliveryLeadId: string;
  teamType: TeamType;
  boardKey: string;
  profile: Profile;
}

const domains: Domain[] = [
  { id: 'dom-player', name: 'Player Experience', manager: 'Marta Reis' },
  { id: 'dom-pay', name: 'Payments & Wallet', manager: 'Rui Matos' },
  { id: 'dom-core', name: 'Core Platform', manager: 'Inês Carvalho' },
];

const valueStreams: ValueStream[] = [
  { id: 'vs-onboarding', name: 'Onboarding & Account', domainId: 'dom-player' },
  { id: 'vs-engagement', name: 'Engagement', domainId: 'dom-player' },
  { id: 'vs-deposits', name: 'Deposits', domainId: 'dom-pay' },
  { id: 'vs-withdrawals', name: 'Withdrawals & Risk', domainId: 'dom-pay' },
  { id: 'vs-identity', name: 'Identity & Access', domainId: 'dom-core' },
  { id: 'vs-platform', name: 'Platform Services', domainId: 'dom-core' },
];

const deliveryLeads: DeliveryLead[] = [
  { id: 'dl-ana', name: 'Ana Sousa' },
  { id: 'dl-pedro', name: 'Pedro Lima' },
  { id: 'dl-sofia', name: 'Sofia Costa' },
  { id: 'dl-tiago', name: 'Tiago Nunes' },
];

const pods: Pod[] = [
  { id: 'pod-growth', name: 'Growth' },
  { id: 'pod-checkout', name: 'Checkout' },
  { id: 'pod-risk', name: 'Risk & Compliance' },
  { id: 'pod-identity', name: 'Identity' },
  { id: 'pod-foundations', name: 'Foundations' },
];

/** Pod membership by team — kept out of the seeds so generated values never shift */
const podOf: Record<string, string> = {
  'sq-atlas': 'pod-growth',
  'sq-borealis': 'pod-growth',
  'sq-cobalt': 'pod-growth',
  'sq-dune': 'pod-checkout',
  'sq-ember': 'pod-checkout',
  'sq-fjord': 'pod-risk',
  'sq-granite': 'pod-risk',
  'sq-halo': 'pod-identity',
  'sq-iris': 'pod-identity',
  'sq-juno': 'pod-foundations',
  'sq-kestrel': 'pod-foundations',
  'sq-lumen': 'pod-foundations',
};

const squadSeeds: SquadSeed[] = [
  {
    id: 'sq-atlas', name: 'Atlas', domainId: 'dom-player', valueStreamId: 'vs-onboarding', deliveryLeadId: 'dl-ana',
    teamType: 'scrum', boardKey: 'ATL',
    // Healthy and improving
    profile: { throughput: [6, 7.5], cycleMedian: [4.5, 3.4], cycleSigma: 0.55, waitMedian: 6, bugShare: [0.18, 0.14], velocity: 42, velocityNoise: 0.08, sayDo: [0.8, 0.9], scopeChange: 0.08, pulse: { base: [3.9, 4.2] } },
  },
  {
    id: 'sq-borealis', name: 'Borealis', domainId: 'dom-player', valueStreamId: 'vs-engagement', deliveryLeadId: 'dl-ana',
    teamType: 'scrum', boardKey: 'BOR',
    // Scope creep → falling commitment reliability
    profile: { throughput: [7, 6.5], cycleMedian: [4, 5.2], cycleSigma: 0.6, waitMedian: 5, bugShare: [0.2, 0.22], velocity: 48, velocityNoise: 0.12, sayDo: [0.84, 0.63], scopeChange: 0.34, pulse: { base: [3.9, 3.4], offsets: { process: -0.6, mission: -0.4 } } },
  },
  {
    id: 'sq-cobalt', name: 'Cobalt', domainId: 'dom-player', valueStreamId: 'vs-engagement', deliveryLeadId: 'dl-ana',
    teamType: 'kanban', boardKey: 'COB',
    profile: { throughput: [8, 9], cycleMedian: [3, 2.7], cycleSigma: 0.5, waitMedian: 4, bugShare: [0.16, 0.15] },
  },
  {
    id: 'sq-dune', name: 'Dune', domainId: 'dom-pay', valueStreamId: 'vs-deposits', deliveryLeadId: 'dl-pedro',
    teamType: 'scrum', boardKey: 'DUN',
    profile: { throughput: [6, 6.2], cycleMedian: [4, 4], cycleSigma: 0.5, waitMedian: 7, bugShare: [0.15, 0.15], velocity: 38, velocityNoise: 0.07, sayDo: [0.86, 0.88], scopeChange: 0.1 },
  },
  {
    id: 'sq-ember', name: 'Ember', domainId: 'dom-pay', valueStreamId: 'vs-deposits', deliveryLeadId: 'dl-pedro',
    teamType: 'scrum', boardKey: 'EMB',
    // Quality dip — bug share climbing
    profile: { throughput: [6.5, 7], cycleMedian: [4.2, 4.6], cycleSigma: 0.55, waitMedian: 5, bugShare: [0.2, 0.42], velocity: 44, velocityNoise: 0.1, sayDo: [0.82, 0.76], scopeChange: 0.16, pulse: { base: [3.8, 3.5], offsets: { codebase: -0.9, release: -0.5 } } },
  },
  {
    id: 'sq-fjord', name: 'Fjord', domainId: 'dom-pay', valueStreamId: 'vs-withdrawals', deliveryLeadId: 'dl-pedro',
    teamType: 'kanban', boardKey: 'FJO',
    // Flow slowing down — cycle time and ageing WIP growing
    profile: { throughput: [7, 5], cycleMedian: [3.5, 8.5], cycleSigma: 0.65, waitMedian: 5, bugShare: [0.2, 0.24], pulse: { base: [3.8, 3.4], offsets: { speed: -0.7 } } },
  },
  {
    id: 'sq-granite', name: 'Granite', domainId: 'dom-pay', valueStreamId: 'vs-withdrawals', deliveryLeadId: 'dl-sofia',
    teamType: 'scrum', boardKey: 'GRA',
    // Chronic over-commitment
    profile: { throughput: [5, 5.2], cycleMedian: [6, 6.2], cycleSigma: 0.6, waitMedian: 9, bugShare: [0.22, 0.24], velocity: 30, velocityNoise: 0.14, sayDo: [0.6, 0.58], scopeChange: 0.2, pulse: { base: [3.3, 3.0], offsets: { speed: -0.6, process: -0.4, fun: -0.3 } } },
  },
  {
    id: 'sq-halo', name: 'Halo', domainId: 'dom-core', valueStreamId: 'vs-identity', deliveryLeadId: 'dl-sofia',
    teamType: 'scrum', boardKey: 'HAL',
    profile: { throughput: [5.5, 6], cycleMedian: [4.8, 4.4], cycleSigma: 0.5, waitMedian: 8, bugShare: [0.14, 0.12], velocity: 36, velocityNoise: 0.08, sayDo: [0.85, 0.87], scopeChange: 0.09 },
  },
  {
    id: 'sq-iris', name: 'Iris', domainId: 'dom-core', valueStreamId: 'vs-identity', deliveryLeadId: 'dl-sofia',
    teamType: 'kanban', boardKey: 'IRI',
    // Improving after a WIP-limit experiment
    profile: { throughput: [5, 7.5], cycleMedian: [6, 3.6], cycleSigma: 0.55, waitMedian: 6, bugShare: [0.18, 0.15], pulse: { base: [3.2, 4.1] } },
  },
  {
    id: 'sq-juno', name: 'Juno', domainId: 'dom-core', valueStreamId: 'vs-platform', deliveryLeadId: 'dl-tiago',
    teamType: 'scrum', boardKey: 'JUN',
    // Volatile velocity — planning instability
    profile: { throughput: [6, 6], cycleMedian: [5, 5.3], cycleSigma: 0.7, waitMedian: 6, bugShare: [0.17, 0.18], velocity: 40, velocityNoise: 0.42, sayDo: [0.76, 0.74], scopeChange: 0.14, nonOkr: [0.25, 0.45], pulse: { base: [3.6, 3.5], offsets: { process: -0.4, codebase: -0.3 } } },
  },
  {
    id: 'sq-kestrel', name: 'Kestrel', domainId: 'dom-core', valueStreamId: 'vs-platform', deliveryLeadId: 'dl-tiago',
    teamType: 'scrum', boardKey: 'KES',
    profile: { throughput: [7, 7.4], cycleMedian: [3.6, 3.3], cycleSigma: 0.5, waitMedian: 5, bugShare: [0.13, 0.12], velocity: 50, velocityNoise: 0.07, sayDo: [0.88, 0.91], scopeChange: 0.07, pulse: { base: [4.1, 4.2] } },
  },
  {
    id: 'sq-lumen', name: 'Lumen', domainId: 'dom-core', valueStreamId: 'vs-platform', deliveryLeadId: 'dl-tiago',
    teamType: 'kanban', boardKey: 'LUM',
    // Throughput dropping
    profile: { throughput: [9, 4.5], cycleMedian: [3.2, 4.2], cycleSigma: 0.55, waitMedian: 4, bugShare: [0.19, 0.2], pulse: { base: [3.8, 3.3], offsets: { support: -0.5, autonomy: -0.5 } } },
  },
];

const initiativeNames: Record<string, [string, string]> = {
  'vs-onboarding': ['Frictionless sign-up', 'KYC automation'],
  'vs-engagement': ['Personalised home feed', 'Rewards hub'],
  'vs-deposits': ['Open banking deposits', 'Payment method expansion'],
  'vs-withdrawals': ['Instant withdrawals', 'Fraud signal v2'],
  'vs-identity': ['Passkeys rollout', 'Session hardening'],
  'vs-platform': ['Service mesh migration', 'Observability baseline'],
};

const summaries: Record<WorkItemType, string[]> = {
  story: [
    'Add validation to {x} form', 'Expose {x} via public API', 'Instrument {x} journey', 'Redesign {x} empty state',
    'Support new locale in {x}', 'Migrate {x} to new service', 'A/B test variant for {x}', 'Cache {x} responses',
  ],
  bug: [
    '{x} fails on slow networks', 'Wrong currency shown in {x}', '{x} timeout under load', 'Duplicate events from {x}',
    '{x} not respecting feature flag', 'Accessibility: {x} focus trap',
  ],
  task: ['Upgrade {x} dependencies', 'Rotate {x} credentials', 'Document {x} runbook', 'Clean up {x} feature flags'],
};
const nouns = ['checkout', 'profile', 'wallet', 'login', 'notifications', 'search', 'limits', 'bonus', 'history', 'settings'];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const iso = (ms: number) => new Date(ms).toISOString();
const STORY_POINTS = [1, 2, 3, 5, 8] as const;

function buildInitiatives(asOfMs: number): Initiative[] {
  const out: Initiative[] = [];
  for (const vs of valueStreams) {
    initiativeNames[vs.id].forEach((name, i) => {
      out.push({
        id: `ini-${vs.id.slice(3)}-${i + 1}`,
        name,
        domainId: vs.domainId,
        valueStreamId: vs.id,
        targetDate: iso(asOfMs + (i === 0 ? 30 : 95) * DAY).slice(0, 10),
        status: 'in_progress',
      });
    });
  }
  return out;
}

/**
 * Development category. Uses its own RNG stream so adding it didn't change any other generated value.
 * ~5% left uncategorised; bugs keep the lights on; tasks split keep-the-lights-on / L&D / non-OKR;
 * stories are OKR aligned unless not.
 */
function categoryFor(rng: Rng, type: WorkItemType, nonOkr: number): WorkCategory {
  if (rng.chance(0.05)) return 'none';
  if (type === 'bug') return 'ktlo';
  if (type === 'task') {
    const r = rng.next();
    return r < 0.55 ? 'ktlo' : r < 0.8 ? 'learning' : 'nonOkr';
  }
  return rng.chance(nonOkr) ? 'nonOkr' : 'okr';
}

function buildWorkItems(rng: Rng, catRng: Rng, seed: SquadSeed, asOfMs: number, initiatives: Initiative[]): WorkItem[] {
  const items: WorkItem[] = [];
  const p = seed.profile;
  const myInitiatives = initiatives.filter((i) => i.valueStreamId === seed.valueStreamId);
  const startMs = asOfMs - HISTORY_DAYS * DAY;
  let n = 1;
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const t = day / HISTORY_DAYS;
    // Create at the rate we later want to complete, so the system stays near steady state
    const dailyRate = lerp(p.throughput[0], p.throughput[1], t) / 5;
    const weekday = new Date(startMs + day * DAY).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const count = rng.poisson(dailyRate);
    for (let c = 0; c < count; c++) {
      const createdMs = startMs + (day + rng.between(0.3, 0.7)) * DAY;
      const wait = rng.logNormal(p.waitMedian, 0.8);
      const startedMs = createdMs + wait * DAY;
      const tStart = clamp((startedMs - startMs) / (HISTORY_DAYS * DAY), 0, 1);
      const cycle = Math.max(0.2, rng.logNormal(lerp(p.cycleMedian[0], p.cycleMedian[1], tStart), p.cycleSigma));
      const doneMs = startedMs + cycle * DAY;
      const bugShare = lerp(p.bugShare[0], p.bugShare[1], tStart);
      const roll = rng.next();
      const type: WorkItemType = roll < bugShare ? 'bug' : roll < bugShare + 0.15 ? 'task' : 'story';
      const summary = rng.pick(summaries[type]).replace('{x}', rng.pick(nouns));
      items.push({
        key: `${seed.boardKey}-${1000 + n++}`,
        squadId: seed.id,
        type,
        category: categoryFor(catRng, type, lerp(...(p.nonOkr ?? [0.2, 0.2]), tStart)),
        summary: summary.charAt(0).toUpperCase() + summary.slice(1),
        storyPoints: type === 'story' ? rng.pick(STORY_POINTS) : type === 'bug' ? rng.pick([1, 2, 3] as const) : null,
        initiativeId: type === 'story' && myInitiatives.length && rng.chance(0.7) ? rng.pick(myInitiatives).id : null,
        createdAt: iso(createdMs),
        startedAt: startedMs <= asOfMs ? iso(startedMs) : null,
        doneAt: doneMs <= asOfMs ? iso(doneMs) : null,
      });
    }
  }
  return items;
}

function buildSprints(rng: Rng, seed: SquadSeed, asOfMs: number): Sprint[] {
  const p = seed.profile;
  if (seed.teamType !== 'scrum' || !p.velocity || !p.sayDo) return [];
  const sprints: Sprint[] = [];
  // Last closed sprint ended two days before the snapshot
  const lastEnd = asOfMs - 2 * DAY;
  for (let k = SPRINT_COUNT - 1; k >= 0; k--) {
    const endMs = lastEnd - k * 14 * DAY;
    const startMs = endMs - 14 * DAY;
    const t = 1 - k / (SPRINT_COUNT - 1);
    const committed = Math.max(8, Math.round(p.velocity * (1 + (p.velocityNoise ?? 0.1) * rng.normal())));
    const sayDo = clamp(lerp(p.sayDo[0], p.sayDo[1], t) + 0.05 * rng.normal(), 0.3, 1);
    const added = Math.max(0, Math.round(committed * ((p.scopeChange ?? 0.1) + 0.06 * rng.normal())));
    const sprintNo = 40 + (SPRINT_COUNT - k);
    sprints.push({
      id: `${seed.id}-s${sprintNo}`,
      squadId: seed.id,
      name: `${seed.name} Sprint ${sprintNo}`,
      startDate: iso(startMs),
      endDate: iso(endMs),
      committedPoints: committed,
      completedCommittedPoints: Math.round(committed * sayDo),
      addedPoints: added,
      completedAddedPoints: Math.round(added * rng.between(0.4, 0.9)),
      removedPoints: Math.round(committed * rng.between(0, 0.08)),
      goal: `Sprint ${sprintNo} goal`,
      goalMet: rng.chance(sayDo >= 0.8 ? 0.85 : sayDo >= 0.65 ? 0.5 : 0.2),
    });
  }
  return sprints;
}

const PULSE_COUNT = 7;
const PULSE_EVERY_DAYS = 28;

/** Monthly pulse checks; the latest closed 5 days before the snapshot. */
function buildPulseChecks(rng: Rng, seed: SquadSeed, asOfMs: number): PulseCheck[] {
  const pulse = seed.profile.pulse ?? { base: [3.8, 3.9] as [number, number] };
  return Array.from({ length: PULSE_COUNT }, (_, i) => {
    const k = PULSE_COUNT - 1 - i;
    const t = i / (PULSE_COUNT - 1);
    const base = lerp(pulse.base[0], pulse.base[1], t);
    const scores = Object.fromEntries(
      PULSE_DIMENSIONS.map((d) => {
        // Offsets build up over time, so problems emerge rather than being there from day one
        const off = (pulse.offsets?.[d.id] ?? 0) * (0.3 + 0.7 * t);
        return [d.id, Math.round(clamp(base + off + 0.25 * rng.normal(), 1, 5) * 10) / 10];
      }),
    ) as Record<PulseDimension, number>;
    return {
      id: `${seed.id}-p${i + 1}`,
      squadId: seed.id,
      date: iso(asOfMs - (5 + k * PULSE_EVERY_DAYS) * DAY),
      respondents: rng.int(5, 9),
      scores,
    };
  });
}

export function generateDataset(seed = 20261002, asOf = MOCK_AS_OF): Dataset {
  const rng = createRng(seed);
  const asOfMs = Date.parse(asOf);
  const initiatives = buildInitiatives(asOfMs);
  const squads: Squad[] = squadSeeds.map(({ profile: _profile, ...s }) => ({ ...s, podId: podOf[s.id] ?? null }));
  // Separate streams for later additions, so existing generated values (and the squad stories) stay put
  const catRng = createRng(seed + 1);
  const pulseRng = createRng(seed + 2);
  const workItems = squadSeeds.flatMap((s) => buildWorkItems(rng, catRng, s, asOfMs, initiatives));
  const sprints = squadSeeds.flatMap((s) => buildSprints(rng, s, asOfMs));
  const pulseChecks = squadSeeds.flatMap((s) => buildPulseChecks(pulseRng, s, asOfMs));
  return {
    asOf,
    source: { id: 'mock', label: 'Dummy data (seeded generator)', isDummy: true },
    domains,
    valueStreams,
    deliveryLeads,
    pods,
    squads,
    initiatives,
    workItems,
    sprints,
    pulseChecks,
  };
}
