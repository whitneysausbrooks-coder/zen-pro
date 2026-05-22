import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular_Italic,
} from "@expo-google-fonts/playfair-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingFlow, ONBOARDING_KEY } from "@/components/OnboardingFlow";
import { OnboardingSignIn } from "@/components/OnboardingSignIn";
import { OnboardingHealth } from "@/components/OnboardingHealth";
import { TosAcceptanceModal } from "@/components/TosAcceptanceModal";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { enableBackgroundHealthSync, getLoginMode, getHealthChoice, onSignOut, signOutAndReset } from "@/lib/health";
import {
  clearIndividualAccount,
  heartbeat,
  reconcileLocalIdentity,
  syncProfileToBackend,
} from "@/lib/userAuth";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Inner navigator wrapped by an idle-timeout listener. The wrapping View
 * captures every touch via `onStartShouldSetResponderCapture` (returning
 * false so it doesn't intercept the gesture) and bumps the activity timer.
 * After 10 minutes without activity the user is signed out and the state
 * machine drops them back at the sign-in screen.
 */
function AuthenticatedShell() {
  const handleTimeout = useCallback(() => {
    // Wipe the credential bundle and trigger the onSignOut listeners so the
    // root state machine returns to OnboardingSignIn.
    signOutAndReset().catch(() => {});
  }, []);

  const { bumpActivity } = useIdleTimeout({
    enabled: true,
    timeoutMs: 10 * 60 * 1000,
    onTimeout: handleTimeout,
  });

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        bumpActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        bumpActivity();
        return false;
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular_Italic,
  });

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [loginDone, setLoginDone] = useState<boolean | null>(null);
  const [healthDone, setHealthDone] = useState<boolean | null>(null);
  // 4th gate: the user must accept the current ToS + Privacy version before
  // they can reach the tab tree. `null` = not yet checked, false = needs
  // acceptance, true = accepted (advance to RootLayoutNav).
  const [tosDone, setTosDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("skipOnboarding") === "1") {
          window.localStorage.setItem(ONBOARDING_KEY, "1");
        }
      } catch {}
    }
    // Reconcile any orphan identity state (UUID without profile or vice versa
    // — possible after a reinstall because iOS Keychain survives uninstall
    // but AsyncStorage doesn't) BEFORE we ask the rest of the app whether
    // the user is logged in.
    reconcileLocalIdentity()
      .catch(() => {})
      .finally(() => {
        AsyncStorage.getItem(ONBOARDING_KEY)
          .then((val) => setOnboardingDone(val === "1"))
          .catch(() => setOnboardingDone(true));
        getLoginMode()
          .then((mode) => setLoginDone(mode !== null))
          .catch(() => setLoginDone(true));
        getHealthChoice()
          .then((choice) => setHealthDone(choice !== null))
          .catch(() => setHealthDone(true));
      });
  }, []);

  useEffect(() => {
    if (
      (fontsLoaded || fontError) &&
      onboardingDone !== null &&
      loginDone !== null &&
      healthDone !== null
    ) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, onboardingDone, loginDone, healthDone]);

  // Reset to the sign-in onboarding step when the user signs out from
  // Profile, the idle timer fires, account deletion completes, or the ToS
  // modal is declined. Keeps device hand-off seamless without an app restart.
  useEffect(() => {
    const unsub = onSignOut(() => {
      setLoginDone(false);
      setHealthDone(false);
      setTosDone(null);
      // Wipe the individual identity on full sign-out so the next user on
      // this device gets a fresh UUID + clean baseline.
      clearIndividualAccount().catch(() => {});
    });
    return unsub;
  }, []);

  // Once the user is fully signed in (login + health onboarding done), keep
  // the backend warm with a heartbeat and re-sync the local profile in case
  // the original registration call failed offline.
  useEffect(() => {
    if (loginDone && healthDone) {
      syncProfileToBackend().catch(() => {});
      heartbeat().catch(() => {});
    }
  }, [loginDone, healthDone]);

  // Build #14: enable HealthKit Background Delivery ONLY when the user
  // explicitly chose `apple_health` during onboarding (NOT for manual or
  // skipped choices — those users did not grant Apple Health and must not
  // have a background observer silently installed even if iOS-level health
  // permissions persist from a previous session). iOS then silently wakes
  // the app whenever the Watch writes new HRV/Sleep/Steps samples and we
  // post the fresh data to the server — no foreground required. Idempotent
  // + cleans up on sign-out via the existing onSignOut listener.
  useEffect(() => {
    if (!loginDone || !healthDone) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const choice = await getHealthChoice();
      if (cancelled || choice !== "apple_health") return;
      cleanup = await enableBackgroundHealthSync();
      if (cancelled) { try { cleanup?.(); } catch {} cleanup = undefined; }
    })().catch(() => {});
    return () => {
      cancelled = true;
      try { cleanup?.(); } catch {}
    };
  }, [loginDone, healthDone]);

  if (!fontsLoaded && !fontError) return null;
  if (onboardingDone === null || loginDone === null || healthDone === null) return null;

  const handleOnboardingComplete = () => {
    setOnboardingDone(true);
  };
  const handleLoginComplete = () => {
    setLoginDone(true);
  };
  const handleHealthComplete = () => {
    setHealthDone(true);
  };
  // Bug 3 fix: user is on the Health screen and wants to back out (e.g. they
  // signed in as the wrong account type, or want to switch from individual to
  // pilot). Reset login + health, clear partial individual identity, and let
  // the state machine drop them back at OnboardingSignIn cleanly.
  const handleHealthBack = async () => {
    try {
      await clearIndividualAccount();
      await AsyncStorage.multiRemove([
        "nq_login_done",
        "nq_health_choice",
        "nq_enterprise_email",
        "nq_enterprise_invite_code",
        "nq_health_last_sync",
      ]);
    } catch {}
    setHealthDone(false);
    setLoginDone(false);
    setTosDone(null);
  };
  // Pilot-feedback fix: user lands on Sign In and realizes they want to see
  // the splash/carousel again (or didn't actually mean to start). Wipe any
  // half-entered identity, drop the onboarding-complete flag, and let the
  // gate state machine flow back to OnboardingFlow. Mirrors handleHealthBack.
  const handleSignInBack = async () => {
    try {
      await clearIndividualAccount();
      await AsyncStorage.multiRemove([
        ONBOARDING_KEY,
        "nq_login_done",
        "nq_health_choice",
        "nq_enterprise_email",
        "nq_enterprise_invite_code",
        "nq_health_last_sync",
      ]);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(ONBOARDING_KEY);
        } catch {}
      }
    } catch {}
    setHealthDone(false);
    setLoginDone(false);
    setTosDone(null);
    setOnboardingDone(false);
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              {!onboardingDone ? (
                <OnboardingFlow onComplete={handleOnboardingComplete} />
              ) : !loginDone ? (
                <OnboardingSignIn
                  onComplete={handleLoginComplete}
                  onBack={handleSignInBack}
                />
              ) : !healthDone ? (
                <OnboardingHealth
                  onComplete={handleHealthComplete}
                  onBack={handleHealthBack}
                />
              ) : !tosDone ? (
                <TosAcceptanceModal
                  onAccepted={() => setTosDone(true)}
                  onDeclined={() => {
                    // Decline = full sign-out: credentials are wiped by the
                    // modal itself; we just have to reset the gate state so
                    // the user lands on the sign-in screen.
                    setTosDone(null);
                    setHealthDone(false);
                    setLoginDone(false);
                  }}
                />
              ) : (
                <AuthenticatedShell />
              )}
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
