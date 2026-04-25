import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  setStoredEmail,
  setStoredInviteCode,
  setLoginMode,
  clearStoredCredentials,
} from "@/lib/health";

const { width, height } = Dimensions.get("window");
const nd = Platform.OS !== "web";

function getApiBase(): string {
  return Platform.OS === "web" ? "" : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
}

interface Props {
  onComplete: () => void;
}

export function OnboardingSignIn({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const orbPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: nd }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: nd }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, { toValue: 1, duration: 3000, useNativeDriver: nd }),
        Animated.timing(orbPulse, { toValue: 0, duration: 3000, useNativeDriver: nd }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const orbScale = orbPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const orbOpacity = orbPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 0.4, 0.25],
  });

  const validEmail = (s: string) => /\S+@\S+\.\S+/.test(s.trim());

  const onEnterprise = useCallback(async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    const c = inviteCode.trim().toUpperCase();
    if (!validEmail(e)) {
      setError("Please enter a valid work email.");
      return;
    }
    if (c.length < 4) {
      setError("Enter the company invite code your admin shared.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${getApiBase()}/api/enterprise/lookup-invite?code=${encodeURIComponent(c)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        setError(
          "We couldn't find that invite code. Double-check the code your admin shared.",
        );
        setBusy(false);
        return;
      }
      await setStoredEmail(e);
      await setStoredInviteCode(c);
      await setLoginMode("enterprise");
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (err: any) {
      setError(err?.message || "Network error. Please try again.");
      setBusy(false);
    }
  }, [email, inviteCode, onComplete]);

  const onIndividual = useCallback(async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    if (e && !validEmail(e)) {
      setError("Please enter a valid email or leave it blank.");
      return;
    }
    // Clear any prior enterprise credentials so individual mode never inherits
    // a previous user's sync identity (data isolation).
    await clearStoredCredentials();
    if (e) await setStoredEmail(e);
    await setLoginMode("individual");
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  }, [email, onComplete]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.black]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            backgroundColor: Colors.neuralPurple,
            transform: [{ scale: orbScale }],
            opacity: orbOpacity,
          },
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          >
            <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>
              Pilot member? Use your work email and the invite code your admin shared.
              Otherwise, continue as an individual.
            </Text>

            <View style={styles.card}>
              <Text style={styles.label}>Work email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@yourcompany.com"
                placeholderTextColor={Colors.whiteAlpha30}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                accessibilityLabel="Work email"
                returnKeyType="next"
              />

              <Text style={[styles.label, { marginTop: 16 }]}>
                Company invite code <Text style={styles.optional}>(pilot members)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. SJK3M67C"
                placeholderTextColor={Colors.whiteAlpha30}
                autoCapitalize="characters"
                autoCorrect={false}
                value={inviteCode}
                onChangeText={(t) => {
                  setInviteCode(t);
                  setError(null);
                }}
                accessibilityLabel="Company invite code"
                returnKeyType="done"
              />

              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={onEnterprise}
                disabled={busy}
                style={({ pressed }) => [
                  styles.ctaWrap,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign in as pilot member"
              >
                <LinearGradient
                  colors={[Colors.neuralPurple, Colors.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}
                >
                  {busy ? (
                    <ActivityIndicator color={Colors.forestDeep} />
                  ) : (
                    <Text style={styles.ctaText}>Sign In as Pilot Member</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>OR</Text>
              <View style={styles.line} />
            </View>

            <Pressable
              onPress={onIndividual}
              disabled={busy}
              style={({ pressed }) => [
                styles.ghostBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continue as individual"
            >
              <Text style={styles.ghostText}>Continue as Individual</Text>
            </Pressable>

            <Text style={styles.footnote}>
              Your email is stored only on this device unless you sign in as a pilot
              member. We never sell or share your data.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  orb: {
    position: "absolute",
    top: -height * 0.12,
    right: -width * 0.3,
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.45,
  },
  scroll: { paddingHorizontal: 28, gap: 18 },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.neuralPurple,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 38,
    color: Colors.white,
    textAlign: "center",
    lineHeight: 46,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.18)",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.whiteAlpha60,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  optional: { color: Colors.whiteAlpha30, fontWeight: "400" },
  input: {
    color: Colors.white,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
    fontFamily: "Inter_400Regular",
  },
  error: {
    color: "#FCA5A5",
    fontSize: 13,
    marginTop: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  ctaWrap: { width: "100%", marginTop: 18 },
  cta: { paddingVertical: 16, borderRadius: 100, alignItems: "center" },
  ctaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.forestDeep,
    letterSpacing: 0.3,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.whiteAlpha20 },
  or: {
    color: Colors.whiteAlpha60,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  ghostBtn: {
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.whiteAlpha30,
  },
  ghostText: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  footnote: {
    color: Colors.whiteAlpha30,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 18,
    paddingHorizontal: 12,
  },
});
