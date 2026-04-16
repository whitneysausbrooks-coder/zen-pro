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
  color,
}: {
  score: number;
  size: number;
  label: string;
  color: string;
}) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: score / 100,
      duration: 1200,
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
          borderWidth: 3,
          borderColor: "rgba(255,255,255,0.06)",
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
            borderWidth: 3,
            borderColor: color,
            opacity: animValue,
          }}
        />
        <Text
          style={{
            fontFamily: "PlayfairDisplay_700Bold",
            fontSize: size * 0.3,
            color: Colors.white,
          }}
        >
          {Math.round(score)}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
          color: Colors.whiteAlpha60,
          marginTop: 6,
          letterSpacing: 0.5,
          textTransform: "uppercase",
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
        <MaterialCommunityIcons
          name={icon as any}
          size={16}
          color={color}
        />
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

  useEffect(() => {
  }, []);

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
      ? { label: "High", color: "#EF4444", icon: "alert-circle" }
      : demoScore.burnout_risk > 40
      ? { label: "Moderate", color: Colors.balanceAmber, icon: "alert-triangle" }
      : { label: "Low", color: Colors.empathyGreen, icon: "shield-checkmark" };

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
        Alert.alert("Reset Complete", "+10 Neural Energy earned. Your nervous system thanks you.");
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
          colors={[Colors.celestialPurple, Colors.forestDeep, Colors.black]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.breathContainer}>
          <Pressable
            onPress={() => {
              if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
              setBreathingActive(false);
            }}
            style={styles.breathClose}
          >
            <Ionicons name="close" size={24} color={Colors.whiteAlpha60} />
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
          <Text style={styles.breathReward}>+10 NE on completion</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.black]}
        locations={[0, 0.3, 0.7]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>WORKFORCE RESILIENCE</Text>
        <Text style={styles.title}>Your Resilience</Text>

        <GlassCard style={styles.mainScoreCard} borderColor="rgba(167,139,250,0.2)">
          <View style={styles.scoreRingRow}>
            <ScoreRing
              score={demoScore.wri}
              size={120}
              label="WRI Score"
              color={Colors.neuralPurple}
            />
          </View>
          <View style={styles.burnoutRow}>
            <Ionicons
              name={burnoutLevel.icon as any}
              size={18}
              color={burnoutLevel.color}
            />
            <Text style={[styles.burnoutText, { color: burnoutLevel.color }]}>
              Burnout Risk: {burnoutLevel.label} ({Math.round(demoScore.burnout_risk)}%)
            </Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.metricsCard} borderColor={Colors.glassBorderLight}>
          <Text style={styles.cardEyebrow}>COMPONENT SCORES</Text>
          <MetricBar
            label="Emotional Resilience"
            value={demoScore.eri}
            color={Colors.compassionPink}
            icon="heart-pulse"
          />
          <MetricBar
            label="Cognitive Performance"
            value={demoScore.cps}
            color={Colors.mindfulBlue}
            icon="head-cog"
          />
          <MetricBar
            label="Nervous System Balance"
            value={demoScore.nsb}
            color={Colors.empathyGreen}
            icon="leaf"
          />
          <MetricBar
            label="Team Cohesion"
            value={demoScore.cohesion}
            color={Colors.balanceAmber}
            icon="account-group"
          />
        </GlassCard>

        <Pressable
          onPress={startBreathing}
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Start reset protocol breathing exercise"
        >
          <GlassCard style={styles.resetCard} borderColor="rgba(74,222,128,0.2)">
            <LinearGradient
              colors={["rgba(74,222,128,0.08)", "rgba(96,165,250,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.resetRow}>
              <View style={styles.resetIconCircle}>
                <MaterialCommunityIcons name="meditation" size={28} color={Colors.empathyGreen} />
              </View>
              <View style={styles.resetText}>
                <Text style={styles.resetTitle}>Reset Protocol</Text>
                <Text style={styles.resetDesc}>
                  2-min guided breathing · +10 Neural Energy
                </Text>
              </View>
              <Feather name="play-circle" size={28} color={Colors.empathyGreen} />
            </View>
          </GlassCard>
        </Pressable>

        <GlassCard style={styles.insightsCard} borderColor={Colors.glassBorderLight}>
          <Text style={styles.cardEyebrow}>INSIGHTS</Text>
          {demoScore.nsb < 50 && (
            <View style={styles.insightRow}>
              <Ionicons name="fitness" size={16} color={Colors.balanceAmber} />
              <Text style={styles.insightText}>
                Your nervous system balance is below optimal. Try the Reset Protocol or a 10-minute walk.
              </Text>
            </View>
          )}
          {demoScore.cps > 70 && (
            <View style={styles.insightRow}>
              <Ionicons name="sparkles" size={16} color={Colors.mindfulBlue} />
              <Text style={styles.insightText}>
                Cognitive performance is strong today. Great time for deep focus work.
              </Text>
            </View>
          )}
          {demoScore.eri > 60 && (
            <View style={styles.insightRow}>
              <Ionicons name="heart" size={16} color={Colors.compassionPink} />
              <Text style={styles.insightText}>
                Emotional resilience is healthy. Your capacity for empathy is elevated.
              </Text>
            </View>
          )}
          {demoScore.burnout_risk > 50 && (
            <View style={styles.insightRow}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.insightText}>
                Elevated burnout risk detected. Prioritize rest and recovery today.
              </Text>
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.scienceCard} borderColor={Colors.glassBorderLight}>
          <Text style={styles.cardEyebrow}>THE SCIENCE</Text>
          <Text style={styles.scienceText}>
            Your Workforce Resilience Index (WRI) is calculated from three validated biomarkers:
            heart rate variability (nervous system), sleep architecture (cognitive), and
            self-reported mood/engagement (emotional). Scores are deterministic, bounded 0–100,
            and never shared with employers as individual data — only anonymized team averages.
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.neuralPurple,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: Colors.white,
    marginBottom: 20,
  },
  mainScoreCard: { padding: 24, marginBottom: 16, alignItems: "center" },
  scoreRingRow: { marginBottom: 16 },
  burnoutRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  burnoutText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  metricsCard: { padding: 20, marginBottom: 16 },
  cardEyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: Colors.goldDim,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  metricRow: { marginBottom: 16 },
  metricLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  metricLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.whiteAlpha60, flex: 1 },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 14 },
  metricTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  metricFill: { height: "100%", borderRadius: 3 },
  resetCard: { padding: 20, marginBottom: 16 },
  resetRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  resetIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(74,222,128,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  resetText: { flex: 1 },
  resetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.white,
    marginBottom: 2,
  },
  resetDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha60,
  },
  insightsCard: { padding: 20, marginBottom: 16 },
  insightRow: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" },
  insightText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha60,
    flex: 1,
    lineHeight: 19,
  },
  scienceCard: { padding: 20, marginBottom: 16 },
  scienceText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    lineHeight: 20,
  },
  breathContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  breathClose: { position: "absolute", top: 20, right: 20, padding: 8 },
  breathTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
    marginBottom: 4,
  },
  breathSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    marginBottom: 40,
  },
  breathCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(167,139,250,0.12)",
    borderWidth: 2,
    borderColor: Colors.neuralPurple,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  breathPhaseText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  breathTimerText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 48,
    color: Colors.white,
    marginBottom: 8,
  },
  breathReward: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.empathyGreen,
  },
});
