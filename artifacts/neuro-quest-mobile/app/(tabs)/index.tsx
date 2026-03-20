import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");

const CAUSES = [
  { id: "hunger", label: "End Hunger", icon: "🌾", color: "#8B6914" },
  { id: "climate", label: "Climate Action", icon: "🌿", color: "#2A6A3A" },
  { id: "water", label: "Clean Water", icon: "💧", color: "#1A5C8A" },
  { id: "education", label: "Education", icon: "📚", color: "#6A2A8A" },
];

interface WinEvent {
  id: string;
  cause: string;
  amount: string;
  time: string;
}

const RECENT_WINS: WinEvent[] = [
  { id: "1", cause: "End Hunger", amount: "$2.50", time: "2m ago" },
  { id: "2", cause: "Clean Water", amount: "$1.00", time: "8m ago" },
  { id: "3", cause: "Climate Action", amount: "$5.00", time: "15m ago" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [spinsLeft, setSpinsLeft] = useState(3);
  const [selectedCause, setSelectedCause] = useState("hunger");
  const [totalDonated, setTotalDonated] = useState("$247.50");
  const [streakDays, setStreakDays] = useState(7);
  const [jackpotPool, setJackpotPool] = useState("$1,284.00");
  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const nd = Platform.OS !== "web";
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      useNativeDriver: nd,
    }).start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, useNativeDriver: nd }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, useNativeDriver: nd }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

  const handleCauseSelect = useCallback((id: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelectedCause(id);
  }, []);

  const handlePlayPress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/play" as any);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.forestDeep, Colors.black, Colors.black]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good morning</Text>
              <Text style={styles.username}>Compassion Player</Text>
            </View>
            <View style={styles.streakBadge}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakNumber}>{streakDays}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
            </View>
          </View>

          {/* Jackpot Pool Banner */}
          <GlassCard style={styles.jackpotBanner} borderColor={Colors.goldAlpha30}>
            <LinearGradient
              colors={[Colors.goldAlpha08, Colors.goldAlpha15, Colors.goldAlpha08]}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[styles.jackpotGlow, { opacity: glowOpacity }]} />
            <Text style={styles.jackpotLabel}>COMPASSION JACKPOT POOL</Text>
            <Text style={styles.jackpotAmount}>{jackpotPool}</Text>
            <Text style={styles.jackpotSub}>Train your mind. Feed the world.</Text>
          </GlassCard>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <GlassCard style={styles.statCard}>
              <Ionicons name="heart" size={22} color={Colors.gold} />
              <Text style={styles.statValue}>{totalDonated}</Text>
              <Text style={styles.statLabel}>Donated</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <MaterialCommunityIcons name="cards-club" size={22} color={Colors.gold} />
              <Text style={styles.statValue}>{spinsLeft}</Text>
              <Text style={styles.statLabel}>Spins Left</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Ionicons name="trophy" size={22} color={Colors.gold} />
              <Text style={styles.statValue}>Lvl 4</Text>
              <Text style={styles.statLabel}>Zen Rank</Text>
            </GlassCard>
          </View>

          {/* Choose Your Cause */}
          <Text style={styles.sectionTitle}>Choose Your Cause</Text>
          <View style={styles.causesGrid}>
            {CAUSES.map((cause) => (
              <Pressable
                key={cause.id}
                onPress={() => handleCauseSelect(cause.id)}
                style={({ pressed }) => [
                  styles.causeCard,
                  selectedCause === cause.id && styles.causeCardSelected,
                  pressed && { opacity: 0.8 },
                ]}
              >
                {selectedCause === cause.id && (
                  <LinearGradient
                    colors={[Colors.goldAlpha15, Colors.goldAlpha08]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={styles.causeIcon}>{cause.icon}</Text>
                <Text style={styles.causeLabel}>{cause.label}</Text>
                {selectedCause === cause.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={Colors.gold}
                    style={styles.causeCheck}
                  />
                )}
              </Pressable>
            ))}
          </View>

          {/* Play Button */}
          <Pressable onPress={handlePlayPress} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
              style={styles.playButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="cards-club" size={24} color={Colors.forestDeep} />
              <Text style={styles.playButtonText}>Spin the Compassion Jackpot</Text>
            </LinearGradient>
          </Pressable>

          {/* Recent Wins */}
          <Text style={styles.sectionTitle}>Recent Donations</Text>
          <View style={styles.winsContainer}>
            {RECENT_WINS.map((win) => (
              <GlassCard key={win.id} style={styles.winRow}>
                <View style={styles.winDot} />
                <Text style={styles.winCause}>{win.cause}</Text>
                <View style={styles.winRight}>
                  <Text style={styles.winAmount}>{win.amount}</Text>
                  <Text style={styles.winTime}>{win.time}</Text>
                </View>
              </GlassCard>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    letterSpacing: 0.5,
  },
  username: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
    marginTop: 2,
  },
  streakBadge: {
    alignItems: "center",
    backgroundColor: Colors.goldAlpha15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  streakFire: {
    fontSize: 18,
  },
  streakNumber: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.gold,
  },
  streakLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha50,
  },
  jackpotBanner: {
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  jackpotGlow: {
    position: "absolute",
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.gold,
    opacity: 0.5,
    alignSelf: "center",
  },
  jackpotLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 3,
    marginBottom: 8,
  },
  jackpotAmount: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 48,
    color: Colors.white,
    marginBottom: 4,
  },
  jackpotSub: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: Colors.whiteAlpha50,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha50,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
    marginBottom: 12,
  },
  causesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  causeCard: {
    width: (width - 50) / 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.surfaceLight,
    padding: 16,
    overflow: "hidden",
    position: "relative",
  },
  causeCardSelected: {
    borderColor: Colors.gold,
  },
  causeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  causeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  causeCheck: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
    borderRadius: 100,
    marginBottom: 28,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  playButtonText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.forestDeep,
  },
  winsContainer: {
    gap: 8,
  },
  winRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  winDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  winCause: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.white,
  },
  winRight: {
    alignItems: "flex-end",
  },
  winAmount: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: Colors.gold,
  },
  winTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha50,
  },
});
