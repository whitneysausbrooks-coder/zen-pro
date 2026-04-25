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
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingFlow, ONBOARDING_KEY } from "@/components/OnboardingFlow";
import { OnboardingSignIn } from "@/components/OnboardingSignIn";
import { OnboardingHealth } from "@/components/OnboardingHealth";
import { getLoginMode, getHealthChoice, onSignOut } from "@/lib/health";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
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
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => setOnboardingDone(val === "1"))
      .catch(() => setOnboardingDone(true));
    getLoginMode()
      .then((mode) => setLoginDone(mode !== null))
      .catch(() => setLoginDone(true));
    getHealthChoice()
      .then((choice) => setHealthDone(choice !== null))
      .catch(() => setHealthDone(true));
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
  // Profile or finishes account deletion. Keeps device hand-off seamless
  // without requiring an app restart.
  useEffect(() => {
    const unsub = onSignOut(() => {
      setLoginDone(false);
      setHealthDone(false);
    });
    return unsub;
  }, []);

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

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              {!onboardingDone ? (
                <OnboardingFlow onComplete={handleOnboardingComplete} />
              ) : !loginDone ? (
                <OnboardingSignIn onComplete={handleLoginComplete} />
              ) : !healthDone ? (
                <OnboardingHealth onComplete={handleHealthComplete} />
              ) : (
                <RootLayoutNav />
              )}
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
