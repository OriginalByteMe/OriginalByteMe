import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import BenchmarkCharts, { type BenchmarkDatum } from '@/components/benchmark/BenchmarkCharts';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { benchmark, costUsdPer1000Sites } from '@/lib/benchmark/data';

const models: BenchmarkDatum[] = benchmark.models.map((model) => ({
  ...model,
  costUsdPer1000Sites: costUsdPer1000Sites(model),
}));
const questions = models[0]?.questions ?? 0;
const references = models.filter((model) => model.pricing);
const selfHosted = models.length - references.length;
const runDates = [...new Set(models.map((model) => model.runAt.slice(0, 10)))].sort();

export const metadata: Metadata = {
  title: 'Ask-me Site Model Benchmark | Noah Rijkaard',
  description: `${models.length} models, ${selfHosted} of them self-hosted, generating the same ${questions} Ask-me sites: validity, honesty, layout fit, speed and cost.`,
};

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
        <section aria-labelledby="benchmark-heading" className="mb-10 grid gap-10 border-b border-border pb-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.26em] text-muted-foreground">
              Ask-me sites /{' '}
              {runDates.length === 0 ? (
                'Date unavailable'
              ) : runDates.length === 1 ? (
                <time dateTime={runDates[0]}>{runDates[0]}</time>
              ) : (
                <>
                  <time dateTime={runDates[0]}>{runDates[0]}</time>
                  {' – '}
                  <time dateTime={runDates[runDates.length - 1]}>{runDates[runDates.length - 1]}</time>
                </>
              )}
            </p>
            <h1 id="benchmark-heading" className="mt-5 text-balance font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {models.length} models built the same {questions} Ask-me sites.
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {selfHosted} small open models ran on the CPU of Noah&apos;s Unraid server through Ollama, at no cost per
              site.{' '}
              {references.length
                ? `${references.map((model) => model.label).join(' and ')} ran on Anthropic through Noah's Claude subscription for comparison; their costs are estimates at Anthropic's API list price. `
                : ''}
              Every question went through the production generator: one model call, the app&apos;s own validators,
              and at most one repair call.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--story-radius-md)] border border-border bg-border">
            <div className="bg-card p-4">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Models</dt>
              <dd className="mt-2 font-serif text-3xl">{models.length}</dd>
            </div>
            <div className="bg-card p-4">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Sites</dt>
              <dd className="mt-2 font-serif text-3xl">{models.reduce((sum, model) => sum + model.questions, 0)}</dd>
            </div>
            <div className="col-span-2 bg-card p-4">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">Source</dt>
              <dd className="mt-2 break-words font-mono text-sm text-card-foreground">{benchmark.source}</dd>
            </div>
          </dl>
        </section>

        <BenchmarkCharts
          models={models}
          pricingNote={benchmark.pricingNote}
          untaggedLayoutQuestions={benchmark.untaggedLayoutQuestions}
        />
      </div>
    </main>
  );
}
