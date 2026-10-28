import { useEffect, useMemo, useRef, useState } from 'react';
import { MdAutoAwesome, MdClose, MdDeleteOutline, MdSend } from 'react-icons/md';
import { generateInsights, type Insight } from '../metrics/insights';
import { useScopedSquads } from '../state/filters';

const SUGGESTIONS = [
  'Summarise this page in 3 points',
  'What needs attention, and why?',
  'Which questions should I take to the teams?',
];

type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * "Insight about this page" — a mock-up of an AI assistant that would answer questions about the page
 * being viewed. Not connected to any model: answers are examples assembled from the rule-based insights
 * for the current scope and period, so the demo reads plausibly on any page.
 */
export function InsightPanel({ path }: { path: string }) {
  const { data, squads, label, period } = useScopedSquads();
  const insights = useMemo(() => generateInsights(data, squads, period), [data, squads, period]);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    setTurns([]);
    setBusy(false);
  }, [path]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns, busy]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setInput('');
    setBusy(true);
    // A short pause so the demo feels like a model answering
    timer.current = window.setTimeout(() => {
      setTurns((t) => [...t, { role: 'assistant', content: exampleAnswer(q, insights, label, period) }]);
      setBusy(false);
    }, 900);
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-body-sm font-medium text-on-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <MdAutoAwesome className="text-[18px] text-secondary-fixed" />
        Insight about this page
      </button>
    );

  return (
    <section
      className="fixed bottom-4 right-4 z-40 flex h-[min(600px,calc(100vh-6rem))] w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(9,20,38,0.18)]"
      aria-label="Insight about this page"
    >
      <header className="flex items-center gap-2 border-b border-outline-variant px-4 py-3">
        <MdAutoAwesome className="text-[20px] text-series-1" />
        <div className="min-w-0 flex-1">
          <h3 className="text-body-sm font-semibold text-on-surface">Insight about this page</h3>
          <p className="truncate text-label-sm text-on-surface-variant">Preview · example answers, no model connected</p>
        </div>
        {turns.length > 0 && (
          <button
            onClick={() => {
              window.clearTimeout(timer.current);
              setTurns([]);
              setBusy(false);
            }}
            className="rounded p-1.5 text-[18px] text-on-surface-variant hover:bg-surface-container-high"
            title="Start over"
            aria-label="Start over"
          >
            <MdDeleteOutline />
          </button>
        )}
        <button onClick={() => setOpen(false)} className="rounded p-1.5 text-[18px] text-on-surface-variant hover:bg-surface-container-high" aria-label="Close">
          <MdClose />
        </button>
      </header>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-body-sm text-on-surface-variant">
              Ask anything about what's on screen — <span className="font-medium text-on-surface">{label}</span>, last {period} days.
            </p>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-outline-variant px-3 py-1.5 text-left text-body-sm text-on-surface hover:border-series-1 hover:bg-secondary-container/40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-secondary-container px-3 py-2 text-body-sm text-on-surface">{t.content}</p>
            </div>
          ) : (
            <AnswerView key={i} text={t.content} />
          ),
        )}
        {busy && <p className="animate-pulse text-body-sm text-on-surface-variant">Reading the page…</p>}
      </div>

      <form
        className="flex items-end gap-2 border-t border-outline-variant p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={2}
          placeholder="Ask a question…"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="flex h-10 w-10 items-center justify-center rounded bg-primary text-[18px] text-on-primary disabled:opacity-40"
          aria-label="Send"
        >
          <MdSend />
        </button>
      </form>
    </section>
  );
}

/** Lines starting with "- " are bullets; **bold** is supported — enough for the example answers. */
function AnswerView({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);
  const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
  return (
    <div className="text-body-sm text-on-surface">
      {lines.map((l, i) =>
        l.startsWith('- ') ? (
          <p key={i} className="my-1 flex gap-2 pl-1">
            <span aria-hidden>•</span>
            <span>{bold(l.slice(2))}</span>
          </p>
        ) : (
          <p key={i} className="my-1.5">
            {bold(l)}
          </p>
        ),
      )}
    </div>
  );
}

function exampleAnswer(question: string, insights: Insight[], label: string, period: number): string {
  const top = insights.slice(0, 3);
  if (!top.length) return `Nothing stands out for **${label}** over the last ${period} days — the signals are steady compared with the period before.`;
  if (/question|ask|team/i.test(question))
    return [`Questions worth exploring with the teams, based on the last ${period} days:`, ...top.map((i) => `- **${i.title}** — ${i.prompt}`)].join('\n');
  const attention = insights.filter((i) => i.tone === 'attention').length;
  return [
    `For **${label}** over the last ${period} days, ${attention ? `${attention} signal${attention > 1 ? 's need' : ' needs'} attention` : 'nothing needs urgent attention'}. The main points:`,
    ...top.map((i) => `- **${i.title}** — ${i.body}`),
  ].join('\n');
}
