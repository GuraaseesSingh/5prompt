import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProgressQueryKey, setAuthTokenGetter, type Progress, useGetProgress } from '@workspace/api-client-react';

type AppAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  /** Clerk user ID, or null for guests. Part of every per-user query key. */
  userId: string | null;
  user: ReturnType<typeof useUser>['user'];
};

type AppContextValue = {
  auth: AppAuthState;
  progress: {
    data: Progress | null;
    isLoading: boolean;
    isRefreshing: boolean;
    isError: boolean;
    refresh: () => void;
  };
};

const AppContext = createContext<AppContextValue | null>(null);

/** Query key for data that belongs to one user (or to "guest"). */
export function userScopedKey(baseKey: readonly unknown[], userId: string | null): readonly unknown[] {
  return [...baseKey, { user: userId ?? 'guest' }];
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const signedIn = isSignedIn === true;
  const userId = signedIn ? user?.id ?? null : null;

  // Send a fresh Clerk session token as "Authorization: Bearer" on every API call.
  // Why: the session cookie is a ~60s token, and Clerk's server only renews an
  // expired cookie on GET requests. A POST /api/evaluate with an expired cookie was
  // treated as a guest, hitting the 2-attempt cap (Bug A). getToken() returns a
  // valid token, refreshing it first if needed.
  // Registered in a useState initializer so it is in place before any child query runs.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  useState(() => {
    setAuthTokenGetter(async () => {
      try {
        return (await getTokenRef.current()) ?? null;
      } catch {
        return null; // Fall back to the cookie rather than failing the request.
      }
    });
    return null;
  });

  // When the signed-in user changes (sign out, or a different account), drop every
  // cached response from the previous user so nothing leaks across accounts.
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.removeQueries({ predicate: (query) => JSON.stringify(query.queryKey).includes('"user":') });
    }
    previousUserId.current = userId;
  }, [isLoaded, queryClient, userId]);

  const progressQuery = useGetProgress({
    query: {
      queryKey: userScopedKey(getGetProgressQueryKey(), userId),
      enabled: isLoaded && signedIn && userId !== null,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  });

  const auth = useMemo<AppAuthState>(
    () => ({ isLoaded, isSignedIn: signedIn, userId, user }),
    [isLoaded, signedIn, userId, user],
  );

  const progressData = signedIn ? progressQuery.data ?? null : null;

  const value = useMemo<AppContextValue>(
    () => ({
      auth,
      progress: {
        data: progressData,
        isLoading: signedIn && !progressData && progressQuery.isLoading,
        isRefreshing: signedIn && Boolean(progressData) && progressQuery.isFetching,
        isError: signedIn && progressQuery.isError,
        refresh: () => {
          if (signedIn) void progressQuery.refetch();
        },
      },
    }),
    [auth, progressData, progressQuery.isError, progressQuery.isFetching, progressQuery.isLoading, progressQuery.refetch, signedIn],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return context;
}

export function useAppAuth() {
  return useAppState().auth;
}
