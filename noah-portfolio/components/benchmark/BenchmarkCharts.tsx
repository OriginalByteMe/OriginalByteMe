'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { BenchmarkModel } from '@/lib/benchmark/data';

export interface BenchmarkDatum extends BenchmarkModel {
  costUsdPer1000Sites: number;
}

interface BenchmarkChartsProps {
  models: BenchmarkDatum[];
  pricingNote: string;
  untaggedLayoutQuestions: string[];
}

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
        Swipe horizontally to see all of it.
      </p>
      {children}
    </section>
  );
}

const COLUMNS = [
  'Model',
  'Valid first try',
  'Valid after repair',
  'Right mode',
  'Honest on boundary',
  'Layout fit',
  'Banned phrases',
  'Seconds per site',
  'Cost per 1,000 sites',
];

function ResultsTable({ models, pricingNote, untaggedLayoutQuestions }: BenchmarkChartsProps) {
  return (
    <ChartFrame
      id="results"
      eyebrow="Results"
      title="Same questions, same generator"
      description="Each cell counts sites out of the questions that column covers. Lower is better for banned phrases, seconds and cost; higher is better everywhere else."
    >
      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              {COLUMNS.map((column, index) => (
                <th key={column} scope="col" className={`pb-3 align-bottom font-normal ${index ? 'pl-4 text-right' : ''}`}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {models.map((model) => (
              <tr key={model.id}>
                <th scope="row" className="py-4 pr-4 font-semibold text-card-foreground">
                  {model.label}
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">{model.host}</span>
                </th>
                {[
                  `${model.firstTryValid}/${model.questions}`,
                  `${model.finalValid}/${model.questions}`,
                  `${model.rightMode}/${model.questions}`,
                  `${model.boundaryRight}/${model.boundaryQuestions}`,
                  `${model.layoutFit}/${model.layoutTagged}`,
                  model.bannedPhrases,
                  formatSeconds(model.meanMs),
                  model.costUsdPer1000Sites.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                ].map((value, index) => (
                  <td key={COLUMNS[index + 1]} className="py-4 pl-4 text-right font-mono tabular-nums text-card-foreground">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          Right mode means a valid site that cites Noah&apos;s own facts for an answerable question, and a plain
          &ldquo;I haven&apos;t shared that&rdquo; page for the rest. Honest on boundary is that second case alone: the
          salary, favourite-food and prompt-injection questions.
        </p>
        <p>
          Layout fit counts the questions whose topic maps to exactly one layout in the prompt. These{' '}
          {untaggedLayoutQuestions.length} have no single expected layout and are not scored:{' '}
          {untaggedLayoutQuestions.map((question) => `“${question}”`).join(' ')}
        </p>
        <p>
          {pricingNote}{' '}
          {models
            .flatMap((model) =>
              model.pricing
                ? [`${model.label} list price: $${model.pricing.inputUsdPerMTok.toFixed(2)} per million input tokens and $${model.pricing.outputUsdPerMTok.toFixed(2)} per million output tokens, checked ${model.pricing.pricedAt}.`]
                : [],
            )
            .join(' ')}
        </p>
      </div>
    </ChartFrame>
  );
}

function ValidityChart({ models }: { models: BenchmarkDatum[] }) {
  const reducedMotion = Boolean(useReducedMotion());
  const sorted = models
    .map((model) => ({
      ...model,
      firstTry: model.firstTryValid / model.questions,
      final: model.finalValid / model.questions,
    }))
    .sort((a, b) => b.final - a.final || b.firstTry - a.firstTry);
  const plot = { left: 258, right: 820, top: 54, row: 54 };
  const plotBottom = plot.top + Math.max(sorted.length - 1, 0) * plot.row + 52;
  const viewHeight = plotBottom + 28;
  const maxRescue = sorted.length ? Math.max(...sorted.map((model) => model.final - model.firstTry)) : 0;
  const x = (value: number) => plot.left + value * (plot.right - plot.left);

  return (
    <ChartFrame
      id="repair-rescue"
      eyebrow="Validation"
      title="What the repair call rescued"
      description="The hollow marker is the share of sites valid on the first call; the solid marker is the share valid after at most one repair call."
    >
      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <svg
          viewBox={`0 0 900 ${viewHeight}`}
          className="mx-auto h-auto min-w-[46rem] max-w-[56.25rem] w-full"
          role="img"
          aria-label={`Dumbbell chart comparing first-try and final site validity for ${sorted.length} models. The largest observed repair gain is ${Math.round(maxRescue * 100)} percentage points.`}
        >
          <title>First-try versus final site validity after repair</title>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const cx = x(tick);
            return (
              <g key={tick}>
                <line x1={cx} x2={cx} y1="36" y2={plotBottom} stroke={BORDER} strokeDasharray="4 6" />
                <text x={cx} y="24" textAnchor="middle" fontSize="13" fill={MUTED}>{formatPercent(tick)}</text>
              </g>
            );
          })}
          {sorted.map((model, index) => {
            const cy = plot.top + index * plot.row;
            const firstX = x(model.firstTry);
            const finalX = x(model.final);
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
                  +{Math.round((model.final - model.firstTry) * 100)} pts
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
      {/* A table ignores width: 1px, so the clip sits on a div; otherwise it widens the page on phones. */}
      <div className="sr-only"><table>
        <caption>Site validity before and after repair</caption>
        <thead><tr><th>Model</th><th>First try</th><th>After repair</th><th>Gain</th></tr></thead>
        <tbody>
          {sorted.map((model) => (
            <tr key={model.id}><th>{model.label}</th><td>{formatPercent(model.firstTry)}</td><td>{formatPercent(model.final)}</td><td>{Math.round((model.final - model.firstTry) * 100)} percentage points</td></tr>
          ))}
        </tbody>
      </table></div>
    </ChartFrame>
  );
}

export default function BenchmarkCharts(props: BenchmarkChartsProps) {
  return (
    <div className="space-y-8">
      <ResultsTable {...props} />
      <ValidityChart models={props.models} />
    </div>
  );
}
