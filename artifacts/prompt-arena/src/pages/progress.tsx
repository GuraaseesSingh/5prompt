import { ArrowRight, Check, Flame, LoaderCircle, LockKeyhole, RotateCcw, Sparkles, Target, TrendingUp } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link } from 'wouter';
import { getGetProgressQueryKey, type Checkpoint, type Progress, useGetCheckpoint, useGetProgress } from '@workspace/api-client-react';
import { ConceptPill, PageEyebrow, StudioFooter, StudioShell } from '@/components/studio-shell';
import { AuthRequiredPanel } from '@/components/auth-required-dialog';

const fallbackProgress: Progress = {
  completed: 2,
  total: 5,
  averageScore: 6.8,
  currentConcept: 'Context',
  streak: 3,
  scores: [5, 7, 6, 8, 7],
};

function deviceScores() {
  if (typeof window === 'undefined') return [];
  const value = window.localStorage.getItem('prompt-arena-scores');
  return value ? value.split(',').map(Number).filter(Number.isFinite) : [];
}

export default function ProgressPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const progressQuery = useGetProgress({ query: { queryKey: getGetProgressQueryKey() } });
  const checkpoint = useGetCheckpoint();
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [savedScores] = useState(deviceScores);
  const progress = progressQuery.data ?? { ...fallbackProgress, scores: savedScores.length ? savedScores : fallbackProgress.scores };
  const percentage = Math.round((progress.completed / Math.max(progress.total, 1)) * 100);
  const scores = progress.scores?.slice(-7) ?? [];
  const best = scores.length ? Math.max(...scores) : 0;

  if (authLoaded && !isSignedIn) {
    return (
      <StudioShell>
        <div className="paper-grid min-h-[calc(100dvh-68px)] px-5 py-12 md:min-h-[100dvh] sm:px-8">
          <AuthRequiredPanel />
        </div>
        <StudioFooter />
      </StudioShell>
    );
  }

  const revealCheckpoint = () => {
    setShowCheckpoint(true);
    checkpoint.mutate({ data: { completed: progress.completed } });
  };

  return (
    <StudioShell completed={progress.completed} total={progress.total}>
      <div className="min-h-[calc(100dvh-68px)] bg-background md:min-h-[100dvh]">
        <div className="mx-auto max-w-[1040px] px-5 pb-12 pt-8 sm:px-8 md:pt-12">
          <header className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <PageEyebrow>Your practice log</PageEyebrow>
              <h1 className="mt-3 font-serif text-[2.7rem] leading-none tracking-[-.05em] sm:text-5xl">Progress you can feel.</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Not a leaderboard. Just a clear picture of the reps you’ve put in.</p>
            </div>
            <Link href="/" data-testid="link-progress-practice" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5"><Target size={15} /> Practice now</Link>
          </header>

          {progressQuery.isError && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/50 bg-accent/15 px-4 py-3 text-xs animate-rise-in" role="status" data-testid="status-progress-demo">
              <span>Showing your local practice snapshot while progress reconnects.</span>
              <button type="button" data-testid="button-retry-progress" onClick={() => progressQuery.refetch()} className="font-bold underline underline-offset-4">Try again</button>
            </div>
          )}
          {progressQuery.isLoading && !progressQuery.data ? <ProgressSkeleton /> : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Tasks completed" value={`${progress.completed}/${progress.total}`} detail={`${percentage}% of this set`} icon={<Check size={16} />} accent="apricot" />
                <StatCard label="Average score" value={progress.averageScore.toFixed(1)} detail={progress.averageScore >= 7 ? 'A strong rhythm' : 'Room to grow'} icon={<TrendingUp size={16} />} accent="lavender" />
                <StatCard label="Current concept" value={progress.currentConcept} detail="Your next lens" icon={<Sparkles size={16} />} accent="sage" compact />
                <StatCard label="Practice streak" value={`${progress.streak} days`} detail="Keep the thread going" icon={<Flame size={16} />} accent="yellow" />
              </section>

              <section className="mt-5 grid gap-5 lg:grid-cols-[1.18fr_.82fr]">
                <div className="rounded-[1.35rem] border border-border bg-card p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <PageEyebrow>Recent scores</PageEyebrow>
                      <h2 className="mt-2 font-serif text-2xl tracking-[-.025em]">Every attempt leaves a trace.</h2>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Best</p>
                      <p className="mt-1 font-serif text-2xl">{best}<span className="text-sm text-muted-foreground">/10</span></p>
                    </div>
                  </div>
                  <ScoreChart scores={scores} />
                </div>

                <div className="rounded-[1.35rem] border border-border bg-primary p-6 text-primary-foreground sm:p-8">
                  <div className="flex items-center gap-2 text-primary-foreground/65"><Sparkles size={16} /><span className="font-mono text-[10px] uppercase tracking-[.14em]">Right now</span></div>
                  <h2 className="mt-7 font-serif text-3xl leading-[1.03] tracking-[-.035em]">Your next useful focus is <span className="text-accent">{progress.currentConcept}.</span></h2>
                  <p className="mt-5 text-sm leading-6 text-primary-foreground/65">You don’t need to master everything at once. Notice one thing, then practise it again.</p>
                  <Link href="/" data-testid="link-current-focus" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs font-extrabold text-accent-foreground transition-transform hover:-translate-y-0.5">Work on {progress.currentConcept} <ArrowRight size={15} /></Link>
                </div>
              </section>

              <section className="mt-5 rounded-[1.35rem] border border-border bg-secondary/50 p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-foreground shadow-sm"><LockKeyhole size={18} /></div>
                    <div>
                      <PageEyebrow>Checkpoint review</PageEyebrow>
                      <h2 className="mt-2 font-serif text-2xl tracking-[-.025em]">See what your last five reps taught you.</h2>
                      <p className="mt-2 text-sm text-muted-foreground">A short reflection, not a test.</p>
                    </div>
                  </div>
                  <button type="button" data-testid="button-view-checkpoint" onClick={revealCheckpoint} disabled={checkpoint.isPending} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-foreground transition-colors hover:bg-background disabled:opacity-60">
                    {checkpoint.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    {showCheckpoint ? 'Refresh checkpoint' : 'View checkpoint'}
                  </button>
                </div>
                {showCheckpoint && <CheckpointCard data={checkpoint.data ?? fallbackCheckpoint(progress)} />}
              </section>
            </>
          )}
        </div>
        <StudioFooter />
      </div>
    </StudioShell>
  );
}

