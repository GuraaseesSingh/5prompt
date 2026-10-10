import { ArrowRight, Check, ClipboardPenLine, Lightbulb, LoaderCircle, RotateCcw, Send, Sparkles, Target, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  getGetTaskQueryKey,
  getListTasksQueryKey,
  type Evaluation,
  useEvaluatePrompt,
  useGetTask,
  useListTasks,
} from '@workspace/api-client-react';
import { ConceptPill, PageEyebrow, StudioFooter, StudioShell } from '@/components/studio-shell';
import { AuthRequiredDialog, WelcomeAuthDialog } from '@/components/auth-required-dialog';
import { useAppState, userScopedKey } from '@/context/app-context';
import { getErrorMessage, getErrorStatus } from '@/lib/api-error';

function useDemoHistory() {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem('prompt-arena-scores') : null;
  const scores = saved ? saved.split(',').map(Number).filter((score) => Number.isFinite(score)) : [];
  return scores;
}

export default function Practice() {
  const { auth, progress } = useAppState();
  // The next task is per user, so wait for Clerk to know who is signed in and key
  // the cache by user: switching accounts can never show someone else's task.
  const taskQuery = useGetTask({
    query: {
      queryKey: userScopedKey(getGetTaskQueryKey(), auth.userId),
      enabled: auth.isLoaded,
      refetchOnWindowFocus: false,
    },
  });
  const tasksQuery = useListTasks({ query: { queryKey: getListTasksQueryKey() } });
  const evaluate = useEvaluatePrompt();
  const [prompt, setPrompt] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [demoScores, setDemoScores] = useState(useDemoHistory);
  const [showTip, setShowTip] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showWelcomeAuthPrompt, setShowWelcomeAuthPrompt] = useState(false);
  const [freeAttemptCount, setFreeAttemptCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const savedCount = Number(window.localStorage.getItem('prompt-arena-free-attempt-count'));
    if (Number.isFinite(savedCount)) return savedCount;
    return window.localStorage.getItem('prompt-arena-free-attempt-used') === 'true' ? 1 : 0;
  });

  useEffect(() => {
    if (auth.isLoaded && auth.isSignedIn) {
      setShowAuthPrompt(false);
      setShowWelcomeAuthPrompt(false);
    }
    if (auth.isLoaded && !auth.isSignedIn && window.localStorage.getItem('prompt-arena-welcome-auth-dismissed') !== 'true') {
      setShowWelcomeAuthPrompt(true);
    }
  }, [auth.isLoaded, auth.isSignedIn]);

  const task = taskQuery.data;
  const total = tasksQuery.data?.length ?? 5;
  const completed = task ? Math.max(0, task.order - 1) : 0;
  const isLoading = !task && !taskQuery.isError;
  const isEvaluating = evaluate.isPending;
  const guestLimitApplies = auth.isLoaded && !auth.isSignedIn;

  const scoreTone = useMemo(() => {
    if (!evaluation) return '';
    if (evaluation.score >= 8) return 'strong';
    if (evaluation.score >= 5) return 'growing';
    return 'starting';
  }, [evaluation]);

  const submitPrompt = () => {
    if (!task || prompt.trim().length < 10 || isEvaluating) return;
    if (!auth.isLoaded) return;
    if (freeAttemptCount >= 2 && guestLimitApplies) {
      setShowAuthPrompt(true);
      return;
    }
    setHasSubmitted(true);
    setSubmitError(null);
    evaluate.mutate(
      { data: { taskId: task.id, userPrompt: prompt.trim() } },
      {
        onSuccess: (result) => {
           setEvaluation(result);
            if (!auth.isSignedIn) {
             const nextFreeAttemptCount = freeAttemptCount + 1;
             setFreeAttemptCount(nextFreeAttemptCount);
             window.localStorage.setItem('prompt-arena-free-attempt-count', String(nextFreeAttemptCount));
           }
          const nextScores = [...demoScores, result.score].slice(-8);
          setDemoScores(nextScores);
          window.localStorage.setItem('prompt-arena-scores', nextScores.join(','));
          // Don't refetch the task yet: the card must keep showing the task this
          // feedback is about. "Try the next rep" (nextTask) loads the next one.
          if (auth.isSignedIn) progress.refresh();
        },
        onError: (error) => {
          // Let the user edit and resubmit. Never show a made-up evaluation:
          // a fake score would teach the wrong lesson and hide real outages.
          setHasSubmitted(false);
          if (getErrorStatus(error) === 401 && !auth.isSignedIn) {
            setShowAuthPrompt(true);
            return;
          }
          if (getErrorStatus(error) === 401) {
            // Signed in on this page but the server did not recognise the session (Bug A).
            setSubmitError('We could not confirm your sign-in. Please try again, or sign out and back in.');
            return;
          }
          setSubmitError(getErrorMessage(error, 'The prompt coach is unavailable right now. Your prompt is still here — please try again.'));
        },
      },
    );
  };

  const nextTask = () => {
    setPrompt('');
    setEvaluation(null);
    setHasSubmitted(false);
    setSubmitError(null);
    setShowTip(false);
    taskQuery.refetch();
  };

  return (
    <StudioShell completed={completed} total={total}>
      <div className="paper-grid min-h-[calc(100dvh-68px)] md:min-h-[100dvh]">
        <div className="mx-auto max-w-[1040px] px-5 pb-12 pt-8 sm:px-8 md:pt-12">
          <header className="mb-10 flex items-start justify-between gap-5">
            <div>
              <PageEyebrow>Daily practice · {completed + 1} of {total}</PageEyebrow>
              <h1 className="mt-3 max-w-xl font-serif text-[2.45rem] leading-[.98] tracking-[-.045em] text-foreground sm:text-5xl">
                One prompt. <span className="text-muted-foreground/70">One useful rep.</span>
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">A few focused minutes today will make your next prompt easier to write.</p>
            </div>
            <Link href="/progress" data-testid="link-practice-progress" className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-transform hover:-translate-y-0.5 sm:flex">
              <Target size={15} />
              See progress
            </Link>
          </header>

          <div className="mb-8 flex items-center gap-2" aria-label="Practice progress">
            {Array.from({ length: Math.max(total, 5) }).map((_, index) => (
              <span key={index} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${index < completed ? 'bg-primary' : index === completed ? 'bg-accent' : 'bg-border'}`} data-testid={`progress-step-${index + 1}`} />
            ))}
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{completed}/{total}</span>
          </div>
          {isLoading ? <TaskSkeleton /> : !task ? (
            <div className="rounded-[1.35rem] border border-border bg-card p-8 text-center animate-rise-in" role="alert" data-testid="status-task-error">
              <p className="font-serif text-2xl tracking-[-.025em]">We couldn’t load your task.</p>
              <p className="mt-2 text-sm text-muted-foreground">Check your connection, then try again.</p>
              <button type="button" data-testid="button-retry-task" onClick={() => taskQuery.refetch()} className="mt-5 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground">Try again</button>
            </div>
          ) : (
            <section className="grid gap-5 lg:grid-cols-[1.04fr_.96fr]">
              <article className="animate-rise-in rounded-[1.35rem] border border-border bg-card p-6 shadow-[0_12px_35px_hsl(var(--foreground)/.05)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <ConceptPill color={task.categoryColor}>{task.category}</ConceptPill>
                  <span className="font-mono text-[10px] text-muted-foreground">TASK {String(task.order).padStart(2, '0')}</span>
                </div>
                <h2 className="mt-8 max-w-md font-serif text-3xl leading-[1.05] tracking-[-.035em] sm:text-[2.7rem]" data-testid="text-task-title">{task.title}</h2>
                <p className="mt-5 max-w-lg text-[15px] leading-7 text-foreground/70" data-testid="text-task-brief">{task.brief}</p>
                <div className="mt-8 rounded-xl bg-secondary/60 p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="mt-0.5 shrink-0 text-accent-foreground" size={17} />
                    <div>
                      <p className="text-xs font-bold text-foreground">Tiny nudge</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.tip}</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="button-show-tip"
                  onClick={() => setShowTip((value) => !value)}
                  className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Sparkles size={14} /> {showTip ? 'Hide concept note' : `Learn about ${task.conceptFocus}`}
                </button>
                {showTip && <p className="mt-3 border-l-2 border-accent pl-3 text-xs leading-5 text-muted-foreground animate-rise-in">Good prompts give the reader a job, a destination, and enough context to get there. Today, just practise the first piece.</p>}
              </article>

              <article className="animate-rise-in rounded-[1.35rem] border border-foreground/10 bg-primary p-5 text-primary-foreground shadow-[0_14px_40px_hsl(var(--foreground)/.11)] sm:p-7" style={{ animationDelay: '90ms' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary-foreground/70">
                    <ClipboardPenLine size={16} />
                    <span className="font-mono text-[10px] uppercase tracking-[.13em]">Your prompt</span>
                  </div>
                  <span className="font-mono text-[10px] text-primary-foreground/45">{prompt.length}/1500</span>
                </div>
                <label htmlFor="prompt-input" className="sr-only">Write your prompt</label>
                <textarea
                  id="prompt-input"
                  data-testid="input-prompt"
                  value={prompt}
                   maxLength={1500}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={hasSubmitted}
                  placeholder="Start with the person or role you want the answer to take…"
                  className="mt-6 min-h-[235px] w-full resize-none bg-transparent font-serif text-xl leading-8 text-primary-foreground placeholder:text-primary-foreground/35 focus:outline-none sm:min-h-[270px] sm:text-2xl"
                />
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-primary-foreground/15 pt-4">
                   <span className="text-[11px] text-primary-foreground/50">
                      {guestLimitApplies && freeAttemptCount >= 2 ? 'Sign in to unlock your next rep' : prompt.trim().length < 10 && !hasSubmitted ? 'At least 10 characters to begin' : 'Ready when you are'}
                   </span>
                  <button
                    type="button"
                    data-testid="button-submit-prompt"
                    disabled={prompt.trim().length < 10 || isEvaluating || hasSubmitted}
                    onClick={submitPrompt}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs font-extrabold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isEvaluating ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                    {isEvaluating ? 'Reading it…' : 'Get feedback'}
                  </button>
                </div>
                {submitError && (
                  <p className="mt-3 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs text-primary-foreground" role="alert" data-testid="text-submit-error">{submitError}</p>
                )}
              </article>
            </section>
          )}

          {evaluation && (
            <FeedbackCard evaluation={evaluation} tone={scoreTone} onNext={nextTask} />
          )}
          {!evaluation && demoScores.length > 0 && (
            <p className="mt-6 text-center text-xs text-muted-foreground animate-rise-in" data-testid="text-practice-encouragement">
              Your last few reps are saved on this device. Keep the rhythm going.
            </p>
          )}
        </div>
        <StudioFooter />
      </div>
      <AuthRequiredDialog open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
      <WelcomeAuthDialog
        open={showWelcomeAuthPrompt}
        onClose={() => {
          setShowWelcomeAuthPrompt(false);
          window.localStorage.setItem('prompt-arena-welcome-auth-dismissed', 'true');
        }}
      />
    </StudioShell>
  );
}

function FeedbackCard({ evaluation, tone, onNext }: { evaluation: Evaluation; tone: string; onNext: () => void }) {
  const scoreLabel = tone === 'strong' ? 'Strong rep' : tone === 'growing' ? 'Good direction' : 'A useful start';
  return (
    <section className="mt-6 overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-[0_12px_35px_hsl(var(--foreground)/.05)] animate-rise-in" data-testid="section-feedback">
      <div className="grid lg:grid-cols-[190px_1fr]">
        <div className="flex flex-col items-center justify-center border-b border-border bg-secondary/50 px-6 py-8 text-center lg:border-b-0 lg:border-r">
          <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your score</p>
          <div className="my-2 font-serif text-7xl leading-none tracking-[-.08em] text-foreground animate-score-pop" data-testid="text-evaluation-score">{evaluation.score}<span className="text-2xl text-muted-foreground/50">/10</span></div>
          <span className="rounded-full bg-accent/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-foreground">{scoreLabel}</span>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <PageEyebrow>Feedback on {evaluation.conceptFocus}</PageEyebrow>
              <h2 className="mt-2 font-serif text-2xl tracking-[-.025em]">You’re building the instinct.</h2>
            </div>
            <Check className="rounded-full bg-accent p-2 text-accent-foreground" size={35} />
          </div>
          <p className="mt-5 text-sm leading-6 text-foreground/75" data-testid="text-encouragement">{evaluation.encouragement}</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Next time, try</p>
              {evaluation.flaws.length === 0 ? (
                <p className="text-xs leading-5 text-muted-foreground" data-testid="text-no-flaws">No major gaps. This prompt already covers the concept well.</p>
              ) : (
                <ul className="space-y-2.5">
                  {evaluation.flaws.map((flaw, index) => <li key={index} className="flex gap-2 text-xs leading-5 text-muted-foreground" data-testid={`text-feedback-flaw-${index}`}><X size={14} className="mt-0.5 shrink-0 text-destructive" />{flaw}</li>)}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">A stronger version</p>
              <p className="font-serif text-sm leading-6 text-foreground/80" data-testid="text-improved-rewrite">“{evaluation.improvedRewrite}”</p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <button type="button" data-testid="button-try-again" onClick={onNext} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold text-foreground transition-colors hover:bg-secondary"><RotateCcw size={14} /> Try the next rep</button>
            <Link href="/progress" data-testid="link-feedback-progress" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">See your progress <ArrowRight size={14} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskSkeleton() {
  return (
    <div className="grid animate-pulse gap-5 lg:grid-cols-[1.04fr_.96fr]">
      <div className="h-[480px] rounded-[1.35rem] bg-card/70" />
      <div className="h-[480px] rounded-[1.35rem] bg-primary/70" />
    </div>
  );
}