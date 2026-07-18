'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ModelVerdict } from '@/lib/benchmark/data';

export interface BenchmarkDatum {
  id: string;
  label: string;
  planFirstTryValid: number;
  planFinalValid: number;
  repetitionMax: number;
  repetitionMean: number;
  bannedPhrases: number;
  meanStoryMs: number;
  costUsdPerStory?: number;
  verdict: ModelVerdict;
}

interface BenchmarkChartsProps {
  models: BenchmarkDatum[];
  pricingDates: string[];
  pricingNote: string;
}

const VERDICT_COLOR: Record<ModelVerdict, string> = {
  default: 'hsl(var(--chart-2))',
  finalist: 'hsl(var(--chart-1))',
  eliminated: 'hsl(var(--chart-3))',
  candidate: 'hsl(var(--chart-4))',
};

const EASE = [0.2, 0, 0, 1] as const;
const INK = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--muted-foreground))';
const BORDER = 'hsl(var(--border))';
const CARD = 'hsl(var(--card))';

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(milliseconds: number) {
  const seconds = milliseconds / 1000;
  return `${seconds < 100 ? seconds.toFixed(1) : Math.round(seconds)} s`;
}

function formatCost(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function ChartFrame({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-[var(--story-radius-md)] border border-border bg-card p-4 shadow-[var(--story-shadow)] sm:p-6 lg:p-8"
    >
      <header className="mb-6 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h2 id={`${id}-heading`} className="mt-2 font-serif text-2xl tracking-tight text-card-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      </header>
      <p className="mb-3 font-mono text-xs text-muted-foreground sm:hidden">
        Swipe horizontally to inspect the full plot.
      </p>
      {children}
    </section>
  );
}

function ScatterChart({ models, pricingDates, pricingNote }: BenchmarkChartsProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const pricedModels = models.filter(
    (model): model is BenchmarkDatum & { costUsdPerStory: number } => model.costUsdPerStory !== undefined,
  );
  const xMin = Math.log10(7);
  const xMax = Math.log10(330);
  const yMin = Math.log10(0.0009);
  const yMax = Math.log10(0.036);
  const plot = { left: 104, right: 836, top: 42, bottom: 432 };
  const x = (seconds: number) =>
    plot.left + ((Math.log10(seconds) - xMin) / (xMax - xMin)) * (plot.right - plot.left);
  const y = (cost: number) =>
    plot.bottom - ((Math.log10(cost) - yMin) / (yMax - yMin)) * (plot.bottom - plot.top);
  const xTicks = [10, 30, 100, 300];
  const yTicks = [0.001, 0.003, 0.01, 0.03];

  return (
    <ChartFrame
      id="efficiency-frontier"
      eyebrow="Cost × latency"
      title="Efficiency frontier"
      description="Lower and further left is better. Both axes use logarithmic scales; the validity ring shows how many plans survived the repair loop."
    >
      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <svg
          viewBox="0 0 920 510"
          className="mx-auto h-auto min-w-[46rem] max-w-[57.5rem] w-full"
          role="img"
          aria-label={`Scatter chart comparing ${pricedModels.length} models by estimated cost and mean time per Story. GPT-OSS 120B is fastest and cheapest; GLM 5.2 is the selected default.`}
        >
          <title>Model cost and latency efficiency frontier</title>
          {yTicks.map((tick) => {
            const cy = y(tick);
            return (
              <g key={tick}>
                <line x1={plot.left} x2={plot.right} y1={cy} y2={cy} stroke={BORDER} strokeDasharray="4 6" />
                <text x={plot.left - 14} y={cy + 4} textAnchor="end" fontSize="13" fill={MUTED}>
                  {formatCost(tick)}
                </text>
              </g>
            );
          })}
          {xTicks.map((tick) => {
            const cx = x(tick);
            return (
              <g key={tick}>
                <line x1={cx} x2={cx} y1={plot.top} y2={plot.bottom} stroke={BORDER} strokeDasharray="4 6" />
                <text x={cx} y={plot.bottom + 24} textAnchor="middle" fontSize="13" fill={MUTED}>
                  {tick} s
                </text>
              </g>
            );
          })}
          <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke={MUTED} />
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke={MUTED} />
          <text x={(plot.left + plot.right) / 2} y="496" textAnchor="middle" fontSize="14" fill={MUTED}>
            Mean time per Story · log scale
          </text>
          <text
            x="20"
            y={(plot.top + plot.bottom) / 2}
            textAnchor="middle"
            fontSize="14"
            fill={MUTED}
            transform={`rotate(-90 20 ${(plot.top + plot.bottom) / 2})`}
          >
            Estimated USD per Story · log scale
          </text>

          {pricedModels.map((model, index) => {
            const cx = x(model.meanStoryMs / 1000);
            const cy = y(model.costUsdPerStory);
            const radius = 8 + model.planFinalValid * 4;
            const labelLeft = cx > 650;
            const labelDy = index % 2 === 0 ? -15 : 24;
            return (
              <g key={model.id} data-model-id={model.id}>
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke={BORDER} strokeWidth="3" />
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={VERDICT_COLOR[model.verdict]}
                  strokeWidth="3"
                  strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cy})`}
                  initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: model.planFinalValid, opacity: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : index * 0.04, ease: EASE }}
                />
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r="5"
                  fill={VERDICT_COLOR[model.verdict]}
                  stroke={CARD}
                  strokeWidth="2"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : 0.18 + index * 0.04, ease: EASE }}
                />
                <text
                  x={cx + (labelLeft ? -18 : 18)}
                  y={cy + labelDy}
                  textAnchor={labelLeft ? 'end' : 'start'}
                  fontSize="14"
                  fontWeight="600"
                  fill={INK}
                >
                  {model.label}
                </text>
                <text
                  x={cx + (labelLeft ? -18 : 18)}
                  y={cy + labelDy + 15}
                  textAnchor={labelLeft ? 'end' : 'start'}
                  fontSize="12"
                  fill={MUTED}
                >
                  {formatSeconds(model.meanStoryMs)} · {formatCost(model.costUsdPerStory)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Verdict legend">
        {(['default', 'finalist', 'eliminated'] as const).map((verdict) => (
          <span key={verdict} className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: VERDICT_COLOR[verdict] }} aria-hidden />
            <span className="capitalize">{verdict}</span>
          </span>
        ))}
        <span>Outer ring = final plan validity</span>
      </div>
      <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        Pricing snapshot{pricingDates.length === 1 ? '' : 's'}:{' '}
        {pricingDates.length
          ? pricingDates.map((date, index) => (
              <span key={date}>
                <time dateTime={date}>{date}</time>{index < pricingDates.length - 1 ? ', ' : ''}
              </span>
            ))
          : 'not available'}.{' '}
        {pricingNote}
      </p>
      <table className="sr-only">
        <caption>Efficiency frontier source data</caption>
        <thead><tr><th>Model</th><th>Time per Story</th><th>Estimated cost per Story</th><th>Final plan validity</th></tr></thead>
        <tbody>
          {pricedModels.map((model) => (
            <tr key={model.id}><th>{model.label}</th><td>{formatSeconds(model.meanStoryMs)}</td><td>{formatCost(model.costUsdPerStory)}</td><td>{formatPercent(model.planFinalValid)}</td></tr>
          ))}
        </tbody>
      </table>
    </ChartFrame>
  );
}

function ValidityChart({ models }: { models: BenchmarkDatum[] }) {
  const reducedMotion = Boolean(useReducedMotion());
  const sorted = [...models].sort(
    (a, b) => b.planFinalValid - a.planFinalValid || b.planFirstTryValid - a.planFirstTryValid,
  );
  const plot = { left: 258, right: 820, top: 54, row: 54 };
  const x = (value: number) => plot.left + value * (plot.right - plot.left);

  return (
    <ChartFrame
      id="repair-rescue"
      eyebrow="Validation"
      title="What the repair loop rescued"
      description="The hollow marker is first-try plan validity; the solid marker is validity after the bounded repair pass."
    >
      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <svg
          viewBox="0 0 900 470"
          className="mx-auto h-auto min-w-[46rem] max-w-[56.25rem] w-full"
          role="img"
          aria-label={`Dumbbell chart comparing first-try and final plan validity for ${sorted.length} models. The repair loop rescued up to 60 percentage points for a model.`}
        >
          <title>First-try versus final plan validity after repair</title>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const cx = x(tick);
            return (
              <g key={tick}>
                <line x1={cx} x2={cx} y1="36" y2="430" stroke={BORDER} strokeDasharray="4 6" />
                <text x={cx} y="24" textAnchor="middle" fontSize="13" fill={MUTED}>{formatPercent(tick)}</text>
              </g>
            );
          })}
          {sorted.map((model, index) => {
            const cy = plot.top + index * plot.row;
            const firstX = x(model.planFirstTryValid);
            const finalX = x(model.planFinalValid);
            return (
              <g key={model.id} data-model-id={model.id}>
                <text x={plot.left - 18} y={cy + 4} textAnchor="end" fontSize="14" fontWeight="600" fill={INK}>{model.label}</text>
                <line x1={plot.left} x2={plot.right} y1={cy} y2={cy} stroke={BORDER} />
                <motion.line
                  x1={firstX}
                  y1={cy}
                  y2={cy}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={reducedMotion ? false : { x2: firstX, opacity: 0 }}
                  animate={{ x2: finalX, opacity: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : index * 0.04, ease: EASE }}
                />
                <motion.circle
                  cx={firstX}
                  cy={cy}
                  r="8"
                  fill={CARD}
                  stroke="hsl(var(--chart-4))"
                  strokeWidth="3"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.25, delay: reducedMotion ? 0 : index * 0.04, ease: EASE }}
                />
                <motion.circle
                  cx={finalX}
                  cy={cy}
                  r="5"
                  fill="hsl(var(--chart-2))"
                  stroke={CARD}
                  strokeWidth="2"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.25, delay: reducedMotion ? 0 : 0.18 + index * 0.04, ease: EASE }}
                />
                <text x={plot.right + 18} y={cy + 4} fontSize="13" fill={MUTED}>
                  +{Math.round((model.planFinalValid - model.planFirstTryValid) * 100)} pts
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full border-[3px] border-chart-4 bg-card" aria-hidden /> First try</span>
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-chart-2" aria-hidden /> After repair</span>
      </div>
      <table className="sr-only">
        <caption>Plan validity before and after repair</caption>
        <thead><tr><th>Model</th><th>First try</th><th>After repair</th><th>Gain</th></tr></thead>
        <tbody>
          {sorted.map((model) => (
            <tr key={model.id}><th>{model.label}</th><td>{formatPercent(model.planFirstTryValid)}</td><td>{formatPercent(model.planFinalValid)}</td><td>{Math.round((model.planFinalValid - model.planFirstTryValid) * 100)} percentage points</td></tr>
          ))}
        </tbody>
      </table>
    </ChartFrame>
  );
}

function QualityChart({ models }: { models: BenchmarkDatum[] }) {
  const reducedMotion = Boolean(useReducedMotion());
  const sorted = [...models].sort((a, b) => a.repetitionMax - b.repetitionMax);
  const plot = { left: 258, right: 746, top: 56, row: 54 };
  const maxScale = 0.18;
  const width = (value: number) => (value / maxScale) * (plot.right - plot.left);

  return (
    <ChartFrame
      id="quality-fingerprint"
      eyebrow="Language quality"
      title="Quality fingerprint"
      description="Cross-scene body-token Jaccard similarity and banned filler phrases. Lower is better on every measure."
    >
      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <svg
          viewBox="0 0 900 470"
          className="mx-auto h-auto min-w-[46rem] max-w-[56.25rem] w-full"
          role="img"
          aria-label={`Horizontal bar chart comparing repetition and banned phrase counts for ${sorted.length} models. Qwen3.5 27B recorded zero repetition; GPT-OSS 120B was the only model with a banned phrase.`}
        >
          <title>Cross-scene repetition and banned phrase quality measures</title>
          {[0, 0.06, 0.12, 0.18].map((tick) => {
            const cx = plot.left + width(tick);
            return (
              <g key={tick}>
                <line x1={cx} x2={cx} y1="36" y2="430" stroke={BORDER} strokeDasharray="4 6" />
                <text x={cx} y="24" textAnchor="middle" fontSize="13" fill={MUTED}>{tick.toFixed(2)}</text>
              </g>
            );
          })}
          <text x="806" y="24" textAnchor="middle" fontSize="13" fill={MUTED}>Banned</text>
          {sorted.map((model, index) => {
            const cy = plot.top + index * plot.row;
            const maxWidth = width(model.repetitionMax);
            const meanWidth = width(model.repetitionMean);
            return (
              <g key={model.id} data-model-id={model.id}>
                <text x={plot.left - 18} y={cy + 4} textAnchor="end" fontSize="14" fontWeight="600" fill={INK}>{model.label}</text>
                <line x1={plot.left} x2={plot.right} y1={cy} y2={cy} stroke={BORDER} strokeWidth="8" strokeLinecap="round" />
                <motion.rect
                  x={plot.left}
                  y={cy - 4}
                  height="8"
                  rx="4"
                  fill="hsl(var(--chart-3))"
                  initial={reducedMotion ? false : { width: 0, opacity: 0 }}
                  animate={{ width: maxWidth, opacity: 0.5 }}
                  transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : index * 0.04, ease: EASE }}
                />
                <motion.line
                  x1={plot.left}
                  y1={cy}
                  y2={cy}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={reducedMotion ? false : { x2: plot.left, opacity: 0 }}
                  animate={{ x2: plot.left + meanWidth, opacity: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.12 + index * 0.04, ease: EASE }}
                />
                <circle cx={plot.left + maxWidth} cy={cy} r="5" fill="hsl(var(--chart-3))" />
                <circle cx={plot.left + meanWidth} cy={cy} r="3.5" fill="hsl(var(--chart-1))" stroke={CARD} strokeWidth="1.5" />
                <circle
                  cx="806"
                  cy={cy}
                  r="7"
                  fill={model.bannedPhrases ? 'hsl(var(--destructive))' : CARD}
                  stroke={model.bannedPhrases ? 'hsl(var(--destructive))' : BORDER}
                  strokeWidth="2"
                />
                <text x="824" y={cy + 4} fontSize="13" fill={MUTED}>{model.bannedPhrases}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-chart-3 opacity-50" aria-hidden /> Maximum Jaccard</span>
        <span className="inline-flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-chart-1" aria-hidden /> Mean Jaccard</span>
        <span>Right marker = banned phrase count</span>
      </div>
      <table className="sr-only">
        <caption>Repetition and banned phrase measures</caption>
        <thead><tr><th>Model</th><th>Maximum Jaccard</th><th>Mean Jaccard</th><th>Banned phrases</th></tr></thead>
        <tbody>
          {sorted.map((model) => (
            <tr key={model.id}><th>{model.label}</th><td>{model.repetitionMax.toFixed(3)}</td><td>{model.repetitionMean.toFixed(3)}</td><td>{model.bannedPhrases}</td></tr>
          ))}
        </tbody>
      </table>
    </ChartFrame>
  );
}

export default function BenchmarkCharts(props: BenchmarkChartsProps) {
  return (
    <div className="space-y-8">
      <ScatterChart {...props} />
      <ValidityChart models={props.models} />
      <QualityChart models={props.models} />
    </div>
  );
}