function StatCard({ label, value, detail, icon, accent, compact = false }: { label: string; value: string; detail: string; icon: ReactNode; accent: string; compact?: boolean }) {
  const colors: Record<string, string> = { apricot: 'bg-accent/25', lavender: 'bg-[#e5ddf2]', sage: 'bg-[#d9e8dc]', yellow: 'bg-[#f2e7b9]' };
  return (
    <div className="rounded-[1.2rem] border border-border bg-card p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between"><span className={`grid size-8 place-items-center rounded-lg ${colors[accent]} text-foreground`}>{icon}</span><span className="font-mono text-[10px] text-muted-foreground">01</span></div>
      <p className={`mt-7 font-serif leading-none tracking-[-.04em] ${compact ? 'text-2xl' : 'text-4xl'}`} data-testid={`text-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
      <p className="mt-3 text-xs font-bold text-foreground/70">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function ScoreChart({ scores }: { scores: number[] }) {
  const chartScores = scores.length ? scores : [0];
  return (
    <div className="mt-8">
      <div className="relative h-[190px] border-b border-l border-border/80">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border/70" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
        <div className="absolute -left-7 top-[-7px] font-mono text-[9px] text-muted-foreground">10</div><div className="absolute -left-6 top-[47%] font-mono text-[9px] text-muted-foreground">5</div>
        <div className="absolute inset-0 flex items-end justify-around gap-2 px-4">
          {chartScores.map((score, index) => <div key={`${score}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-[34px] rounded-t-lg bg-accent transition-transform duration-500 hover:scale-x-110" style={{ height: `${Math.max(score * 10, score ? 8 : 2)}%` }} data-testid={`bar-score-${index}`} /><span className="font-mono text-[9px] text-muted-foreground">{index + 1}</span></div>)}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Your last {scores.length || 0} practice scores</p>
    </div>
  );
}

function CheckpointCard({ data }: { data: Checkpoint }) {
  return (
    <div className="mt-7 grid gap-4 border-t border-border pt-6 sm:grid-cols-3 animate-rise-in">
      <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">The headline</p><p className="mt-2 font-serif text-lg">{data.headline}</p></div>
      <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">You’ve strengthened</p><p className="mt-2 text-sm leading-5 text-foreground/75">{data.conceptMastered}</p></div>
      <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">Next focus</p><p className="mt-2 text-sm leading-5 text-foreground/75">{data.nextFocus}</p></div>
    </div>
  );
}

function fallbackCheckpoint(progress: Progress): Checkpoint {
  return {
    completed: progress.completed,
    averageScore: progress.averageScore,
    conceptMastered: 'Giving a request a clear role and audience.',
    recurringWeakness: 'Adding enough context for the answer to land well.',
    headline: 'You are learning to be more specific.',
    nextFocus: `Practise adding context to your ${progress.currentConcept} prompts.`,
  };
}

function ProgressSkeleton() {
  return <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="h-40 rounded-[1.2rem] bg-card" /><div className="h-40 rounded-[1.2rem] bg-card" /><div className="h-40 rounded-[1.2rem] bg-card" /><div className="h-40 rounded-[1.2rem] bg-card" /></div>;
}