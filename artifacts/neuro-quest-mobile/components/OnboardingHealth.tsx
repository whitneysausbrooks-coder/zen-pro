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
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import {
  isHealthKitAvailable,
  requestHealthPermissions,
  readLatestMetrics,
  syncToServer,
  syncManualMetrics,
  setHealthChoice,
  getStoredEmail,
  getStoredInviteCode,
  getLoginMode,
  openAppSettings,
  type SyncResult,
} from "@/lib/health";

const { width, height } = Dimensions.get("window");
const nd = Platform.OS !== "web";

type Mode = "choose" | "manual" | "success";

interface Props {
  onComplete: () => void;
}

export function OnboardingHealth({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hrv, setHrv] = useState("");
  const [sleep, setSleep] = useState("");
  const [steps, setSteps] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [classification, setClassification] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const showSuccess = useCallback((res: SyncResult) => {
    setScore(res.neuro_resilience_score ?? null);
    setClassification(res.classification ?? null);
    setSuccessMsg(res.message ?? null);
    setMode("success");
    if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const onAppleHealth = useCallback(async () => {
    setError(null);
    if (!isHealthKitAvailable) {
      setError(
        "Apple Health is iPhone-only. Tap 'Add Manually' to enter your data, or open NeuroQuest on your iPhone.",
      );
      return;
    }
    setBusy(true);
    try {
      const granted = await requestHealthPermissions();
      if (!granted) {
        setError(
          "Apple Health didn't respond. You can grant access in Settings, or add manually below.",
        );
        setBusy(false);
        return;
      }
      const metrics = await readLatestMetrics();
      const email = (await getStoredEmail()) || "";
      const code = await getStoredInviteCode();
      const mode = await getLoginMode();
      // Only sync to server when user signed in as enterprise pilot member.
      // Individual users keep their data on-device — never assume an old
      // enterprise identity left behind from a prior account on this device.
      if (mode === "enterprise" && email && code) {
        const result = await syncToServer(email, code, metrics);
        if (!result.success) {
          setError(result.message || "Sync failed. You can also add manually.");
          setBusy(false);
          return;
        }
        await setHealthChoice("apple_health");
        showSuccess(result);
      } else {
        await setHealthChoice("apple_health");
        showSuccess({
          success: true,
          message:
            mode === "enterprise"
              ? "Apple Health connected. Sign in is needed to sync to your team baseline."
              : "Apple Health connected. Your data stays on this device.",
        });
      }
    } catch (e: any) {
      setError(e?.message || "Couldn't connect to Apple Health.");
    } finally {
      setBusy(false);
    }
  }, [showSuccess]);

  const onSubmitManual = useCallback(async () => {
    setError(null);
    const hrvNum = hrv.trim() ? Number(hrv.trim()) : null;
    const sleepNum = sleep.trim() ? Number(sleep.trim()) : null;
    const stepsNum = steps.trim() ? Number(steps.trim()) : null;

    if (
      (hrvNum != null && (!Number.isFinite(hrvNum) || hrvNum < 0 || hrvNum > 300)) ||
      (sleepNum != null && (!Number.isFinite(sleepNum) || sleepNum < 0 || sleepNum > 24)) ||
      (stepsNum != null && (!Number.isFinite(stepsNum) || stepsNum < 0 || stepsNum > 200000))
    ) {
      setError("Please check your numbers (HRV 0-300 ms, sleep 0-24 h, steps 0-200,000).");
      return;
    }
    if (hrvNum == null && sleepNum == null && stepsNum == null) {
      setError("Enter at least one of HRV, sleep, or steps.");
      return;
    }
    setBusy(true);
    try {
      const email = (await getStoredEmail()) || "";
      const code = await getStoredInviteCode();
      const result = await syncManualMetrics(email, code, {
        hrv: hrvNum,
        sleep_hours: sleepNum,
        steps: stepsNum != null ? Math.round(stepsNum) : null,
      });
      if (!result.success) {
        setError(result.message || "Couldn't save. Please try again.");
        setBusy(false);
        return;
      }
      await setHealthChoice("manual");
      showSuccess(result);
    } catch (e: any) {
      setError(e?.message || "Network error.");
    } finally {
      setBusy(false);
    }
  }, [hrv, sleep, steps, showSuccess]);

  const onSkip = useCallback(async () => {
    await setHealthChoice("skipped");
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  }, [onComplete]);

  const onFinish = useCallback(() => {
    if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  }, [onComplete]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1A2A1A" as string, Colors.forestDeep, Colors.black]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            backgroundColor: Colors.empathyGreen,
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
            <Text style={styles.eyebrow}>STEP 2 OF 2</Text>
            <Text style={styles.title}>
              {mode === "success" ? "You're All Set" : "Your Health Data"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "choose" &&
                "NeuroQuest learns your personal baseline from your HRV, sleep, and steps. Connect Apple Health for automatic syncing, or add a quick snapshot now."}
              {mode === "manual" &&
                "Enter what you know — even one number is enough to start your AI baseline."}
              {mode === "success" &&
                "Your AI baseline is being personalized to you. The more you sync, the smarter it gets."}
            </Text>

            {mode === "choose" && (
              <View style={styles.choices}>
                <Pressable
                  onPress={onAppleHealth}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.choiceCard,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Connect Apple Health"
                >
                  <View
                    style={[styles.choiceIcon, { borderColor: Colors.mindfulBlue }]}
                  >
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={32}
                      color={Colors.mindfulBlue}
                    />
                  </View>
                  <Text style={styles.choiceTitle}>Connect Apple Health</Text>
                  <Text style={styles.choiceBody}>
                    Read HRV, sleep, and step data automatically — no typing.
                    {!isHealthKitAvailable ? "\n(iPhone only)" : ""}
                  </Text>
                  {busy ? (
                    <ActivityIndicator color={Colors.mindfulBlue} style={{ marginTop: 8 }} />
                  ) : (
                    <View style={styles.choiceCta}>
                      <Text style={styles.choiceCtaText}>
                        {isHealthKitAvailable ? "Connect" : "iPhone only"}
                      </Text>
                      <Feather name="arrow-right" size={16} color={Colors.mindfulBlue} />
                    </View>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setError(null);
                    setMode("manual");
                  }}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.choiceCard,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Add manually"
                >
                  <View style={[styles.choiceIcon, { borderColor: Colors.empathyGreen }]}>
                    <Feather name="edit-3" size={28} color={Colors.empathyGreen} />
                  </View>
                  <Text style={styles.choiceTitle}>Add Manually</Text>
                  <Text style={styles.choiceBody}>
                    Type in your HRV, sleep, and steps. Works on every device.
                  </Text>
                  <View style={styles.choiceCta}>
                    <Text
                      style={[styles.choiceCtaText, { color: Colors.empathyGreen }]}
                    >
                      Enter data
                    </Text>
                    <Feather name="arrow-right" size={16} color={Colors.empathyGreen} />
                  </View>
                </Pressable>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable onPress={onSkip} disabled={busy} style={styles.skipBtn}>
                  <Text style={styles.skip}>Skip for now</Text>
                </Pressable>
                {!isHealthKitAvailable ? null : (
                  <Pressable
                    onPress={() => openAppSettings()}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.settingsLink}>
                      Trouble with Apple Health? Open Settings →
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {mode === "manual" && (
              <View style={styles.formCard}>
                <Text style={styles.label}>HRV (ms)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 45"
                  placeholderTextColor={Colors.whiteAlpha30}
                  keyboardType="decimal-pad"
                  value={hrv}
                  onChangeText={(t) => {
                    setHrv(t);
                    setError(null);
                  }}
                  accessibilityLabel="Heart rate variability in milliseconds"
                />

                <Text style={[styles.label, { marginTop: 14 }]}>Sleep (hours)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 7.5"
                  placeholderTextColor={Colors.whiteAlpha30}
                  keyboardType="decimal-pad"
                  value={sleep}
                  onChangeText={(t) => {
                    setSleep(t);
                    setError(null);
                  }}
                  accessibilityLabel="Sleep duration in hours"
                />

                <Text style={[styles.label, { marginTop: 14 }]}>Steps today</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 8200"
                  placeholderTextColor={Colors.whiteAlpha30}
                  keyboardType="number-pad"
                  value={steps}
                  onChangeText={(t) => {
                    setSteps(t);
                    setError(null);
                  }}
                  accessibilityLabel="Steps today"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  onPress={onSubmitManual}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.ctaWrap,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save manual entry"
                >
                  <LinearGradient
                    colors={[Colors.empathyGreen, Colors.gold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cta}
                  >
                    {busy ? (
                      <ActivityIndicator color={Colors.forestDeep} />
                    ) : (
                      <Text style={styles.ctaText}>Save & Continue</Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setError(null);
                    setMode("choose");
                  }}
                  style={styles.skipBtn}
                >
                  <Text style={styles.skip}>Back to choices</Text>
                </Pressable>
              </View>
            )}

            {mode === "success" && (
              <View style={styles.successCard}>
                {score != null ? (
                  <>
                    <Text style={styles.scoreLabel}>YOUR NEURO-RESILIENCE SCORE</Text>
                    <Text style={styles.scoreValue}>{score}</Text>
                    {classification ? (
                      <Text style={styles.scoreClass}>{classification.toUpperCase()}</Text>
                    ) : null}
                    <View style={styles.aiBadge}>
                      <Feather name="cpu" size={14} color={Colors.gold} />
                      <Text style={styles.aiBadgeText}>
                        AI baseline learning started
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.choiceIcon, { borderColor: Colors.empathyGreen, alignSelf: "center" }]}>
                      <Feather name="check" size={32} color={Colors.empathyGreen} />
                    </View>
                    {successMsg ? (
                      <Text style={styles.successMsg}>{successMsg}</Text>
                    ) : null}
                  </>
                )}

                <Pressable
                  onPress={onFinish}
                  style={({ pressed }) => [
                    styles.ctaWrap,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Begin your journey"
                >
                  <LinearGradient
                    colors={[Colors.gold, Colors.empathyGreen]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cta}
                  >
                    <Text style={styles.ctaText}>Begin Your Journey</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}
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
    bottom: -height * 0.15,
    left: -width * 0.3,
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.45,
  },
  scroll: { paddingHorizontal: 28, gap: 18 },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.empathyGreen,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    color: Colors.white,
    textAlign: "center",
    lineHeight: 44,
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
  choices: { gap: 14 },
  choiceCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  choiceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
    marginTop: 8,
  },
  choiceBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha60,
    lineHeight: 19,
  },
  choiceCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  choiceCtaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.mindfulBlue,
    letterSpacing: 0.3,
  },
  formCard: {
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
  skipBtn: { paddingVertical: 12, alignItems: "center" },
  skip: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    letterSpacing: 0.3,
  },
  settingsLink: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    textAlign: "center",
    marginTop: -4,
  },
  successCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,205,99,0.25)",
    alignItems: "center",
    gap: 10,
  },
  scoreLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.whiteAlpha60,
  },
  scoreValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 72,
    color: Colors.gold,
    lineHeight: 80,
  },
  scoreClass: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.whiteAlpha60,
    letterSpacing: 1.5,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,205,99,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    marginTop: 8,
  },
  aiBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  successMsg: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
});
