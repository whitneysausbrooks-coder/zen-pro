"use no memo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { LegalScreen } from "@/components/LegalScreen";
import Colors from "@/constants/colors";
import { healthProviderLabel } from "@/lib/health";

const { width } = Dimensions.get("window");
const nd = Platform.OS !== "web";

const NEURAL_ENERGY_KEY = "nq_neural_energy";
const DONATIONS_KEY = "nq_micro_donations";
const SPINS_KEY = "nq_spins_left";
const STREAK_KEY = "nq_streak_count";
const WINS_KEY = "nq_total_wins";
const GRATITUDE_LOG_KEY = "nq_gratitude_log";
const TOTAL_SPINS_USED_KEY = "nq_total_spins_used";

function safeInt(val: string | null, fallback: number): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
}
function safeFloat(val: string | null, fallback: number): number {
  if (!val) return fallback;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
}

interface LiveData {
  neuralEnergy: number;
  totalDonated: number;
  spinsLeft: number;
  streak: number;
  totalWins: number;
  gratitudeCount: number;
  totalSpinsUsed: number;
}

const ACHIEVEMENTS_DEF: Array<{ id: string; title: string; icon: string; condition: (d: LiveData) => boolean }> = [
  { id: "first_win", title: "First Win", icon: "award", condition: (d) => d.totalWins >= 1 },
  { id: "7_streak", title: "7 Day Streak", icon: "zap", condition: (d) => d.streak >= 7 },
  { id: "100_spins", title: "100 Spins", icon: "repeat", condition: (d) => d.totalSpinsUsed >= 100 },
  { id: "zen_master", title: "Zen Master", icon: "star", condition: (d) => d.gratitudeCount >= 30 },
  { id: "generous", title: "Generous Soul", icon: "heart", condition: (d) => d.totalDonated >= 5 },
  { id: "30_streak", title: "30 Day Streak", icon: "calendar", condition: (d) => d.streak >= 30 },
];

const SETTINGS = [
  { id: "haptics", label: "Haptic Feedback", icon: "smartphone", toggle: true, value: true },
  { id: "privacy", label: "Privacy Policy", icon: "shield", toggle: false },
  { id: "terms", label: "Terms of Use", icon: "file-text", toggle: false },
  { id: "support", label: "Contact Support", icon: "message-circle", toggle: false },
  { id: "switch_account", label: "Switch Account / Sign Out", icon: "log-out", toggle: false },
  { id: "reset", label: "Reset All Data", icon: "trash-2", toggle: false },
  { id: "delete_account", label: "Delete Account", icon: "user-x", toggle: false, destructive: true },
];

async function shareText(message: string, title: string) {
  if (Platform.OS === "web") {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
      } else {
        await Clipboard.setStringAsync(message);
      }
      Alert.alert("Copied!", "Your share text has been copied to the clipboard.");
    } catch {
      try {
        await Clipboard.setStringAsync(message);
        Alert.alert("Copied!", "Your share text has been copied to the clipboard.");
      } catch {}
    }
  } else {
    try {
      await Share.share({ message, title });
    } catch {}
  }
}

function computeZenRank(data: LiveData) {
  const points =
    data.totalWins * 10 +
    data.streak * 5 +
    Math.floor(data.totalDonated * 20) +
    data.gratitudeCount * 15 +
    data.neuralEnergy;
  if (points >= 5000) return { rank: 10, points, nextThreshold: 5000, label: "Enlightened" };
  if (points >= 3000) return { rank: 9, points, nextThreshold: 5000, label: "Transcendent" };
  if (points >= 2000) return { rank: 8, points, nextThreshold: 3000, label: "Luminary" };
  if (points >= 1500) return { rank: 7, points, nextThreshold: 2000, label: "Sage" };
  if (points >= 1000) return { rank: 6, points, nextThreshold: 1500, label: "Adept" };
  if (points >= 600) return { rank: 5, points, nextThreshold: 1000, label: "Seeker" };
  if (points >= 300) return { rank: 4, points, nextThreshold: 600, label: "Apprentice" };
  if (points >= 100) return { rank: 3, points, nextThreshold: 300, label: "Initiate" };
  if (points >= 30) return { rank: 2, points, nextThreshold: 100, label: "Curious" };
  return { rank: 1, points, nextThreshold: 30, label: "Newcomer" };
}

