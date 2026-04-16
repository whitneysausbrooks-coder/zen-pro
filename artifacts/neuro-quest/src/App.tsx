import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import MemoryMatch from "@/pages/memory-match";
import SlotMachine from "@/pages/slot-machine";
import Subscribe from "@/pages/subscribe";
import Enterprise from "@/pages/enterprise";
import Sponsor from "@/pages/sponsor";
import AdminPanel from "@/pages/admin";
import AdminDashboard from "@/pages/admin-dashboard";
import Onboarding from "@/pages/onboarding";
import Blackjack from "@/pages/blackjack";
import EQGame from "@/pages/eq-game";
import PatternPulse from "@/pages/pattern-pulse";
import { MobileNav } from "@/components/mobile-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { PaywallGate } from "@/components/paywall-modal";
import { AgeGate } from "@/components/age-gate";
import ElonPage from "@/pages/elon";
import PaymentPage from "@/pages/payment";
import SharePage from "@/pages/share";
import CopyrightPage from "@/pages/copyright";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function ProtectedGame({ component: Component, name }: { component: React.ComponentType; name: string }) {
  return (
    <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
      <PaywallGate gameName={name}>
        <Component />
      </PaywallGate>
    </Show>
  );
}

const pageTransition = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0 },
  exit:     { opacity: 0, y: -8 },
  transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
};

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!localStorage.getItem("nq_onboarding_done") && location === "/") {
      navigate("/onboarding");
    }
  }, []);

  return <Dashboard />;
}

function AppRoutes() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        className="page-fade page-content"
        initial={pageTransition.initial}
        animate={pageTransition.animate}
        exit={pageTransition.exit}
        transition={pageTransition.transition}
      >
        <Switch location={location}>
          <Route path="/"            component={HomeRedirect} />
          <Route path="/onboarding"  component={Onboarding} />
          <Route path="/sign-in/*?"  component={SignInPage} />
          <Route path="/sign-up/*?"  component={SignUpPage} />
          <Route path="/brain-game"  component={() => <ProtectedGame component={MemoryMatch}  name="Neural Challenge" />} />
          <Route path="/blackjack"   component={() => <ProtectedGame component={Blackjack}    name="Mind-Reader Challenge" />} />
          <Route path="/eq-game"     component={() => <ProtectedGame component={EQGame}       name="Emotional EQ" />} />
          <Route path="/pattern-pulse" component={() => <ProtectedGame component={PatternPulse} name="Pattern Pulse" />} />
          <Route path="/wellness"    component={() => <ProtectedGame component={SlotMachine}  name="Compassion Wheel" />} />
          <Route path="/subscribe"   component={Subscribe} />
          <Route path="/enterprise"  component={Enterprise} />
          <Route path="/sponsor"     component={Sponsor} />
          <Route path="/admin"       component={AdminPanel} />
          <Route path="/admin-dashboard" component={AdminDashboard} />
          <Route path="/elon"        component={ElonPage} />
          <Route path="/payment"     component={PaymentPage} />
          <Route path="/share"       component={SharePage} />
          <Route path="/copyright"   component={CopyrightPage} />
          <Route path="/privacy"     component={PrivacyPage} />
          <Route path="/terms"       component={TermsPage} />
          <Route                     component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <AppRoutes />
        <MobileNav />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AgeGate>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <InstallPrompt />
        <Toaster />
      </AgeGate>
    </TooltipProvider>
  );
}

export default App;
