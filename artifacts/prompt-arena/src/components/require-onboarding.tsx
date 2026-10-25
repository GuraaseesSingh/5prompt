import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { getGetProfileQueryKey, useGetProfile } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useAppAuth, userScopedKey } from '@/context/app-context';

/**
 * Sends a signed-in user who has not chosen a role to /onboarding.
 * This is UX only: the server still decides what each user can read or save.
 * If the profile cannot be loaded, the page is shown rather than blocked.
 */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const [, setLocation] = useLocation();
  const profileQuery = useGetProfile({
    query: {
      queryKey: userScopedKey(getGetProfileQueryKey(), userId),
      enabled: isLoaded && isSignedIn === true && userId !== null,
      refetchOnWindowFocus: false,
    },
  });
  const needsOnboarding = profileQuery.data?.role === null;

  useEffect(() => {
    if (needsOnboarding) setLocation('/onboarding', { replace: true });
  }, [needsOnboarding, setLocation]);

  // Hold the page back while we check, so a new user never sees the practice screen first.
  const checking = isLoaded && isSignedIn === true && profileQuery.isLoading;
  if (checking || needsOnboarding) return null;
  return <>{children}</>;
}