function computeEmpathyIndex(data: LiveData) {
  const compassion = Math.min(1, (data.totalDonated * 10 + data.totalWins * 2) / 100);
  const connection = Math.min(1, (data.streak * 3 + data.gratitudeCount * 2) / 80);
  const mindfulness = Math.min(1, (data.neuralEnergy + data.gratitudeCount * 5) / 200);
  const listening = Math.min(1, (data.totalSpinsUsed + data.streak) / 150);
  const emotionalSafety = Math.min(1, (data.gratitudeCount * 4 + data.streak * 2) / 100);
  const sharedPurpose = Math.min(1, (data.totalDonated * 15 + data.totalWins) / 80);
  return [
    { label: "Compassion", value: compassion, color: Colors.compassionPink },
    { label: "Connection", value: connection, color: Colors.empathyGreen },
    { label: "Mindfulness", value: mindfulness, color: Colors.mindfulBlue },
    { label: "Listening", value: listening, color: Colors.neuralPurple },
    { label: "Emotional Safety", value: emotionalSafety, color: Colors.balanceAmber },
    { label: "Shared Purpose", value: sharedPurpose, color: Colors.gold },
  ];
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<LiveData>({
    neuralEnergy: 0,
    totalDonated: 0,
    spinsLeft: 5,
    streak: 0,
    totalWins: 0,
    gratitudeCount: 0,
    totalSpinsUsed: 0,
  });
  const [settings, setSettings] = useState(
    SETTINGS.reduce((acc, s) => ({ ...acc, [s.id]: s.value ?? false }), {} as Record<string, boolean>)
  );
  const [legalTab, setLegalTab] = useState<"privacy" | "terms" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const starAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const devTapCount = useRef(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [energy, donated, spins, streak, wins, gratLog, spinsUsed] = await Promise.all([
        AsyncStorage.getItem(NEURAL_ENERGY_KEY),
        AsyncStorage.getItem(DONATIONS_KEY),
        AsyncStorage.getItem(SPINS_KEY),
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(WINS_KEY),
        AsyncStorage.getItem(GRATITUDE_LOG_KEY),
        AsyncStorage.getItem(TOTAL_SPINS_USED_KEY),
      ]);

      let gratitudeCount = 0;
      if (gratLog) {
        try {
          const parsed = JSON.parse(gratLog);
          gratitudeCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          gratitudeCount = 0;
        }
      }

      setData({
        neuralEnergy: safeInt(energy, 0),
        totalDonated: safeFloat(donated, 0),
        spinsLeft: safeInt(spins, 5),
        streak: safeInt(streak, 0),
        totalWins: safeInt(wins, 0),
        gratitudeCount,
        totalSpinsUsed: safeInt(spinsUsed, 0),
      });
    } catch {}
    if (isLoading) {
      setIsLoading(false);
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: nd }).start();
    }
  }, [isLoading]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDevTap = useCallback(async () => {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    if (devTapCount.current >= 5) {
      devTapCount.current = 0;
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const DEV_CREDIT = {
        [NEURAL_ENERGY_KEY]: "10000",
        [SPINS_KEY]: "500",
        [WINS_KEY]: "50",
        [DONATIONS_KEY]: "25.00",
        [STREAK_KEY]: "14",
        [TOTAL_SPINS_USED_KEY]: "200",
      };
      await AsyncStorage.multiSet(Object.entries(DEV_CREDIT));
      await loadData();
      Alert.alert("Dev Mode Activated", "10,000 Neural Energy\n500 Spins\n50 Wins\n$25.00 Donated\n14-Day Streak\n\nAll stats credited for testing.");
    } else {
      devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
    }
  }, [loadData]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: nd }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2500, useNativeDriver: nd }),
      ])
    );
    pulse.start();
    const stars = Animated.loop(
      Animated.sequence([
        Animated.timing(starAnim, { toValue: 1, duration: 3000, useNativeDriver: nd }),
        Animated.timing(starAnim, { toValue: 0, duration: 3000, useNativeDriver: nd }),
      ])
    );
    stars.start();
    return () => {
      pulse.stop();
      stars.stop();
      if (devTapTimer.current) clearTimeout(devTapTimer.current);
    };
  }, []);

  const toggleSetting = useCallback((id: string) => {
    if (nd) Haptics.selectionAsync();
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSettingPress = useCallback((id: string) => {
    if (nd) Haptics.selectionAsync();
    switch (id) {
      case "privacy":
        setLegalTab("privacy");
        break;
      case "terms":
        setLegalTab("terms");
        break;
      case "support":
        Linking.canOpenURL("mailto:admin@neuroquestllc.info").then((supported) => {
          if (supported) {
            Linking.openURL("mailto:admin@neuroquestllc.info?subject=NeuroQuest%20Support%20Request");
          } else {
            Alert.alert("Contact Support", "Email us at admin@neuroquestllc.info");
          }
        });
        break;
      case "switch_account":
        Alert.alert(
          "Switch Account / Sign Out",
          "This will sign you out of your current account on this device and clear your work email, invite code, and health-data choice. Your local progress (Neural Energy, streak, etc.) is kept. The next person can sign in fresh.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign Out",
              style: "destructive",
              onPress: async () => {
                try {
                  const { signOutAndReset } = await import("@/lib/health");
                  await signOutAndReset();
                  if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  // The root layout subscribes to the sign-out event and
                  // automatically swaps back to the sign-in onboarding step,
                  // so no explicit navigation is needed here.
                  Alert.alert(
                    "Signed Out",
                    "You're signed out. Sign in as another user, or continue as an individual.",
                  );
                } catch (e: any) {
                  if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert("Error", `Could not sign out: ${e?.message || "Unknown error"}`);
                }
              },
            },
          ]
        );
        break;
      case "delete_account":
        Alert.alert(
          "Delete Account",
          "This will permanently delete your NeuroQuest account from our servers, including all health data, resilience scores, activity history, and purchase records. Your enterprise pilot seat will be released. This action cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              style: "destructive",
              onPress: () => {
                Alert.alert(
                  "Are you absolutely sure?",
                  "Type-free final confirmation. Once deleted, your account cannot be recovered. To use NeuroQuest again, you would need a new invite code from your employer.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete Forever",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const { deleteAccount, signOutAndReset } = await import("@/lib/health");
                          const result = await deleteAccount();
                          // Use the same atomic teardown as Switch Account so
                          // the device returns to a fully clean onboarding
                          // state — no stale login mode or health choice.
                          await signOutAndReset();
                          await AsyncStorage.multiRemove([
                            NEURAL_ENERGY_KEY, DONATIONS_KEY, SPINS_KEY, STREAK_KEY,
                            WINS_KEY, GRATITUDE_LOG_KEY, TOTAL_SPINS_USED_KEY,
                            "nq_morning_bloom_date", "nq_gratitude_streak",
                          ]);
                          if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          // No explicit navigation needed — the root layout
                          // subscribes to the sign-out event triggered by
                          // signOutAndReset and automatically returns to the
                          // sign-in onboarding step.
                          if (result.serverDeleted) {
                            Alert.alert(
                              "Account Deleted",
                              result.message || "Your account and all associated data have been permanently deleted.",
                            );
                          } else if (result.error) {
                            Alert.alert(
                              "Deletion Issue",
                              `Local data was cleared, but the server reported: ${result.error}\n\nPlease email admin@neuroquestllc.info to confirm full deletion.`,
                            );
                          } else {
                            Alert.alert(
                              "Local Data Cleared",
                              result.message || "All local data has been cleared from this device.",
                            );
                          }
                        } catch (e: any) {
                          if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                          Alert.alert("Error", `Could not complete deletion: ${e?.message || "Unknown error"}\n\nPlease email admin@neuroquestllc.info.`);
                        }
                      },
                    },
                  ]
                );
              },
            },
          ]
        );
        break;
      case "reset":
        Alert.alert(
          "Reset All Data",
          "This will permanently delete all your progress, Neural Energy, streak data, gratitude entries, and donation records from this device. This action cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Reset Everything",
              style: "destructive",
              onPress: async () => {
                try {
                  await AsyncStorage.multiRemove([
                    NEURAL_ENERGY_KEY,
                    DONATIONS_KEY,
                    SPINS_KEY,
                    STREAK_KEY,
                    WINS_KEY,
                    GRATITUDE_LOG_KEY,
                    TOTAL_SPINS_USED_KEY,
                    "nq_morning_bloom_date",
                    "nq_gratitude_streak",
                  ]);
                  loadData();
                  if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert("Data Reset", "All your data has been cleared.");
                } catch {
                  Alert.alert("Error", "Failed to reset data. Please try again.");
                }
              },
            },
          ]
        );
        break;
    }
  }, [loadData]);

  const zen = computeZenRank(data);
  const empathyDims = computeEmpathyIndex(data);
  const empathyAvg = Math.round(empathyDims.reduce((sum, d) => sum + d.value, 0) / empathyDims.length * 100);
  const achievements = ACHIEVEMENTS_DEF.map((a) => ({ ...a, unlocked: a.condition(data) }));
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const zenProgress = zen.rank >= 10 ? 1 : (zen.points - (zen.rank > 1 ? [0, 0, 30, 100, 300, 600, 1000, 1500, 2000, 3000][zen.rank] : 0)) / (zen.nextThreshold - (zen.rank > 1 ? [0, 0, 30, 100, 300, 600, 1000, 1500, 2000, 3000][zen.rank] : 0));

  const hbhsScore = Math.min(100, (empathyAvg * 0.4 + zen.rank * 6 + Math.min(data.neuralEnergy / 10, 20)));

  const treesEquiv = Math.floor(data.totalDonated / 2);
  const mealsEquiv = Math.floor(data.totalDonated / 1.5);
  const studentsEquiv = (data.totalDonated / 50).toFixed(1);

  const handleShare = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg =
      `My NeuroQuest Profile 🧠✨\n\n` +
      `Zen Rank: ${zen.rank} (${zen.label}) • HBHS: ${hbhsScore.toFixed(1)}\n` +
      `Empathy Index: ${empathyAvg}%\n` +
      `$${data.totalDonated.toFixed(2)} donated to charity\n` +
      `${data.streak}-day streak • ${data.totalWins} wins\n\n` +
      `Train your mind. Change the world.\n` +
      `neuroquest.app`;
    await shareText(msg, "My NeuroQuest Profile");
  }, [zen, hbhsScore, empathyAvg, data]);

  const starOp = starAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.8] });
  const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.celestialBlue, Colors.black, Colors.black]}
        locations={[0, 0.15, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.starField, { opacity: starOp }]}>
        <View style={[styles.star, { top: 50, left: 25 }]} />
        <View style={[styles.starSm, { top: 80, right: 40 }]} />
        <View style={[styles.star, { top: 130, left: width * 0.5 }]} />
        <View style={[styles.starSm, { top: 30, left: width * 0.7 }]} />
        <View style={[styles.starTn, { top: 100, left: 100 }]} />
      </Animated.View>
      <View style={styles.nebulaGlow} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: isLoading ? 0 : fadeIn }}>
        <GlassCard style={styles.profileCard} borderColor={Colors.goldAlpha20} elevated>
          <LinearGradient
            colors={["rgba(90,61,143,0.08)", Colors.goldAlpha05, "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <Pressable onPress={handleDevTap} accessibilityLabel="Profile avatar">
            <Animated.View style={[styles.avatarRing, { transform: [{ scale: ringScale }] }]}>
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                style={styles.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarEmoji}>🧘</Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
          <Text style={styles.profileName}>Compassion Player</Text>
          <View style={styles.rankBadge}>
            <MaterialCommunityIcons name="crown" size={12} color={Colors.forestDeep} />
            <Text style={styles.rankText}>Zen Rank {zen.rank} · {zen.label}</Text>
          </View>
          <Pressable onPress={handleShare} style={styles.shareProfileBtn} accessibilityRole="button" accessibilityLabel="Share your profile">
            <Feather name="share-2" size={14} color={Colors.neuralPurple} />
            <Text style={styles.shareProfileText}>Share Profile</Text>
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.rankCard} borderColor={Colors.glassBorderLight}>
          <View style={styles.rankHeader}>
            <Text style={styles.cardEyebrow}>ZEN RANK PROGRESS</Text>
            <Text style={styles.rankLevel}>{zen.rank} → {Math.min(zen.rank + 1, 10)}</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold]}
              style={[styles.progressFill, { width: `${Math.min(zenProgress, 1) * 100}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.progressLabel}>{zen.points} / {zen.nextThreshold} Compassion Points</Text>
        </GlassCard>

        <GlassCard style={styles.hbhsCard} borderColor="rgba(244,114,182,0.2)" elevated>
          <LinearGradient
            colors={["rgba(244,114,182,0.06)", "rgba(167,139,250,0.06)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.cardEyebrowPink}>HEART-BRAIN HYBRID SCORE</Text>
          <View style={styles.hbhsRow}>
            <Text style={styles.hbhsValue}>{hbhsScore.toFixed(1)}</Text>
            <View style={styles.hbhsTag}>
              <Text style={styles.hbhsTagText}>HBHS</Text>
            </View>
            <View style={{ flex: 1 }} />
          </View>
          <View style={styles.neuralRow}>
            <View style={[styles.neuralPill, { backgroundColor: Colors.empathyGreenDim }]}>
              <Text style={styles.neuralPillLabel}>EI</Text>
              <Text style={[styles.neuralPillVal, { color: Colors.empathyGreen }]}>{empathyAvg}%</Text>
            </View>
            <View style={[styles.neuralPill, { backgroundColor: Colors.mindfulBlueDim }]}>
              <Text style={styles.neuralPillLabel}>NE</Text>
              <Text style={[styles.neuralPillVal, { color: Colors.mindfulBlue }]}>{data.neuralEnergy}</Text>
            </View>
            <View style={[styles.neuralPill, { backgroundColor: Colors.balanceAmberDim }]}>
              <Text style={styles.neuralPillLabel}>WINS</Text>
              <Text style={[styles.neuralPillVal, { color: Colors.balanceAmber }]}>{data.totalWins}</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.empathyCard} borderColor="rgba(167,139,250,0.15)" elevated>
          <LinearGradient
            colors={["rgba(90,61,143,0.08)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.empathyHead}>
            <Text style={styles.cardEyebrowPurple}>EMPATHY INDEX</Text>
            <View style={styles.empathyBadge}>
              <Text style={styles.empathyBadgeText}>{empathyAvg}%</Text>
            </View>
          </View>
          <View style={styles.empathyBars}>
            {empathyDims.map((d) => (
              <View key={d.label} style={styles.empathyBarRow}>
                <Text style={styles.empathyBarLabel}>{d.label}</Text>
                <View style={styles.empathyBarTrack}>
                  <View style={[styles.empathyBarFill, { width: `${Math.round(d.value * 100)}%`, backgroundColor: d.color }]} />
                </View>
                <Text style={[styles.empathyBarVal, { color: d.color }]}>{Math.round(d.value * 100)}%</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <Text style={styles.sectionEyebrow}>YOUR IMPACT</Text>
        <Text style={styles.sectionTitle}>Making a difference</Text>
        <View style={styles.impactGrid}>
          {[
            { label: "Total Donated", value: `$${data.totalDonated.toFixed(2)}`, icon: "heart" },
            { label: "Wins", value: String(data.totalWins), icon: "trophy" },
            { label: "Day Streak", value: String(data.streak), icon: "flame" },
            { label: "Neural Energy", value: String(data.neuralEnergy), icon: "flash" },
            { label: "Spins Left", value: String(data.spinsLeft), icon: "repeat" },
            { label: "Gratitudes", value: String(data.gratitudeCount), icon: "sunny" },
          ].map((stat, i) => (
            <GlassCard key={i} style={styles.impactCard} borderColor={Colors.glassBorderLight}>
              <Ionicons name={stat.icon as any} size={20} color={Colors.gold} />
              <Text style={styles.impactValue}>{stat.value}</Text>
              <Text style={styles.impactLabel}>{stat.label}</Text>
            </GlassCard>
          ))}
        </View>

        <Text style={styles.sectionEyebrow}>LIVES IMPACTED</Text>
        <Text style={styles.sectionTitle}>Your real-world footprint</Text>
        <View style={styles.livesRow}>
          {[
            { icon: "🌳", val: String(treesEquiv), label: "Trees", color: Colors.empathyGreen },
            { icon: "🍽️", val: String(mealsEquiv), label: "Meals", color: Colors.balanceAmber },
            { icon: "📖", val: studentsEquiv, label: "Students", color: Colors.mindfulBlue },
            { icon: "🧘", val: String(data.gratitudeCount), label: "Practices", color: Colors.neuralPurple },
          ].map((l, i) => (
            <View key={i} style={styles.livesItem}>
              <Text style={styles.livesIcon}>{l.icon}</Text>
              <Text style={[styles.livesVal, { color: l.color }]}>{l.val}</Text>
              <Text style={styles.livesLabel}>{l.label}</Text>
            </View>
          ))}
        </View>

        <GlassCard style={styles.charityCard} borderColor={Colors.goldAlpha20}>
          <LinearGradient
            colors={[Colors.goldAlpha05, "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.charityHeader}>
            <Ionicons name="heart" size={20} color={Colors.gold} />
            <Text style={styles.charityTitle}>Charity Allocation</Text>
          </View>
          <Text style={styles.charitySubtext}>30% of all revenue donated to verified partners</Text>
          <View style={styles.charityBreakdown}>
            {[
              { cause: "End Hunger", percent: "25%" },
              { cause: "Clean Water", percent: "25%" },
              { cause: "Climate Action", percent: "20%" },
              { cause: "Education", percent: "15%" },
              { cause: "Mental Health", percent: "10%" },
              { cause: "Ocean Cleanup", percent: "5%" },
            ].map((item, i) => (
              <View key={i} style={styles.charityRow}>
                <View style={styles.charityRowLeft}>
                  <View style={styles.charityDot} />
                  <Text style={styles.charityCause}>{item.cause}</Text>
                </View>
                <Text style={styles.charityPercent}>{item.percent}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <Pressable onPress={handleShare} style={({ pressed }) => [pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="Share your journey and impact">
          <GlassCard style={styles.shareImpactCard} borderColor="rgba(167,139,250,0.2)">
            <LinearGradient
              colors={["rgba(167,139,250,0.08)", "rgba(244,114,182,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Feather name="share-2" size={22} color={Colors.neuralPurple} />
            <View style={styles.shareImpactText}>
              <Text style={styles.shareImpactTitle}>Share Your Journey</Text>
              <Text style={styles.shareImpactSub}>Let friends see your impact and inspire change</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.whiteAlpha30} />
          </GlassCard>
        </Pressable>

        <Text style={styles.sectionEyebrow}>ACHIEVEMENTS</Text>
        <Text style={styles.sectionTitle}>Milestones ({unlockedCount}/{achievements.length})</Text>
        <View style={styles.achievementsGrid}>
          {achievements.map((a) => (
            <GlassCard
              key={a.id}
              style={[styles.achieveCard, !a.unlocked && styles.achieveCardLocked]}
              borderColor={a.unlocked ? Colors.goldAlpha15 : Colors.whiteAlpha05}
            >
              {a.unlocked && (
                <LinearGradient
                  colors={[Colors.goldAlpha08, "transparent"]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Feather
                name={a.icon as any}
                size={22}
                color={a.unlocked ? Colors.gold : Colors.whiteAlpha20}
              />
              <Text style={[styles.achieveTitle, !a.unlocked && styles.achieveTitleLocked]}>
                {a.title}
              </Text>
              {!a.unlocked && (
                <Ionicons name="lock-closed" size={10} color={Colors.whiteAlpha20} />
              )}
            </GlassCard>
          ))}
        </View>

        <Text style={styles.sectionEyebrow}>WEARABLE</Text>
        <Pressable
          onPress={() => router.push("/wearable")}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`Connect ${healthProviderLabel}`}
        >
          <GlassCard style={styles.settingsCard} borderColor="rgba(167,139,250,0.25)">
            <View style={styles.settingRow}>
              <MaterialCommunityIcons name="heart-pulse" size={20} color="#A78BFA" />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Connect {healthProviderLabel}</Text>
                <Text style={{ color: Colors.whiteAlpha60, fontSize: 12, marginTop: 2 }}>
                  Sync HRV, sleep, and steps
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.whiteAlpha20} />
            </View>
          </GlassCard>
        </Pressable>

        <Text style={styles.sectionEyebrow}>SETTINGS</Text>
        <GlassCard style={styles.settingsCard} borderColor={Colors.glassBorderLight}>
          {SETTINGS.map((s, i) => (
            <View key={s.id}>
              <Pressable
                onPress={() => (s.toggle ? toggleSetting(s.id) : handleSettingPress(s.id))}
                style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
                accessibilityRole={s.toggle ? "switch" : "button"}
                accessibilityLabel={s.label}
                accessibilityState={s.toggle ? { checked: settings[s.id] } : undefined}
              >
                <Feather
                  name={s.icon as any}
                  size={18}
                  color={s.id === "reset" ? Colors.error : Colors.whiteAlpha60}
                />
                <Text style={[styles.settingLabel, s.id === "reset" && { color: Colors.error }]}>
                  {s.label}
                </Text>
                {s.toggle ? (
                  <View style={[styles.toggle, settings[s.id] && styles.toggleOn]}>
                    <View style={[styles.toggleKnob, settings[s.id] && styles.toggleKnobOn]} />
                  </View>
                ) : (
                  <Feather name="chevron-right" size={16} color={Colors.whiteAlpha20} />
                )}
              </Pressable>
              {i < SETTINGS.length - 1 && <View style={styles.settingDivider} />}
            </View>
          ))}
        </GlassCard>

        <Text style={styles.version} accessibilityRole="text">NeuroQuest v1.0.0 · Made with purpose</Text>
        </Animated.View>
      </ScrollView>

      <Modal visible={legalTab !== null} animationType="slide" presentationStyle="fullScreen">
        {legalTab && (
          <LegalScreen
            initialTab={legalTab}
            onClose={() => setLegalTab(null)}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  starField: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  star: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.starlight,
  },
  starSm: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.champagne,
  },
  starTn: {
    position: "absolute",
    width: 1.5,
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: Colors.whiteAlpha60,
  },
  nebulaGlow: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.cosmicGlow,
  },
  sectionEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  cardEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 2,
  },
  cardEyebrowPink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.compassionPink,
    letterSpacing: 3,
  },
  cardEyebrowPurple: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.neuralPurple,
    letterSpacing: 3,
  },
  profileCard: {
    padding: 32,
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  avatarRing: {
    borderRadius: 50,
    padding: 3,
    borderWidth: 2,
    borderColor: Colors.goldAlpha30,
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 40,
  },
  profileName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: Colors.white,
  },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  rankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.forestDeep,
    letterSpacing: 0.5,
  },
  shareProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    backgroundColor: Colors.neuralPurpleDim,
  },
  shareProfileText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.neuralPurple,
  },
  rankCard: {
    padding: 20,
    gap: 12,
  },
  rankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rankLevel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.gold,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 100,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 100,
  },
  progressLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
  },
  hbhsCard: {
    padding: 22,
    gap: 12,
    overflow: "hidden",
  },
  hbhsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  hbhsValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 42,
    color: Colors.white,
  },
  hbhsTag: {
    backgroundColor: Colors.compassionPinkDim,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hbhsTagText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: Colors.compassionPink,
    letterSpacing: 2,
  },
  neuralRow: {
    flexDirection: "row",
    gap: 8,
  },
  neuralPill: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 2,
  },
  neuralPillLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    letterSpacing: 1,
  },
  neuralPillVal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
  },
  empathyCard: {
    padding: 22,
    gap: 14,
    overflow: "hidden",
  },
  empathyHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  empathyBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.empathyGreenDim,
    alignItems: "center",
    justifyContent: "center",
  },
  empathyBadgeText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: Colors.empathyGreen,
  },
  empathyBars: {
    gap: 8,
  },
  empathyBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  empathyBarLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha50,
    width: 85,
    textAlign: "right",
  },
  empathyBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 100,
    overflow: "hidden",
  },
  empathyBarFill: {
    height: "100%",
    borderRadius: 100,
  },
  empathyBarVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    width: 30,
  },
  impactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  impactCard: {
    width: "47%",
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  impactValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.white,
  },
  impactLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    textAlign: "center",
  },
  livesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  livesItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  livesIcon: {
    fontSize: 28,
  },
  livesVal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
  },
  livesLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
  },
  charityCard: {
    padding: 20,
    gap: 14,
    overflow: "hidden",
  },
  charityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  charityTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  charitySubtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    marginTop: -8,
  },
  charityBreakdown: {
    gap: 10,
  },
  charityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charityRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  charityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  charityCause: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.whiteAlpha60,
  },
  charityPercent: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.whiteAlpha30,
  },
  shareImpactCard: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
  },
  shareImpactText: {
    flex: 1,
    gap: 3,
  },
  shareImpactTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.white,
  },
  shareImpactSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  achieveCard: {
    width: "30%",
    padding: 16,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  achieveCardLocked: {
    opacity: 0.5,
  },
  achieveTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.gold,
    textAlign: "center",
  },
  achieveTitleLocked: {
    color: Colors.whiteAlpha20,
  },
  settingsCard: {
    padding: 4,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  settingLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    flex: 1,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha05,
    marginHorizontal: 16,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.whiteAlpha10,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: Colors.empathyGreenDim,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.whiteAlpha30,
  },
  toggleKnobOn: {
    backgroundColor: Colors.empathyGreen,
    alignSelf: "flex-end",
  },
  version: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    textAlign: "center",
    marginTop: 8,
  },
});
