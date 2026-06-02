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
  setLoginMode,
  clearStoredCredentials,
} from "@/lib/health";
import { registerIndividual } from "@/lib/userAuth";

const { width, height } = Dimensions.get("window");
const nd = Platform.OS !== "web";

function getApiBase(): string {
  return Platform.OS === "web" ? "" : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
}

interface Props {
  onComplete: () => void;
  onBack?: () => void | Promise<void>;
}

export function OnboardingSignIn({ onComplete, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const isResettingRef = useRef(false);
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

  const onIndividual = useCallback(async () => {
    setError(null);
    const n = name.trim();
    const e = email.trim().toLowerCase();
    if (!n) {
      setError("Please enter your name so the AI can personalize your baseline.");
      return;
    }
    if (n.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (!validEmail(e)) {
      setError("Please enter a valid email so we can save your progress.");
      return;
    }
    if (isResettingRef.current) return;
    setBusy(true);
    try {
      await clearStoredCredentials();
      const result = await registerIndividual({ name: n, email: e });
      if (!result.success) {
        setError(result.message || "Couldn't save your account. Please try again.");
        setBusy(false);
        return;
      }
      if (isResettingRef.current) {
        setBusy(false);
        return;
      }
      await setStoredEmail(e);
      await setLoginMode("individual");
      if (isResettingRef.current) {
        setBusy(false);
        return;
      }
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (err: any) {
      setError(err?.message || "Couldn't save your account. Please try again.");
      setBusy(false);
    }
  }, [name, email, onComplete]);

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
            {onBack ? (
              <Pressable
                onPress={async () => {
                  if (busy || isResettingRef.current) return;
                  isResettingRef.current = true;
                  if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  try {
                    await onBack();
                  } catch {
                    // swallow — parent owns the reset
                  }
                }}
                disabled={busy}
                style={[styles.backBtn, busy && styles.backBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Back to intro"
                accessibilityState={{ disabled: busy }}
                hitSlop={12}
              >
                <Text style={styles.backChevron}>‹</Text>
                <Text style={styles.backLabel}>Back</Text>
              </Pressable>
            ) : null}
            <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              We'll create your private AI baseline using only your name and email.
            </Text>

            <View style={styles.card}>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex Rivera"
                placeholderTextColor={Colors.whiteAlpha30}
                autoCapitalize="words"
                autoCorrect={false}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                accessibilityLabel="Your name"
                returnKeyType="next"
                textContentType="name"
              />

              <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={Colors.whiteAlpha30}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                accessibilityLabel="Email"
                returnKeyType="done"
                textContentType="emailAddress"
              />

              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={onIndividual}
                disabled={busy}
                style={({ pressed }) => [
                  styles.ctaWrap,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue"
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
                    <Text style={styles.ctaText}>Continue</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            <Text style={styles.footnote}>
              Your name and email are stored privately on this device, encrypted in the
              iOS Keychain. We never sell or share your data.
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
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 10,
    marginBottom: 8,
  },
  backBtnDisabled: {
    opacity: 0.4,
  },
  backChevron: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 26,
    color: Colors.white,
    marginRight: 4,
    marginTop: -3,
  },
  backLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
    opacity: 0.85,
  },
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
    marginBottom: 18,
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
