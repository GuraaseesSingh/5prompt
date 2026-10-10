import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppStateProvider } from '@/context/app-context';
import NotFound from '@/pages/not-found';
import Practice from '@/pages/practice';
import ProgressPage from '@/pages/progress';
import Welcome from '@/pages/welcome';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
// Use the configured key as-is (pk_test_ for development, pk_live_ for production).
// Deriving it from the hostname only works when the site runs on the exact domain
// registered in Clerk; on *.vercel.app or www. it would point at a non-existent
// Clerk endpoint. The host-derived key is only a fallback when none is configured.
const clerkPubKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  publishableKeyFromHost(window.location.hostname, undefined);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Practice} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/welcome" component={Welcome} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#2D263E',
    colorForeground: '#2D263E',
    colorMutedForeground: '#746C7B',
    colorDanger: '#B5526A',
    colorBackground: '#FFFDF8',
    colorInput: '#F7F0E6',
    colorInputForeground: '#2D263E',
    colorNeutral: '#DED4C7',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.85rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-serif text-[#2d263e]',
    headerSubtitle: 'text-[#746c7b]',
    socialButtonsBlockButtonText: 'text-[#2d263e]',
    formFieldLabel: 'text-[#2d263e]',
    footerActionLink: 'text-[#2d263e] font-bold',
    footerActionText: 'text-[#746c7b]',
    dividerText: 'text-[#746c7b]',
    identityPreviewEditButton: 'text-[#2d263e]',
    formFieldSuccessText: 'text-[#2f7e78]',
    alertText: 'text-[#b5526a]',
    logoBox: 'rounded-xl overflow-hidden',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#ded4c7] bg-[#fffdf8]',
    formButtonPrimary: 'bg-[#2d263e] text-[#fffdf8]',
    formFieldInput: 'border-[#ded4c7] bg-[#f7f0e6] text-[#2d263e]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#ded4c7]',
    alert: 'border-[#e7c3c9] bg-[#fdf1f3]',
    otpCodeFieldInput: 'border-[#ded4c7] bg-[#f7f0e6] text-[#2d263e]',
    formFieldRow: 'text-[#2d263e]',
    main: 'bg-transparent',
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to continue your practice' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Save your progress and keep practicing' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>
          <Router />
        </AppStateProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
