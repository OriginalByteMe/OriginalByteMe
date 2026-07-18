import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Gauge, Sparkles } from 'lucide-react';
import BenchmarkCharts, { type BenchmarkDatum } from '@/components/benchmark/BenchmarkCharts';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import {
  benchmark,
  costUsdPerStory,
  pricingSnapshotDates,
  runDates,
  storySampleSizes,
} from '@/lib/benchmark/data';

export const metadata: Metadata = {
  title: 'Story Pipeline Benchmark | Noah Rijkaard',
  description: `A ${benchmark.models.length}-model benchmark of the plan, repair, scene, and validation pipeline behind Noah Rijkaard’s generated Stories.`,
};

const chartModels: BenchmarkDatum[] = benchmark.models.map((model) => ({
  id: model.id,
  label: model.label,
  planFirstTryValid: model.planFirstTryValid,
  planFinalValid: model.planFinalValid,
  repetitionMax: model.repetitionMax,
  repetitionMean: model.repetitionMean,
  bannedPhrases: model.bannedPhrases,
  meanStoryMs: model.meanStoryMs,
  costUsdPerStory: costUsdPerStory(model),
  verdict: model.verdict,
}));

const winner = benchmark.models.find((model) => model.verdict === 'default');
const benchmarkRunDates = runDates(benchmark);
const sampleSizes = storySampleSizes(benchmark);
const sampleSizeLabel = sampleSizes.length === 0
  ? 'Story questions per model'
  : sampleSizes.length === 1
    ? `${sampleSizes[0]} Story questions per model`
    : `${sampleSizes[0]}–${sampleSizes[sampleSizes.length - 1]} Story questions per model`;

export default function BenchmarkPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
            Noah Rijkaard
          </Link>
          <div className="w-fit"><ThemeSwitch /></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:pb-28">
        <section aria-labelledby="benchmark-heading" className="grid gap-10 border-b border-border pb-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.26em] text-muted-foreground">
              Story pipeline /{' '}
              {benchmarkRunDates.length === 0 ? (
                'Date unavailable'
              ) : benchmarkRunDates.length === 1 ? (
                <time dateTime={benchmarkRunDates[0]}>{benchmarkRunDates[0]}</time>
              ) : (
                <>
                  <time dateTime={benchmarkRunDates[0]}>{benchmarkRunDates[0]}</time>
                  {' – '}
                  <time dateTime={benchmarkRunDates[benchmarkRunDates.length - 1]}>
                    {benchmarkRunDates[benchmarkRunDates.length - 1]}
                  </time>
                </>
              )}
            </p>
            <h1 id="benchmark-heading" className="mt-5 text-balance font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {benchmark.models.length} model{benchmark.models.length === 1 ? '' : 's'} entered the Story pipeline.
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {sampleSizeLabel} went through the real plan → repair → scenes pipeline and the app&apos;s own validators.{' '}
              {winner
                ? `${winner.label} won the blinded review and became the default.`
                : 'The results below compare every completed run.'}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--story-radius-md)] border border-border bg-border">
            <div className="bg-card p-4">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Models</dt>
              <dd className="mt-2 font-serif text-3xl">{benchmark.models.length}</dd>
            </div>
            <div className="bg-card p-4">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Stories</dt>
              <dd className="mt-2 font-serif text-3xl">{benchmark.models.reduce((sum, model) => sum + model.stories, 0)}</dd>
            </div>
            <div className="col-span-2 bg-card p-4">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Pipeline</dt>
              <dd className="mt-2 text-sm text-card-foreground">Plan → repair → scenes → validate</dd>
            </div>
          </dl>
        </section>

        {winner ? (
          <section aria-labelledby="winner-heading" className="my-10 grid gap-6 rounded-[var(--story-radius-md)] border border-border bg-card p-5 shadow-[var(--story-shadow)] sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-chart-2">
                <Sparkles className="size-4" strokeWidth={1.5} aria-hidden /> Selected default
              </p>
              <h2 id="winner-heading" className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">{winner.label}</h2>
              <blockquote className="mt-4 max-w-3xl border-l-2 border-chart-2 pl-4 text-base leading-relaxed text-muted-foreground">
                “{winner.note}”
              </blockquote>
            </div>
            <dl className="grid min-w-64 grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4 text-chart-2" strokeWidth={1.5} aria-hidden /> Final plans</dt>
                <dd className="mt-1 font-mono text-lg">{Math.round(winner.planFinalValid * 100)}%</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-muted-foreground"><Gauge className="size-4 text-chart-1" strokeWidth={1.5} aria-hidden /> Per Story</dt>
                <dd className="mt-1 font-mono text-lg">{(winner.meanStoryMs / 1000).toFixed(1)} s</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <BenchmarkCharts
          models={chartModels}
          pricingDates={pricingSnapshotDates(benchmark)}
          pricingNote={benchmark.pricingNote}
        />
      </div>
    </main>
  );
}
