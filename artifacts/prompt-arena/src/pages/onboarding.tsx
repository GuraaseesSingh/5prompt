import { ArrowRight, Check, LoaderCircle, Sparkles } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetProfileQueryKey,
  type ProfileRole,
  useGetProfile,
  useUpdateProfile,
} from '@workspace/api-client-react';
import { PageEyebrow } from '@/components/studio-shell';
import { useAppAuth, userScopedKey } from '@/context/app-context';
import { getErrorMessage } from '@/lib/api-error';

const ROLES: { value: ProfileRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'marketer', label: 'Marketer' },
  { value: 'writer', label: 'Writer' },
  { value: 'other', label: 'Other' },
];

export default function Onboarding() {
  const { isLoaded, isSignedIn, userId, user } = useAppAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const profileQuery = useGetProfile({
    query: {
      queryKey: userScopedKey(getGetProfileQueryKey(), userId),
      enabled: isLoaded && isSignedIn === true && userId !== null,
      refetchOnWindowFocus: false,
    },
  });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill once: from Clerk's name (the sign-up form already asked for it).
  useEffect(() => {
    if (prefilled || !isLoaded || !profileQuery.data) return;
    setFirstName(profileQuery.data.firstName ?? user?.firstName ?? '');
    setLastName(profileQuery.data.lastName ?? user?.lastName ?? '');
    setPrefilled(true);
  }, [isLoaded, prefilled, profileQuery.data, user]);

  // Already finished onboarding (or a guest who landed here): go to practice.
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn !== true) {
      setLocation('/sign-in', { replace: true });
    } else if (profileQuery.data && profileQuery.data.role !== null) {
      setLocation('/', { replace: true });
    }
  }, [isLoaded, isSignedIn, profileQuery.data, setLocation]);

  const save = useUpdateProfile({
    mutation: {
      onSuccess: (saved) => {
        // Update the cache first so the practice page's guard sees the role at once.
        queryClient.setQueryData(userScopedKey(getGetProfileQueryKey(), userId), saved);
        setLocation('/', { replace: true });
      },
    },
  });

  const canContinue = firstName.trim() !== '' && role !== null && !save.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canContinue || role === null) return;
    save.mutate({
      data: { firstName: firstName.trim(), lastName: lastName.trim() || undefined, role },
    });
  };

  if (!isLoaded || isSignedIn !== true || profileQuery.isLoading) {
    return <div className="grid min-h-[100dvh] place-items-center bg-background"><LoaderCircle className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] max-w-[640px] flex-col justify-center px-5 py-10">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-accent"><Sparkles size={18} /></span>
        <PageEyebrow>One quick step</PageEyebrow>
        <h1 className="mt-3 font-serif text-4xl tracking-[-.04em]">Tell us a little about you</h1>
        <p className="mt-3 text-sm text-muted-foreground">We use this to pick examples that fit your work. You can change it later.</p>

        <form onSubmit={submit} className="mt-10 space-y-8" data-testid="form-onboarding">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              First name
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={60}
                required
                data-testid="input-first-name"
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Last name <span className="font-normal text-muted-foreground">(optional)</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={60}
                data-testid="input-last-name"
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-bold">I am a…</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Your role">
              {ROLES.map((item) => {
                const selected = role === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={selected}
                    data-testid={`button-role-${item.value}`}
                    onClick={() => setRole(item.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-foreground/40'
                    }`}
                  >
                    {selected && <Check size={14} />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {save.isError && (
            <p role="alert" className="text-sm text-destructive" data-testid="text-onboarding-error">
              {getErrorMessage(save.error, 'We could not save that. Please check your details and try again.')}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{role ? '' : 'Pick the role that fits best.'}</span>
            <button
              type="submit"
              disabled={!canContinue}
              data-testid="button-onboarding-next"
              aria-label="Continue to practice"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
            >
              {save.isPending ? <LoaderCircle size={16} className="animate-spin" /> : null}
              Continue to practice
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
