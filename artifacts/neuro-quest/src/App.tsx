import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import MemoryMatch from "@/pages/memory-match";
import SlotMachine from "@/pages/slot-machine";
import Subscribe from "@/pages/subscribe";
import Enterprise from "@/pages/enterprise";
import Sponsor from "@/pages/sponsor";
import AdminPanel from "@/pages/admin";
import Onboarding from "@/pages/onboarding";
import Blackjack from "@/pages/blackjack";
import EQGame from "@/pages/eq-game";
import { MobileNav } from "@/components/mobile-nav";
import { InstallPrompt } from "@/components/install-prompt";
import ElonPage from "@/pages/elon";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const pageTransition = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0 },
  exit:     { opacity: 0, y: -8 },
  transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
};

function Router() {
  const [location, navigate] = useLocation();

  // Redirect first-time visitors to onboarding
  useEffect(() => {
    if (!localStorage.getItem("nq_onboarding_done") && location === "/") {
      navigate("/onboarding");
    }
  }, []);

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
          <Route path="/"            component={Dashboard}   />
          <Route path="/onboarding"  component={Onboarding}  />
          <Route path="/brain-game"  component={MemoryMatch} />
          <Route path="/blackjack"   component={Blackjack}   />
          <Route path="/eq-game"     component={EQGame}      />
          <Route path="/casino"      component={SlotMachine} />
          <Route path="/subscribe"   component={Subscribe}   />
          <Route path="/enterprise"  component={Enterprise}  />
          <Route path="/sponsor"     component={Sponsor}     />
          <Route path="/admin"       component={AdminPanel}  />
          <Route path="/elon"        component={ElonPage}    />
          <Route                     component={NotFound}    />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <MobileNav />
        </WouterRouter>
        <InstallPrompt />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
