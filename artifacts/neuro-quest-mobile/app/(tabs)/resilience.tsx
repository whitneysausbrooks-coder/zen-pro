import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";
import { fetchBaseline, getStoredUserId, type BaselineResponse } from "@/lib/userAuth";
import { readLatestMetrics, type WearableMetrics } from "@/lib/health";

const nd = Platform.OS !== "web";

function ScoreRing({
  score,
  size,
  label,
  sublabel,
  color,
}: {
  score: number;
  size: number;
  label: string;
  sublabel?: string;
  color: string;
}) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: score / 100,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.04)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2.5,
            borderColor: color,
            opacity: animValue,
          }}
        />
        <Text
          style={{
            fontFamily: "PlayfairDisplay_700Bold",
            fontSize: size * 0.28,
            color: Colors.white,
          }}
        >
          {Math.round(score)}
        </Text>
        {sublabel && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              color: Colors.whiteAlpha30,
              marginTop: 2,
            }}
          >
            {sublabel}
          </Text>
        )}
      </View>
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 12,
          color: Colors.whiteAlpha50,
          marginTop: 8,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ComponentRow({
  label,
  value,
  weight,
  color,
  icon,
}: {
  label: string;
  value: string;
  weight: string;
  color: string;
  icon: string;
}) {
  return (
    <View style={styles.componentRow}>
      <View style={[styles.componentIcon, { backgroundColor: color + "14" }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      </View>
      <View style={styles.componentText}>
        <Text style={styles.componentLabel}>{label}</Text>
        <Text style={styles.componentWeight}>{weight} of your score</Text>
      </View>
      <Text style={[styles.componentValue, { color }]}>{value}</Text>
    </View>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: color + "14",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: color + "30",
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

export default function ResilienceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [baseline, setBaseline] = useState<BaselineResponse | null>(null);
  const [metrics, setMetrics] = useState<WearableMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [breathTimer, setBreathTimer] = useState(0);
  const breathScale = useRef(new Animated.Value(1)).current;
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const b = await fetchBaseline();
    // fetchBaseline() returns null both when there's no identity AND when the
    // request fails. If we DO have a stored user id but got null back, treat it
    // as a load error (offline / server) rather than implying "no data yet".
    if (b === null) {
      const id = await getStoredUserId();
      setLoadError(!!id);
    } else {
      setLoadError(false);
    }
    setBaseline(b);
    if (nd) {
      try {
        setMetrics(await readLatestMetrics());
      } catch {
        // Local health read is best-effort; the score itself comes from the server.
      }
    }
    setLoading(false);
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  const score = baseline?.latest?.neuro_resilience_score ?? null;
  const ema = baseline?.ema_7day ?? null;
  const trend = baseline?.trend ?? "insufficient_data";
  const sessionCount = baseline?.session_count ?? 0;
  const suggestion = baseline?.suggestion;
  const hasScore = score != null && sessionCount > 0;

  const status =
    suggestion?.type === "growth"
      ? { label: "Thriving", color: "#4ADE80" }
      : suggestion?.type === "recovery"
      ? { label: "Recovery", color: "#FBBF24" }
      : suggestion?.type === "burnout_alert"
      ? { label: "Rest Needed", color: "#EF4444" }
      : { label: "Building Baseline", color: "#7C8CF8" };

  const trendIcon =
    trend === "rising"
      ? ("trending-up" as const)
      : trend === "falling"
      ? ("trending-down" as const)
      : ("trending-neutral" as const);
  const trendLabel =
    trend === "rising"
      ? "Trending up"
      : trend === "falling"
      ? "Trending down"
      : trend === "steady"
      ? "Holding steady"
      : "Building trend";

  const hrv = metrics?.hrv ?? null;
  const sleepHours =
    metrics?.sleep_duration_minutes != null ? metrics.sleep_duration_minutes / 60 : null;
  const steps = metrics?.steps ?? null;

  const startBreathing = useCallback(() => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBreathingActive(true);
    setBreathTimer(120);
    setBreathPhase("inhale");

    let elapsed = 0;
    const totalDuration = 120;
    const cycleLength = 12;

    breathIntervalRef.current = setInterval(() => {
      elapsed++;
      const remaining = totalDuration - elapsed;
      setBreathTimer(remaining);

      const cyclePos = elapsed % cycleLength;
      if (cyclePos < 4) {
        setBreathPhase("inhale");
        Animated.timing(breathScale, {
          toValue: 1.3,
          duration: 900,
          useNativeDriver: true,
        }).start();
      } else if (cyclePos < 7) {
        setBreathPhase("hold");
      } else {
        setBreathPhase("exhale");
        Animated.timing(breathScale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }).start();
      }

      if (remaining <= 0) {
        if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
        setBreathingActive(false);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Session Complete", "Nicely done. A calmer nervous system supports your recovery.");
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    };
  }, []);

  if (breathingActive) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={["#1a1a2e", "#16213e", "#0f0f23"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.breathContainer}>
          <Pressable
            onPress={() => {
              if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
              setBreathingActive(false);
            }}
            style={styles.breathClose}
            accessibilityRole="button"
            accessibilityLabel="Close breathing exercise"
          >
            <Ionicons name="close" size={22} color={Colors.whiteAlpha50} />
          </Pressable>
          <Text style={styles.breathTitle}>Reset Protocol</Text>
          <Text style={styles.breathSubtitle}>4-3-5 Box Breathing</Text>
          <Animated.View
            style={[
              styles.breathCircle,
              { transform: [{ scale: breathScale }] },
            ]}
          >
            <Text style={styles.breathPhaseText}>
              {breathPhase === "inhale" ? "Breathe In" : breathPhase === "hold" ? "Hold" : "Breathe Out"}
            </Text>
          </Animated.View>
          <Text style={styles.breathTimerText}>
            {Math.floor(breathTimer / 60)}:{String(breathTimer % 60).padStart(2, "0")}
          </Text>
          <Text style={styles.breathReward}>A moment of calm for your nervous system</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f0f23"]}
        locations={[0, 0.35, 0.7]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR RESILIENCE</Text>
          <Text style={styles.title}>Resilience</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#7C8CF8" />
          </View>
        ) : loadError ? (
          <GlassCard style={styles.emptyCard} borderColor="rgba(239,68,68,0.18)">
            <View style={[styles.emptyIcon, { backgroundColor: "rgba(239,68,68,0.10)" }]}>
              <MaterialCommunityIcons name="cloud-off-outline" size={28} color="#FCA5A5" />
            </View>
            <Text style={styles.emptyTitle}>Couldn't load your score</Text>
            <Text style={styles.emptyBody}>
              We couldn't reach your resilience data just now. Check your connection and try again.
            </Text>
            <Pressable
              onPress={retry}
              style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="Retry loading your resilience score"
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#0f0f23" />
              <Text style={styles.emptyCtaText}>Try Again</Text>
            </Pressable>
          </GlassCard>
        ) : !hasScore ? (
          <GlassCard style={styles.emptyCard} borderColor="rgba(124,140,248,0.18)">
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="heart-pulse" size={28} color="#7C8CF8" />
            </View>
            <Text style={styles.emptyTitle}>Building your baseline</Text>
            <Text style={styles.emptyBody}>
              Sync your HRV, sleep, and activity to calculate your personal Resilience Index.
              The more you sync, the smarter your AI baseline becomes.
            </Text>
            <Pressable
              onPress={() => router.push("/wearable")}
              style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="Sync your health data"
            >
              <MaterialCommunityIcons name="sync" size={16} color="#0f0f23" />
              <Text style={styles.emptyCtaText}>Sync Health Data</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <>
            <GlassCard style={styles.mainScoreCard} borderColor="rgba(255,255,255,0.06)">
              <View style={styles.scoreRow}>
                <ScoreRing
                  score={score!}
                  size={130}
                  label="Resilience Index"
                  sublabel="out of 100"
                  color="#7C8CF8"
                />
              </View>
              <View style={{ height: 16 }} />
              <View style={styles.pillRow}>
                <StatusPill label={status.label} color={status.color} />
                {ema != null && (
                  <StatusPill label={`7-day avg: ${ema.toFixed(0)}`} color="#7C8CF8" />
                )}
              </View>
              <View style={styles.trendRow}>
                <MaterialCommunityIcons name={trendIcon} size={14} color={Colors.whiteAlpha50} />
                <Text style={styles.trendText}>{trendLabel}</Text>
                <Text style={styles.trendDot}>·</Text>
                <Text style={styles.trendText}>
                  {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
                </Text>
              </View>
            </GlassCard>

            <View style={{ height: 12 }} />

            <GlassCard style={styles.metricsCard} borderColor="rgba(255,255,255,0.05)">
              <Text style={styles.sectionLabel}>What Drives Your Score</Text>
              <View style={{ height: 4 }} />
              <ComponentRow
                label="Heart Rate Variability"
                value={hrv != null ? `${Math.round(hrv)} ms` : "Not synced"}
                weight="50%"
                color="#F472B6"
                icon="heart-pulse"
              />
              <ComponentRow
                label="Sleep"
                value={sleepHours != null ? `${sleepHours.toFixed(1)} h` : "Not synced"}
                weight="35%"
                color="#60A5FA"
                icon="sleep"
              />
              <ComponentRow
                label="Activity"
                value={steps != null ? `${steps.toLocaleString()} steps` : "Not synced"}
                weight="15%"
                color="#4ADE80"
                icon="walk"
              />
              {(hrv == null && sleepHours == null && steps == null) && (
                <Text style={styles.componentHint}>
                  Sync from the Wearable tab to see the live readings behind your score.
                </Text>
              )}
            </GlassCard>

            <View style={{ height: 12 }} />

            {suggestion ? (
              <GlassCard style={styles.insightsCard} borderColor="rgba(255,255,255,0.05)">
                <Text style={styles.sectionLabel}>AI Insight</Text>
                <View style={{ height: 4 }} />
                <View style={styles.insightRow}>
                  <Ionicons
                    name={
                      suggestion.type === "burnout_alert"
                        ? "alert-circle"
                        : suggestion.type === "recovery"
                        ? "leaf"
                        : suggestion.type === "growth"
                        ? "flash"
                        : "sparkles"
                    }
                    size={18}
                    color={status.color}
                  />
                  <Text style={styles.insightText}>{suggestion.message}</Text>
                </View>
              </GlassCard>
            ) : null}
          </>
        )}

        <View style={{ height: 12 }} />

        <Pressable
          onPress={startBreathing}
          style={({ pressed }) => [pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Start reset protocol breathing exercise"
        >
          <GlassCard style={styles.resetCard} borderColor="rgba(74,222,128,0.12)">
            <View style={styles.resetRow}>
              <View style={styles.resetIconCircle}>
                <MaterialCommunityIcons name="meditation" size={26} color="#4ADE80" />
              </View>
              <View style={styles.resetText}>
                <Text style={styles.resetTitle}>Reset Protocol</Text>
                <Text style={styles.resetDesc}>2-min guided breathing session</Text>
              </View>
              <Feather name="play-circle" size={26} color="rgba(74,222,128,0.6)" />
            </View>
          </GlassCard>
        </Pressable>

        <View style={{ height: 12 }} />

        <GlassCard style={styles.privacyCard} borderColor="rgba(255,255,255,0.04)">
          <View style={styles.privacyHeader}>
            <Ionicons name="lock-closed" size={14} color={Colors.whiteAlpha30} />
            <Text style={styles.privacyTitle}>Privacy</Text>
          </View>
          <Text style={styles.privacyText}>
            Your scores and biometrics are tied to your private account on this device and are
            encrypted in transit and at rest. We never sell your health data.
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f23" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  header: { marginBottom: 24 },
  eyebrow: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#7C8CF8",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
    opacity: 0.8,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    color: "#F0F0F5",
    letterSpacing: -0.3,
  },
  loadingBox: { paddingVertical: 60, alignItems: "center" },
  emptyCard: { padding: 26, alignItems: "center" },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(124,140,248,0.10)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: "#F0F0F5",
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7C8CF8",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
  },
  emptyCtaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#0f0f23",
    letterSpacing: 0.3,
  },
  mainScoreCard: { padding: 28, alignItems: "center" },
  scoreRow: { marginBottom: 0 },
  pillRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  trendText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.whiteAlpha50,
  },
  trendDot: { color: Colors.whiteAlpha30, fontSize: 12 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  metricsCard: { padding: 22 },
  componentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  componentIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  componentText: { flex: 1 },
  componentLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 2,
  },
  componentWeight: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
  componentValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  componentHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    lineHeight: 18,
    marginTop: 2,
  },
  resetCard: { padding: 22 },
  resetRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  resetIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(74,222,128,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  resetText: { flex: 1 },
  resetTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#F0F0F5",
    marginBottom: 3,
  },
  resetDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.40)",
  },
  insightsCard: { padding: 22 },
  insightRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  insightText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    flex: 1,
    lineHeight: 20,
  },
  privacyCard: { padding: 20 },
  privacyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  privacyTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    letterSpacing: 0.5,
  },
  privacyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.28)",
    lineHeight: 18,
  },
  breathContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  breathClose: { position: "absolute", top: 20, right: 20, padding: 10 },
  breathTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: "#F0F0F5",
    marginBottom: 6,
  },
  breathSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
    marginBottom: 44,
  },
  breathCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(124,140,248,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(124,140,248,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 36,
  },
  breathPhaseText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#F0F0F5",
  },
  breathTimerText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 44,
    color: "#F0F0F5",
    marginBottom: 10,
  },
  breathReward: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(124,140,248,0.6)",
  },
});
