import { ArrowRight, LockKeyhole, X } from 'lucide-react';
import { Link } from 'wouter';

type AuthRequiredDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function AuthRequiredDialog({ open, onClose }: AuthRequiredDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-primary/45 px-5 py-8 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-required-title"
        className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[0_24px_80px_hsl(var(--foreground)/.24)] animate-rise-in"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <LockKeyhole size={18} />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Next rep locked</p>
              <h2 id="auth-required-title" className="mt-1 font-serif text-2xl tracking-[-.03em]">Keep your practice going.</h2>
            </div>
          </div>
          <button type="button" aria-label="Close sign-in prompt" onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm leading-6 text-muted-foreground">
            Your first prompt was free. Create an account or log in to unlock the next task and keep your scores across sessions.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/sign-in" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs font-extrabold text-foreground transition-transform hover:-translate-y-0.5">
              Log in <ArrowRight size={14} />
            </Link>
            <Link href="/sign-up" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5">
              Create account <ArrowRight size={14} />
            </Link>
          </div>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">It only takes a minute to save your progress.</p>
        </div>
      </section>
    </div>
  );
}

export function AuthRequiredPanel() {
  return (
    <section className="mx-auto max-w-xl rounded-[1.5rem] border border-border bg-card p-7 text-center shadow-[0_18px_55px_hsl(var(--foreground)/.07)] sm:p-10">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <LockKeyhole size={20} />
      </span>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your practice log</p>
      <h1 className="mt-3 font-serif text-4xl tracking-[-.045em]">Sign in to see your progress.</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">Your first rep is free. Log in or create an account to unlock the full studio and keep your scores safe.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs font-extrabold text-foreground">Log in <ArrowRight size={14} /></Link>
        <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground">Create account <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}