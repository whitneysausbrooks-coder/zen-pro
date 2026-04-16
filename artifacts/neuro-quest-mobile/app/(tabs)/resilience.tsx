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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";

interface ScoreData {
  eri: number;
  cps: number;
  nsb: number;
  cohesion: number;
  wri: number;
  burnout_risk: number;
  created_at: string;
}

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

function MetricBar({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: Math.min(value, 100),
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabelRow}>
        <MaterialCommunityIcons name={icon as any} size={15} color={color} />
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{Math.round(value)}</Text>
      </View>
      <View style={styles.metricTrack}>
        <Animated.View
          style={[
            styles.metricFill,
            {
              backgroundColor: color,
              width: animWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
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
  const [scores, setScores] = useState<ScoreData | null>(null);
  const [history, setHistory] = useState<ScoreData[]>([]);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [breathTimer, setBreathTimer] = useState(0);
  const breathScale = useRef(new Animated.Value(1)).current;
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScores = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const base = Platform.OS === "web" ? "" : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const apiKey = process.env.EXPO_PUBLIC_ENTERPRISE_KEY || "";
      const res = await fetch(`${base}/api/enterprise/scores/${userId}`, {
        headers: { "x-enterprise-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scores?.length > 0) {
          setHistory(data.scores);
          setScores(data.scores[0]);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {}, []);

  const demoScore: ScoreData = scores || {
    eri: 72,
    cps: 76,
    nsb: 58,
    cohesion: 65,
    wri: 70.2,
    burnout_risk: 29.8,
    created_at: new Date().toISOString(),
  };

  const burnoutLevel =
    demoScore.burnout_risk > 70
      ? { label: "High Risk", color: "#EF4444", icon: "alert-circle" as const }
      : demoScore.burnout_risk > 40
      ? { label: "Moderate", color: "#FBBF24", icon: "alert-triangle" as const }
      : { label: "Low Risk", color: "#4ADE80", icon: "shield-checkmark" as const };

  const energyRecovery = Math.round(100 - demoScore.burnout_risk);

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
        Alert.alert("Session Complete", "Energy Recovery Score improved. Your nervous system thanks you.");
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
          <Text style={styles.breathReward}>Improving your Energy Recovery Score</Text>
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
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>WORKFORCE RESILIENCE</Text>
          <Text style={styles.title}>Your Resilience</Text>
        </View>

        <GlassCard style={styles.mainScoreCard} borderColor="rgba(255,255,255,0.06)">
          <View style={styles.scoreRow}>
            <ScoreRing
              score={demoScore.wri}
              size={130}
              label="Resilience Index"
              sublabel="out of 100"
              color="#7C8CF8"
            />
          </View>
          <View style={{ height: 16 }} />
          <View style={styles.pillRow}>
            <StatusPill label={burnoutLevel.label} color={burnoutLevel.color} />
            <StatusPill label={`Recovery: ${energyRecovery}%`} color="#7C8CF8" />
          </View>
        </GlassCard>

        <View style={{ height: 12 }} />

        <GlassCard style={styles.metricsCard} borderColor="rgba(255,255,255,0.05)">
          <Text style={styles.sectionLabel}>Component Scores</Text>
          <View style={{ height: 4 }} />
          <MetricBar label="Emotional Resilience" value={demoScore.eri} color="#F472B6" icon="heart-pulse" />
          <MetricBar label="Cognitive Performance" value={demoScore.cps} color="#60A5FA" icon="head-cog" />
          <MetricBar label="Nervous System Balance" value={demoScore.nsb} color="#4ADE80" icon="leaf" />
          <MetricBar label="Team Cohesion" value={demoScore.cohesion} color="#FBBF24" icon="account-group" />
        </GlassCard>

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

        <GlassCard style={styles.insightsCard} borderColor="rgba(255,255,255,0.05)">
          <Text style={styles.sectionLabel}>Insights</Text>
          <View style={{ height: 4 }} />
          {demoScore.nsb < 50 && (
            <View style={styles.insightRow}>
              <View style={[styles.insightDot, { backgroundColor: "#FBBF24" }]} />
              <Text style={styles.insightText}>
                Nervous system balance is below optimal. Consider the Reset Protocol or a brief walk.
              </Text>
            </View>
          )}
          {demoScore.cps > 70 && (
            <View style={styles.insightRow}>
              <View style={[styles.insightDot, { backgroundColor: "#60A5FA" }]} />
              <Text style={styles.insightText}>
                Cognitive performance is strong. Ideal window for deep focus work.
              </Text>
            </View>
          )}
          {demoScore.eri > 60 && (
            <View style={styles.insightRow}>
              <View style={[styles.insightDot, { backgroundColor: "#F472B6" }]} />
              <Text style={styles.insightText}>
                Emotional resilience is healthy. Capacity for empathy is elevated.
              </Text>
            </View>
          )}
          {demoScore.burnout_risk > 50 && (
            <View style={styles.insightRow}>
              <View style={[styles.insightDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.insightText}>
                Elevated burnout risk detected. Prioritize rest and recovery today.
              </Text>
            </View>
          )}
          {demoScore.nsb >= 50 && demoScore.cps <= 70 && demoScore.eri <= 60 && demoScore.burnout_risk <= 50 && (
            <View style={styles.insightRow}>
              <View style={[styles.insightDot, { backgroundColor: "#4ADE80" }]} />
              <Text style={styles.insightText}>
                All metrics within healthy range. Keep up the good work.
              </Text>
            </View>
          )}
        </GlassCard>

        <View style={{ height: 12 }} />

        <GlassCard style={styles.privacyCard} borderColor="rgba(255,255,255,0.04)">
          <View style={styles.privacyHeader}>
            <Ionicons name="lock-closed" size={14} color={Colors.whiteAlpha30} />
            <Text style={styles.privacyTitle}>Privacy</Text>
          </View>
          <Text style={styles.privacyText}>
            Your individual scores are never shared with your employer. Only anonymized team
            averages are visible to managers. Data is encrypted at rest and in transit.
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
  mainScoreCard: { padding: 28, alignItems: "center" },
  scoreRow: { marginBottom: 0 },
  pillRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  metricsCard: { padding: 22 },
  metricRow: { marginBottom: 18 },
  metricLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  metricLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.55)", flex: 1 },
  metricValue: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  metricTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 3,
    overflow: "hidden",
  },
  metricFill: { height: "100%", borderRadius: 3 },
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
  insightRow: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  insightText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.50)",
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
