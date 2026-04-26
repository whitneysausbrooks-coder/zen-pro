import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";
import { fetchBaseline, type BaselineResponse } from "@/lib/userAuth";

/**
 * Dashboard card that shows the user's personalized AI baseline:
 *   - Neuro-Resilience Score (Triple-Weight: HRV 50% / Sleep 35% / Strain 15%)
 *   - 7-day exponential moving average for trend stability
 *   - Trajectory tag (rising / falling / steady)
 *   - Plain-language suggestion (recovery / growth / burnout_alert / baseline_building)
 *
 * Refetches whenever the dashboard regains focus so freshly synced biometrics
 * show up without a cold restart. Silent if the user hasn't synced yet.
 */
export function AiBaselineCard() {
  const [data, setData] = useState<BaselineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchBaseline();
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  // No identity yet (e.g. enterprise login on this device) → render nothing.
  if (!loading && !data) return null;

  const sessionCount = data?.session_count ?? 0;
  const score = data?.latest?.neuro_resilience_score ?? null;
  const ema = data?.ema_7day ?? null;
  const trend = data?.trend ?? "insufficient_data";
  const suggestion = data?.suggestion;

  const accent =
    suggestion?.type === "burnout_alert"
      ? "#FCA5A5"
      : suggestion?.type === "recovery"
      ? Colors.balanceAmber
      : suggestion?.type === "growth"
      ? Colors.empathyGreen ?? "#86EFAC"
      : Colors.neuralPurple;

  const trendIcon =
    trend === "rising"
      ? ("trending-up" as const)
      : trend === "falling"
      ? ("trending-down" as const)
      : ("remove" as const);
  const trendLabel =
    trend === "rising"
      ? "Trending up"
      : trend === "falling"
      ? "Trending down"
      : trend === "steady"
      ? "Holding steady"
      : "Building baseline";

  return (
    <GlassCard
      style={styles.card}
      borderColor="rgba(167,139,250,0.22)"
    >
      <LinearGradient
        colors={["rgba(167,139,250,0.12)", "rgba(212,175,55,0.06)", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>YOUR AI BASELINE</Text>
          <Text style={styles.title}>
            {sessionCount === 0
              ? "Learning Your Baseline"
              : "Neuro-Resilience Score"}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={Colors.neuralPurple} />
        ) : (
          <View style={[styles.trendChip, { borderColor: accent + "55" }]}>
            <Ionicons name={trendIcon} size={12} color={accent} />
            <Text style={[styles.trendText, { color: accent }]}>{trendLabel}</Text>
          </View>
        )}
      </View>

      {sessionCount === 0 ? (
        <Text style={styles.empty}>
          Add HRV, sleep, and steps from the Wearable tab to start your AI
          baseline. The more you sync, the more personalized it gets.
        </Text>
      ) : (
        <View style={styles.scoreRow}>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue} accessibilityLabel={`Score ${score ?? "—"}`}>
              {score != null ? score.toFixed(0) : "—"}
            </Text>
            <Text style={styles.scoreSub}>Today</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue} accessibilityLabel={`7-day average ${ema ?? "—"}`}>
              {ema != null ? ema.toFixed(0) : "—"}
            </Text>
            <Text style={styles.scoreSub}>7-day avg</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>{sessionCount}</Text>
            <Text style={styles.scoreSub}>Sessions</Text>
          </View>
        </View>
      )}

      {suggestion ? (
        <View style={[styles.suggestionRow, { borderColor: accent + "33" }]}>
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
            size={16}
            color={accent}
          />
          <Text style={styles.suggestionText}>{suggestion.message}</Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleBlock: { flex: 1, paddingRight: 12 },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 3,
    color: Colors.neuralPurple,
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 19,
    color: Colors.white,
  },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  trendText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  empty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha60,
    lineHeight: 20,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  scoreBlock: { alignItems: "center", flex: 1 },
  scoreDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  scoreValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
  },
  scoreSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.whiteAlpha60,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  suggestionText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.white,
    lineHeight: 19,
  },
});
