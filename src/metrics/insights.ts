import type { Dataset, Squad } from '../data/model';
import type { MetricId } from './catalogue';
import type { PeriodDays } from './period';
import { scorecard } from './scorecard';

export type InsightTone = 'attention' | 'watch' | 'positive';

export interface Insight {
  id: string;
  tone: InsightTone;
  squadId: string;
  metricId: MetricId;
  title: string;
  body: string;
  /** A coaching prompt — the portal is a trusted partner, not an oversight tool. */
  prompt: string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const d1 = (v: number) => `${v.toFixed(1)}d`;

/**
 * Rule-based insights. Each rule is explainable and points at the metric that triggered it.
 * Phrased as conversation starters for the squad, not verdicts.
 */
export function generateInsights(data: Dataset, squads: Squad[], period: PeriodDays): Insight[] {
  const out: Insight[] = [];
  for (const sq of squads) {
    const sc = scorecard(data, [sq], period);
    const c = sc.current;
    const p = sc.previous;
    const rel = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? (a - b) / b : 0);

    if (sq.teamType === 'scrum' && c.scopeChange > 0.25 && c.sayDo < 0.75) {
      out.push({
        id: `${sq.id}-scope`, tone: 'attention', squadId: sq.id, metricId: 'scopeChange',
        title: `${sq.name}: added scope is eroding commitments`,
        body: `${pct(c.scopeChange)} of the commitment was added mid-sprint and Say/Do is ${pct(c.sayDo)}.`,
        prompt: 'Where is the added work coming from — and could it wait for the next planning?',
      });
    } else if (sq.teamType === 'scrum' && c.sayDo < 0.65) {
      out.push({
        id: `${sq.id}-saydo`, tone: 'attention', squadId: sq.id, metricId: 'sayDo',
        title: `${sq.name}: commitments consistently out of reach`,
        body: `Say/Do is ${pct(c.sayDo)} with relatively stable scope — a sign of over-commitment rather than disruption.`,
        prompt: 'Would planning to recent velocity (rather than capacity) give the team more confidence?',
      });
    }

    const ctChange = rel(c.cycleP85, p.cycleP85);
    if (ctChange > 0.3) {
      out.push({
        id: `${sq.id}-cycle`, tone: c.cycleP85 > 15 ? 'attention' : 'watch', squadId: sq.id, metricId: 'cycleP85',
        title: `${sq.name}: flow is slowing down`,
        body: `85th percentile cycle time rose from ${d1(p.cycleP85)} to ${d1(c.cycleP85)} (+${pct(ctChange)}); ${pct(c.ageingWipShare)} of WIP is ageing.`,
        prompt: 'Are items waiting on reviews, environments or other teams? The ageing WIP list is a good place to start.',
      });
    } else if (ctChange < -0.2) {
      out.push({
        id: `${sq.id}-cycle-up`, tone: 'positive', squadId: sq.id, metricId: 'cycleP85',
        title: `${sq.name}: faster flow`,
        body: `85th percentile cycle time improved from ${d1(p.cycleP85)} to ${d1(c.cycleP85)}.`,
        prompt: 'What changed? Worth capturing so other squads can learn from it.',
      });
    }

    const bugDelta = c.bugRatio - p.bugRatio;
    if (c.bugRatio > 0.3 && bugDelta > 0.05) {
      out.push({
        id: `${sq.id}-bugs`, tone: 'attention', squadId: sq.id, metricId: 'bugRatio',
        title: `${sq.name}: more capacity going to bugs`,
        body: `Bugs were ${pct(c.bugRatio)} of finished work, up from ${pct(p.bugRatio)}.`,
        prompt: 'Is there a common source (a release, a component) worth a focused fix?',
      });
    }

    const tpChange = rel(c.throughput, p.throughput);
    if (tpChange < -0.25) {
      out.push({
        id: `${sq.id}-tp`, tone: 'watch', squadId: sq.id, metricId: 'throughput',
        title: `${sq.name}: throughput dropped`,
        body: `${c.throughput.toFixed(1)} items/week vs ${p.throughput.toFixed(1)} in the previous period (${pct(tpChange)}).`,
        prompt: 'Is this capacity (leave, onboarding) or larger items? Splitting work may help forecasting.',
      });
    }

    if (sq.teamType === 'scrum' && c.velocityCv > 0.3) {
      out.push({
        id: `${sq.id}-vcv`, tone: 'watch', squadId: sq.id, metricId: 'velocityCv',
        title: `${sq.name}: velocity is hard to forecast`,
        body: `Velocity varies by ±${pct(c.velocityCv)} sprint to sprint.`,
        prompt: 'Are sprints disrupted by unplanned work, or is estimation drifting?',
      });
    }

    if (sq.teamType === 'scrum' && c.sayDo >= 0.85 && p.sayDo < 0.82 && Number.isFinite(p.sayDo)) {
      out.push({
        id: `${sq.id}-saydo-up`, tone: 'positive', squadId: sq.id, metricId: 'sayDo',
        title: `${sq.name}: reliability improving`,
        body: `Say/Do climbed from ${pct(p.sayDo)} to ${pct(c.sayDo)}.`,
        prompt: 'A good story to share at the next Delivery Leads sync.',
      });
    }
  }
  const order: Record<InsightTone, number> = { attention: 0, watch: 1, positive: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
