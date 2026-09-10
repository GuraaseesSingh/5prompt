import { ArrowRight, Check, PenLine, RotateCw, Sparkles, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { PageEyebrow } from '@/components/studio-shell';

export default function Welcome() {
  const [started, setStarted] = useState(false);

  const begin = () => {
    setStarted(true);
    window.localStorage.setItem('prompt-arena-welcomed', 'true');
  };

  return (
    <div className="grain min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1200px] flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link href="/" data-testid="link-welcome-brand" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-accent"><Sparkles size={18} /></span>
            <span className="font-bold tracking-[-.03em]">5prompt</span>
          </Link>
          <Link href="/" data-testid="link-welcome-skip" className="text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">Skip to practice</Link>
        </header>

        <main className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.08fr_.92fr] lg:gap-20 lg:py-20">
          <section className="animate-rise-in">
            <PageEyebrow>A small studio for better prompts</PageEyebrow>
            <h1 className="mt-5 max-w-2xl font-serif text-[3.7rem] leading-[.9] tracking-[-.065em] sm:text-7xl lg:text-[6.4rem]">Practice makes <span className="text-muted-foreground/65">clearer.</span></h1>
            <p className="mt-8 max-w-lg text-base leading-7 text-muted-foreground">5prompt gives you one friendly challenge at a time, then helps you notice what made your words work better.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/" data-testid="link-welcome-start" onClick={begin} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5">Start a practice rep <ArrowRight size={16} /></Link>
              <span className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">No account needed</span>
            </div>
            {started && <p className="mt-4 flex items-center gap-2 text-xs font-bold text-foreground animate-rise-in" data-testid="status-welcome-started"><Check size={14} className="text-accent-foreground" /> Your studio is ready.</p>}
          </section>

          <section className="relative animate-rise-in" style={{ animationDelay: '100ms' }}>
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/25 blur-3xl" />
            <div className="relative rounded-[1.6rem] border border-border bg-card p-5 shadow-[0_20px_70px_hsl(var(--foreground)/.09)] sm:p-7">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-secondary"><PenLine size={15} /></span><span className="text-sm font-bold">Today’s rep</span></div>
                <span className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">01 / 05</span>
              </div>
              <div className="py-7">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">Concept · Context</p>
                <p className="mt-4 font-serif text-3xl leading-[1.02] tracking-[-.04em]">Ask for something specific, not just something good.</p>
                <div className="mt-6 space-y-3">
                  {['A clear role', 'A useful destination', 'Enough context'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3 text-sm text-foreground/75"><span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${index === 0 ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'}`}>{index === 0 ? <Check size={12} /> : index + 1}</span>{item}</div>)}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                <span className="text-xs text-primary-foreground/60">A few minutes is enough.</span>
                <Sparkles size={15} className="text-accent" />
              </div>
            </div>
          </section>
        </main>

        <footer className="grid gap-5 border-t border-border/70 py-7 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-2"><RotateCw size={15} className="text-foreground" /><span>Repetition over perfection</span></div>
          <div className="flex items-center gap-2"><UsersRound size={15} className="text-foreground" /><span>Made for curious humans</span></div>
          <div className="text-left sm:text-right"><span className="font-mono text-[10px] uppercase tracking-[.13em]">Your progress stays yours</span></div>
        </footer>
      </div>
    </div>
  );
}