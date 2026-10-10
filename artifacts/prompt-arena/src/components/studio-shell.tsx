import { ChartNoAxesColumnIncreasing, ChevronRight, CircleHelp, Home, LogIn, LogOut, Menu, Sparkles, X } from 'lucide-react';
import { useClerk } from '@clerk/react';
import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppAuth } from '@/context/app-context';

type StudioShellProps = {
  children: ReactNode;
  completed?: number;
  total?: number;
};

const navItems = [
  { href: '/', label: 'Practice', icon: Home },
  { href: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing },
];

export function StudioShell({ children, completed = 0, total = 5 }: StudioShellProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const percent = Math.min(100, Math.round((completed / Math.max(total, 1)) * 100));

  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-sidebar text-sidebar-foreground md:flex">
        <ShellBrand />
        <div className="flex flex-1 flex-col px-4 pb-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/45">Your studio</p>
          <nav className="space-y-1" aria-label="Main navigation">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  data-testid={`link-${label.toLowerCase()}`}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
                  <span>{label}</span>
                  {active && <ChevronRight className="ml-auto" size={15} />}
                </Link>
              );
            })}
          </nav>
          <AccountControls />
          <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-serif text-base text-sidebar-foreground">This week</span>
              <span className="font-mono text-[10px] text-sidebar-foreground/60">{completed}/{total}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-sidebar-foreground/15">
              <div className="h-full rounded-full bg-sidebar-primary transition-transform duration-700" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-sidebar-foreground/55">
              Small reps become strong instincts.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-2 px-2 text-xs text-sidebar-foreground/45">
            <CircleHelp size={14} />
            <span>Need a nudge?</span>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:hidden">
        <ShellBrand compact />
        <div className="flex items-center gap-1">
          <AccountControls compact />
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            data-testid="button-toggle-menu"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[68px] z-20 border-b border-border bg-background px-5 py-4 shadow-sm md:hidden">
          <nav className="space-y-1" aria-label="Mobile navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                data-testid={`mobile-link-${label.toLowerCase()}`}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${location === href ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <main className="min-h-[100dvh] md:pl-[252px]">{children}</main>
    </div>
  );
}

function AccountControls({ compact = false }: { compact?: boolean }) {
  const { isLoaded, isSignedIn, user } = useAppAuth();
  const { signOut } = useClerk();

  if (!isLoaded) return <div className={compact ? 'size-8' : 'h-10'} aria-hidden="true" />;

  if (!isSignedIn) {
    return (
      <Link href="/sign-in" data-testid={compact ? 'link-mobile-login' : 'link-login'} className={`flex items-center gap-2 rounded-xl text-xs font-bold transition-colors hover:bg-sidebar-accent ${compact ? 'p-2 text-muted-foreground hover:text-foreground' : 'px-3 py-2 text-sidebar-foreground/75'}`}>
        <LogIn size={15} />
        {!compact && 'Log in'}
      </Link>
    );
  }

  const name = user?.firstName || user?.username || 'Account';
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl ${compact ? 'p-1' : 'mt-6 border border-sidebar-border bg-sidebar-accent/45 px-3 py-2'}`}>
      {!compact && <span className="min-w-0 truncate text-xs font-bold text-sidebar-foreground/80">{name}</span>}
      <button type="button" data-testid={compact ? 'button-mobile-logout' : 'button-logout'} aria-label="Sign out" onClick={() => signOut()} className="rounded-lg p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
        <LogOut size={15} />
      </button>
    </div>
  );
}

function ShellBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" data-testid="link-brand" className={`flex items-center gap-3 ${compact ? '' : 'px-7 py-7'}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <Sparkles size={18} strokeWidth={2.4} />
      </span>
      <span className="leading-none">
        <span className={`block font-bold tracking-[-.03em] ${compact ? 'text-base' : 'text-[17px]'}`}>5prompt</span>
        {!compact && <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/45">practice studio</span>}
      </span>
    </Link>
  );
}

export function PageEyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] font-medium uppercase tracking-[.18em] text-muted-foreground">{children}</p>;
}

export function ConceptPill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.09em] text-muted-foreground">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color ?? 'hsl(var(--accent))' }} />
      {children}
    </span>
  );
}

export function StudioFooter() {
  return (
    <footer className="mx-auto flex max-w-[1040px] items-center justify-between border-t border-border/70 px-5 py-7 text-xs text-muted-foreground sm:px-8">
      <span className="font-serif text-base text-foreground/70">Keep showing up.</span>
      <span className="font-mono text-[10px] uppercase tracking-[.13em]">5prompt · 2026</span>
    </footer>
  );
}