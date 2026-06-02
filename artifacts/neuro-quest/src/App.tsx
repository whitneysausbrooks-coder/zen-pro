import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthGate } from "@/components/auth-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/landing";
import MemoryMatch from "@/pages/memory-match";
import SlotMachine from "@/pages/slot-machine";
import Subscribe from "@/pages/subscribe";
import Sponsor from "@/pages/sponsor";
import AdminPanel from "@/pages/admin";
import Onboarding from "@/pages/onboarding";
import WearableSetup from "@/pages/wearable-setup";
import { BootstrapGate } from "@/components/bootstrap-gate";
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
import ImpactPage from "@/pages/impact";
import CbiPage from "@/pages/cbi";
import TermsPage from "@/pages/terms";
import SupportPage from "@/pages/support";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
    <AuthGate>
      <PaywallGate gameName={name}>
        <Component />
      </PaywallGate>
    </AuthGate>
  );
}

const pageTransition = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0 },
  exit:     { opacity: 0, y: -8 },
  transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
};

function HomeGated() {
  const onboardingDone =
    typeof window !== "undefined" &&
    ["1", "true"].includes(localStorage.getItem("nq_onboarding_done") ?? "");

  if (onboardingDone) {
    return (
      <BootstrapGate>
        <Dashboard />
      </BootstrapGate>
    );
  }
  return <Landing />;
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
          <Route path="/"            component={HomeGated} />
          <Route path="/onboarding"  component={Onboarding} />
          <Route path="/wearable-setup" component={WearableSetup} />
          <Route path="/brain-game"  component={() => <ProtectedGame component={MemoryMatch}  name="Neural Challenge" />} />
          <Route path="/blackjack"   component={() => <ProtectedGame component={Blackjack}    name="Mind-Reader Challenge" />} />
          <Route path="/eq-game"     component={() => <ProtectedGame component={EQGame}       name="Emotional EQ" />} />
          <Route path="/pattern-pulse" component={() => <ProtectedGame component={PatternPulse} name="Pattern Pulse" />} />
          <Route path="/wellness"    component={() => <ProtectedGame component={SlotMachine}  name="Compassion Wheel" />} />
          <Route path="/subscribe"   component={Subscribe} />
          <Route path="/sponsor"     component={Sponsor} />
          <Route path="/admin"       component={AdminPanel} />
          <Route path="/elon"        component={ElonPage} />
          <Route path="/payment"     component={PaymentPage} />
          <Route path="/share"       component={SharePage} />
          <Route path="/copyright"   component={CopyrightPage} />
          <Route path="/privacy"     component={PrivacyPage} />
          <Route path="/impact"      component={ImpactPage} />
          <Route path="/cbi"         component={CbiPage} />
          <Route path="/terms"       component={TermsPage} />
          <Route path="/support"     component={SupportPage} />
          <Route                     component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary
      onError={(error, componentStack) => {
        console.error("[NeuroQuest] Unhandled render error:", error, {
          componentStack,
        });
      }}
    >
      <TooltipProvider>
        <AgeGate>
          <WouterRouter base={basePath}>
            <QueryClientProvider client={queryClient}>
              <AppRoutes />
              <MobileNav />
            </QueryClientProvider>
          </WouterRouter>
          <InstallPrompt />
          <Toaster />
        </AgeGate>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
