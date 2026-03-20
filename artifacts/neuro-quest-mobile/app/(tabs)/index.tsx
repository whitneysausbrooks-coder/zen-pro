import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";

const BLOOM_KEY = "nq_morning_bloom_date";
const GRATITUDE_LOG_KEY = "nq_gratitude_log";
const NEURAL_ENERGY_KEY = "nq_neural_energy";
const DONATIONS_KEY = "nq_micro_donations";
const SPINS_KEY = "nq_spins_left";
const STREAK_KEY = "nq_streak_count";
const GRATITUDE_STREAK_KEY = "nq_gratitude_streak";

const { width } = Dimensions.get("window");
const nd = Platform.OS !== "web";

const CAUSES = [
  { id: "hunger", label: "End Hunger", icon: "🌾", org: "World Food Programme" },
  { id: "climate", label: "Climate Action", icon: "🌿", org: "Patagonia 1% Fund" },
  { id: "water", label: "Clean Water", icon: "💧", org: "charity: water" },
  { id: "education", label: "Education", icon: "📚", org: "Khan Academy" },
  { id: "mental", label: "Mental Health", icon: "🧠", org: "NAMI" },
  { id: "ocean", label: "Ocean Cleanup", icon: "🌊", org: "The Ocean Cleanup" },
];

const IMPACT_FEED = [
  { id: "1", user: "A.K.", cause: "Clean Water", amount: "$12.50", time: "Just now" },
  { id: "2", user: "M.J.", cause: "End Hunger", amount: "$25.00", time: "2m ago" },
  { id: "3", user: "S.T.", cause: "Climate Action", amount: "$8.00", time: "5m ago" },
  { id: "4", user: "R.P.", cause: "Education", amount: "$50.00", time: "12m ago" },
  { id: "5", user: "L.C.", cause: "Mental Health", amount: "$15.00", time: "18m ago" },
];

const CHARITY_PARTNERS = [
  "World Food Programme",
  "charity: water",
  "Khan Academy",
  "NAMI",
  "The Ocean Cleanup",
  "Doctors Without Borders",
];

const EMPATHY_DIMENSIONS = [
  { label: "Compassion", value: 0.89, color: Colors.compassionPink },
  { label: "Connection", value: 0.82, color: Colors.empathyGreen },
  { label: "Mindfulness", value: 0.91, color: Colors.mindfulBlue },
  { label: "Listening", value: 0.76, color: Colors.neuralPurple },
  { label: "Emotional Safety", value: 0.84, color: Colors.balanceAmber },
  { label: "Shared Purpose", value: 0.78, color: Colors.gold },
];

const LIVES_IMPACTED = [
  { icon: "🌳", value: "15", label: "Trees Planted", color: Colors.empathyGreen },
  { icon: "🍽️", value: "23", label: "Meals Funded", color: Colors.balanceAmber },
  { icon: "📖", value: "2", label: "Students Funded", color: Colors.mindfulBlue },
  { icon: "🧘", value: "0.5", label: "Therapy Sessions", color: Colors.neuralPurple },
];

const NEURAL_METRICS = [
  { label: "Empathy", value: "75%", color: Colors.empathyGreen, bg: Colors.empathyGreenDim },
  { label: "Mindfulness", value: "82%", color: Colors.mindfulBlue, bg: Colors.mindfulBlueDim },
  { label: "Balance", value: "680", color: Colors.balanceAmber, bg: Colors.balanceAmberDim },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [selectedCause, setSelectedCause] = useState("hunger");
  const [showBloom, setShowBloom] = useState(false);
  const [gratitudeText, setGratitudeText] = useState("");
  const [bloomSubmitted, setBloomSubmitted] = useState(false);
  const [isSubmittingBloom, setIsSubmittingBloom] = useState(false);
  const [neuralEnergy, setNeuralEnergy] = useState(0);
  const [totalDonated, setTotalDonated] = useState(0);
  const [spinsLeft, setSpinsLeft] = useState(5);
  const [streakCount, setStreakCount] = useState(7);
  const [gratitudeLog, setGratitudeLog] = useState<{text: string; date: string}[]>([]);
  const [todayGratitude, setTodayGratitude] = useState<string | null>(null);
  const bloomFadeAnim = useRef(new Animated.Value(0)).current;
  const bloomScaleAnim = useRef(new Animated.Value(0.8)).current;
  const rewardAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const starAnim1 = useRef(new Animated.Value(0)).current;
  const starAnim2 = useRef(new Animated.Value(0)).current;
  const starAnim3 = useRef(new Animated.Value(0)).current;
  const bloomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const openBloomModal = useCallback(() => {
    setShowBloom(true);
    Animated.parallel([
      Animated.timing(bloomFadeAnim, { toValue: 1, duration: 600, useNativeDriver: nd }),
      Animated.spring(bloomScaleAnim, { toValue: 1, friction: 6, useNativeDriver: nd }),
    ]).start();
  }, []);

  const rehydrateData = useCallback(async () => {
    try {
      const [energy, donations, spins, streak, logStr] = await Promise.all([
        AsyncStorage.getItem(NEURAL_ENERGY_KEY),
        AsyncStorage.getItem(DONATIONS_KEY),
        AsyncStorage.getItem(SPINS_KEY),
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(GRATITUDE_LOG_KEY),
      ]);
      if (energy) setNeuralEnergy(parseInt(energy, 10) || 0);
      if (donations) setTotalDonated(parseFloat(donations) || 0);
      setSpinsLeft(spins ? (parseInt(spins, 10) || 5) : 5);
      if (streak) setStreakCount(parseInt(streak, 10) || 7);
      if (logStr) {
        const parsed = JSON.parse(logStr);
        setGratitudeLog(parsed.slice(0, 5));
        const today = new Date().toISOString().split("T")[0];
        const todayEntry = parsed.find((e: any) => e.date === today);
        if (todayEntry) setTodayGratitude(todayEntry.text);
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      rehydrateData();
    }, [rehydrateData])
  );

  useEffect(() => {
    mountedRef.current = true;
    const checkBloom = async () => {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          if (params.get("resetBloom") === "1") {
            await AsyncStorage.removeItem(BLOOM_KEY);
          }
        }
        const lastDate = await AsyncStorage.getItem(BLOOM_KEY);
        const today = new Date().toISOString().split("T")[0];
        if (lastDate !== today) {
          bloomTimer.current = setTimeout(() => {
            if (mountedRef.current) openBloomModal();
          }, 1200);
        }
        await rehydrateData();
      } catch {}
    };
    checkBloom();
    return () => {
      mountedRef.current = false;
      if (bloomTimer.current) clearTimeout(bloomTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const handleBloomSubmit = useCallback(async () => {
    if (!gratitudeText.trim() || isSubmittingBloom) return;
    setIsSubmittingBloom(true);
    if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const today = new Date().toISOString().split("T")[0];
    try {
      const alreadyDone = await AsyncStorage.getItem(BLOOM_KEY);
      if (alreadyDone === today) {
        setIsSubmittingBloom(false);
        return;
      }
      await AsyncStorage.setItem(BLOOM_KEY, today);
      const existing = await AsyncStorage.getItem(GRATITUDE_LOG_KEY);
      const log = existing ? JSON.parse(existing) : [];
      log.unshift({ text: gratitudeText.trim(), date: today, reward: 20 });
      if (log.length > 30) log.length = 30;
      await AsyncStorage.setItem(GRATITUDE_LOG_KEY, JSON.stringify(log));
      setGratitudeLog(log.slice(0, 5));
      const newEnergy = neuralEnergy + 20;
      setNeuralEnergy(newEnergy);
      await AsyncStorage.setItem(NEURAL_ENERGY_KEY, String(newEnergy));
    } catch {}
    setBloomSubmitted(true);
    setTodayGratitude(gratitudeText.trim());
    Animated.timing(rewardAnim, { toValue: 1, duration: 800, useNativeDriver: nd }).start();
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.parallel([
        Animated.timing(bloomFadeAnim, { toValue: 0, duration: 400, useNativeDriver: nd }),
        Animated.timing(bloomScaleAnim, { toValue: 0.8, duration: 400, useNativeDriver: nd }),
      ]).start(() => {
        setShowBloom(false);
        setBloomSubmitted(false);
        setGratitudeText("");
        setIsSubmittingBloom(false);
        bloomFadeAnim.setValue(0);
        bloomScaleAnim.setValue(0.8);
        rewardAnim.setValue(0);
      });
      dismissTimer.current = null;
    }, 2200);
  }, [gratitudeText, neuralEnergy, isSubmittingBloom]);

  const handleBloomDismiss = useCallback(async () => {
    if (nd) Haptics.selectionAsync();
    const today = new Date().toISOString().split("T")[0];
    try { await AsyncStorage.setItem(BLOOM_KEY, today); } catch {}
    Animated.parallel([
      Animated.timing(bloomFadeAnim, { toValue: 0, duration: 300, useNativeDriver: nd }),
      Animated.timing(bloomScaleAnim, { toValue: 0.8, duration: 300, useNativeDriver: nd }),
    ]).start(() => {
      setShowBloom(false);
      setGratitudeText("");
    });
  }, []);

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: nd,
    }).start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 3000, useNativeDriver: nd }),
        Animated.timing(glowAnim, { toValue: 0, duration: 3000, useNativeDriver: nd }),
      ])
    );
    glow.start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: nd }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, useNativeDriver: nd }),
      ])
    );
    pulse.start();

    const makeStarAnim = (anim: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: dur, useNativeDriver: nd }),
          Animated.timing(anim, { toValue: 0, duration: dur, useNativeDriver: nd }),
        ])
      );
    const s1 = makeStarAnim(starAnim1, 2500);
    const s2 = makeStarAnim(starAnim2, 3200);
    const s3 = makeStarAnim(starAnim3, 1800);
    s1.start();
    s2.start();
    s3.start();

    return () => {
      glow.stop();
      pulse.stop();
      s1.stop();
      s2.stop();
      s3.stop();
    };
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const star1Op = starAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const star2Op = starAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });
  const star3Op = starAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.85] });

  const handleCauseSelect = useCallback((id: string) => {
    if (nd) Haptics.selectionAsync();
    setSelectedCause(id);
  }, []);

  const handlePlayPress = useCallback(() => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/play" as any);
  }, []);

  const handleTrainPress = useCallback(() => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/train" as any);
  }, []);

  const handleShare = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg =
      `I'm training my mind and changing lives with NeuroQuest! 🧠✨\n\n` +
      `My Impact: $${totalDonated.toFixed(2)} donated • ${neuralEnergy} Neural Energy\n` +
      `Empathy Index: ${empathyIndex}% • ${streakCount}-day streak 🔥\n\n` +
      `Every spin funds real charities. 30% of revenue goes to verified partners worldwide.\n\n` +
      `Join the Compassion Casino → neuroquest.app`;
    if (Platform.OS === "web") {
      try {
        await Clipboard.setStringAsync(msg);
        Alert.alert("Copied!", "Share text copied to clipboard.");
      } catch {}
    } else {
      try {
        await Share.share({ message: msg, title: "My NeuroQuest Impact" });
      } catch {}
    }
  }, [totalDonated, neuralEnergy, streakCount]);

  const empathyIndex = 87;
  const hbhsScore = 100.0;
  const hbhsChange = "+14%";

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.celestialBlue, Colors.black, Colors.black]}
        locations={[0, 0.15, 0.35, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.starField, { opacity: star1Op }]}>
        <View style={[styles.star, { top: 60, left: 30 }]} />
        <View style={[styles.star, { top: 120, right: 50 }]} />
        <View style={[styles.starSmall, { top: 200, left: 100 }]} />
        <View style={[styles.star, { top: 340, right: 90 }]} />
        <View style={[styles.starSmall, { top: 80, left: width * 0.6 }]} />
      </Animated.View>
      <Animated.View style={[styles.starField, { opacity: star2Op }]}>
        <View style={[styles.starSmall, { top: 150, left: 60 }]} />
        <View style={[styles.star, { top: 250, right: 30 }]} />
        <View style={[styles.starSmall, { top: 400, left: 40 }]} />
        <View style={[styles.star, { top: 100, left: width * 0.45 }]} />
      </Animated.View>
      <Animated.View style={[styles.starField, { opacity: star3Op }]}>
        <View style={[styles.starTiny, { top: 90, right: 100 }]} />
        <View style={[styles.starTiny, { top: 180, left: 150 }]} />
        <View style={[styles.star, { top: 300, left: 20 }]} />
        <View style={[styles.starTiny, { top: 50, left: width * 0.3 }]} />
      </Animated.View>

      <View style={styles.nebulaGlow1} />
      <View style={styles.nebulaGlow2} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn }}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.greeting}>WELCOME BACK</Text>
              <Text style={styles.username}>NeuroQuest{"\n"}Compassion Casino</Text>
            </View>
            <View style={styles.topRight}>
              <Pressable onPress={handleShare} style={styles.shareBtn}>
                <Feather name="share" size={18} color={Colors.gold} />
              </Pressable>
              <View style={styles.streakContainer}>
                <Animated.View style={[styles.streakBadge, { transform: [{ scale: pulseScale }] }]}>
                  <Text style={styles.streakNumber}>{streakCount}</Text>
                </Animated.View>
                <Text style={styles.streakLabel}>day streak</Text>
              </View>
            </View>
          </View>

          <GlassCard style={styles.heroBanner} borderColor={Colors.goldAlpha20} elevated>
            <LinearGradient
              colors={["rgba(90,61,143,0.08)", "rgba(212,175,55,0.12)", "rgba(90,61,143,0.04)"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Animated.View style={[styles.heroGlow, { opacity: glowOpacity }]} />

            <Text style={styles.heroEyebrow}>GLOBAL COMPASSION POOL</Text>
            <Text style={styles.heroAmount}>$2,847,392</Text>
            <View style={styles.heroSubRow}>
              <View style={styles.heroDot} />
              <Text style={styles.heroSub}>Donated to verified charities worldwide</Text>
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNum}>142,847</Text>
                <Text style={styles.heroStatLabel}>Players</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNum}>38</Text>
                <Text style={styles.heroStatLabel}>Countries</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNum}>12</Text>
                <Text style={styles.heroStatLabel}>Partners</Text>
              </View>
            </View>
          </GlassCard>

          <View style={styles.personalStats}>
            <GlassCard style={styles.personalCard} borderColor={Colors.glassBorderLight}>
              <Text style={styles.personalValue}>${totalDonated > 0 ? totalDonated.toFixed(2) : "0.00"}</Text>
              <Text style={styles.personalLabel}>Your Impact</Text>
            </GlassCard>
            <GlassCard style={styles.personalCard} borderColor={Colors.glassBorderLight}>
              <Text style={styles.personalValue}>⚡{neuralEnergy}</Text>
              <Text style={styles.personalLabel}>Neural Energy</Text>
            </GlassCard>
            <GlassCard style={styles.personalCard} borderColor={Colors.glassBorderLight}>
              <Text style={styles.personalValue}>{spinsLeft}</Text>
              <Text style={styles.personalLabel}>Spins</Text>
            </GlassCard>
          </View>

          {todayGratitude && (
            <GlassCard style={styles.gratitudeCard} borderColor="rgba(244,114,182,0.2)">
              <LinearGradient
                colors={["rgba(244,114,182,0.08)", "rgba(167,139,250,0.04)", "transparent"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.gratitudeHeader}>
                <Text style={styles.gratitudeFlower}>🌸</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gratitudeEyebrow}>TODAY'S GRATITUDE</Text>
                  <Text style={styles.gratitudeText}>"{todayGratitude}"</Text>
                </View>
              </View>
              <View style={styles.gratitudeReward}>
                <Ionicons name="flash" size={12} color={Colors.balanceAmber} />
                <Text style={styles.gratitudeRewardText}>+20 Neural Energy earned</Text>
              </View>
            </GlassCard>
          )}

          {!todayGratitude && !showBloom && (
            <Pressable onPress={openBloomModal} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
              <GlassCard style={styles.gratitudePrompt} borderColor="rgba(244,114,182,0.15)">
                <Text style={styles.gratitudeFlower}>🌸</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gratitudePromptTitle}>Morning Bloom</Text>
                  <Text style={styles.gratitudePromptSub}>Tap to share what you're grateful for today</Text>
                </View>
                <View style={styles.gratitudePromptBadge}>
                  <Ionicons name="flash" size={12} color={Colors.balanceAmber} />
                  <Text style={styles.gratitudePromptBadgeText}>+20</Text>
                </View>
              </GlassCard>
            </Pressable>
          )}

          <GlassCard style={styles.empathyCard} borderColor="rgba(167,139,250,0.2)" elevated>
            <LinearGradient
              colors={["rgba(90,61,143,0.12)", "rgba(26,39,68,0.08)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.empathyHeader}>
              <View>
                <Text style={styles.empathyEyebrow}>EMPATHY INDEX</Text>
                <Text style={styles.empathySubtitle}>Collective Emotional Intelligence</Text>
              </View>
              <View style={styles.empathyScoreCircle}>
                <LinearGradient
                  colors={[Colors.empathyGreen, Colors.empathyGreenDim]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.empathyScoreNum}>{empathyIndex}%</Text>
              </View>
            </View>
            <View style={styles.empathyChangeRow}>
              <Ionicons name="trending-up" size={14} color={Colors.empathyGreen} />
              <Text style={styles.empathyChangeText}>{hbhsChange} from last week</Text>
            </View>
            <View style={styles.empathyBars}>
              {EMPATHY_DIMENSIONS.map((dim) => (
                <View key={dim.label} style={styles.empathyBarRow}>
                  <Text style={styles.empathyBarLabel}>{dim.label}</Text>
                  <View style={styles.empathyBarTrack}>
                    <View
                      style={[
                        styles.empathyBarFill,
                        { width: `${dim.value * 100}%`, backgroundColor: dim.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.empathyBarValue, { color: dim.color }]}>
                    {Math.round(dim.value * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.hbhsCard} borderColor="rgba(244,114,182,0.2)" elevated>
            <LinearGradient
              colors={["rgba(244,114,182,0.06)", "rgba(167,139,250,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.hbhsEyebrow}>HEART-BRAIN HYBRID SCORE</Text>
            <View style={styles.hbhsMain}>
              <Text style={styles.hbhsScore}>{hbhsScore.toFixed(1)}</Text>
              <View style={styles.hbhsBadge}>
                <Text style={styles.hbhsBadgeText}>HBHS</Text>
              </View>
            </View>
            <Text style={styles.hbhsFormula}>
              {"HBHS = \u221A{(EI \u00B7 MP \u00B7 NEB) \u00D7 1.2{Cohesion}}"}
            </Text>
            <View style={styles.neuralRow}>
              {NEURAL_METRICS.map((m) => (
                <View key={m.label} style={[styles.neuralMetric, { backgroundColor: m.bg }]}>
                  <Text style={styles.neuralMetricLabel}>Live%</Text>
                  <Text style={[styles.neuralMetricValue, { color: m.color }]}>{m.value}</Text>
                  <Text style={styles.neuralMetricName}>{m.label}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <Text style={styles.sectionEyebrow}>LIVES IMPACTED</Text>
          <Text style={styles.sectionTitle}>Your real-world footprint</Text>
          <View style={styles.livesGrid}>
            {LIVES_IMPACTED.map((item) => (
              <GlassCard key={item.label} style={styles.livesCard} borderColor={Colors.glassBorderLight}>
                <Text style={styles.livesIcon}>{item.icon}</Text>
                <Text style={[styles.livesValue, { color: item.color }]}>{item.value}</Text>
                <Text style={styles.livesLabel}>{item.label}</Text>
              </GlassCard>
            ))}
          </View>

          <Pressable onPress={handleShare} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
            <GlassCard style={styles.shareCard} borderColor="rgba(167,139,250,0.2)">
              <LinearGradient
                colors={["rgba(167,139,250,0.08)", "rgba(244,114,182,0.06)", "transparent"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Feather name="share-2" size={20} color={Colors.neuralPurple} />
              <View style={styles.shareTextWrap}>
                <Text style={styles.shareTitle}>Share Your Impact</Text>
                <Text style={styles.shareSub}>Inspire others to train their minds for good</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.whiteAlpha30} />
            </GlassCard>
          </Pressable>

          <Text style={styles.sectionEyebrow}>CHOOSE YOUR CAUSE</Text>
          <Text style={styles.sectionTitle}>Where should your impact go?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.causesScroll}
            style={styles.causesContainer}
          >
            {CAUSES.map((cause) => {
              const isSelected = selectedCause === cause.id;
              return (
                <Pressable
                  key={cause.id}
                  onPress={() => handleCauseSelect(cause.id)}
                  style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                >
                  <GlassCard
                    style={[styles.causeCard, isSelected && styles.causeCardSelected]}
                    borderColor={isSelected ? Colors.goldAlpha30 : Colors.glassBorderLight}
                  >
                    {isSelected && (
                      <LinearGradient
                        colors={[Colors.goldAlpha10, Colors.goldAlpha05]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={styles.causeIcon}>{cause.icon}</Text>
                    <Text style={[styles.causeLabel, isSelected && styles.causeLabelSelected]}>
                      {cause.label}
                    </Text>
                    <Text style={styles.causeOrg}>{cause.org}</Text>
                    {isSelected && (
                      <View style={styles.causeCheck}>
                        <Ionicons name="checkmark" size={12} color={Colors.forestDeep} />
                      </View>
                    )}
                  </GlassCard>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handlePlayPress}
              style={({ pressed }) => [styles.primaryAction, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                style={styles.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="cards-club" size={22} color={Colors.forestDeep} />
                <Text style={styles.primaryText}>Spin for Good</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={handleTrainPress}
              style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: 0.85 }]}
            >
              <MaterialCommunityIcons name="brain" size={20} color={Colors.gold} />
              <Text style={styles.secondaryText}>Train</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionEyebrow}>LIVE IMPACT FEED</Text>
          <Text style={styles.sectionTitle}>Real donations, real change</Text>
          <View style={styles.feedList}>
            {IMPACT_FEED.map((item) => (
              <GlassCard key={item.id} style={styles.feedCard} borderColor={Colors.glassBorderLight}>
                <View style={styles.feedAvatar}>
                  <Text style={styles.feedAvatarText}>{item.user}</Text>
                </View>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedCause}>{item.cause}</Text>
                  <Text style={styles.feedTime}>{item.time}</Text>
                </View>
                <Text style={styles.feedAmount}>{item.amount}</Text>
              </GlassCard>
            ))}
          </View>

          <GlassCard style={styles.partnersCard} borderColor={Colors.glassBorderLight}>
            <Text style={styles.partnersEyebrow}>VERIFIED CHARITY PARTNERS</Text>
            <Text style={styles.partnersBody}>
              Every dollar is tracked and verified. We partner with world-class
              organizations to maximize your impact.
            </Text>
            <View style={styles.partnersList}>
              {CHARITY_PARTNERS.map((name) => (
                <View key={name} style={styles.partnerChip}>
                  <View style={styles.partnerDot} />
                  <Text style={styles.partnerName}>{name}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <View style={styles.missionCard}>
            <LinearGradient
              colors={[Colors.cosmicGlow, "rgba(212,175,55,0.04)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <Text style={styles.missionQuote}>
              "Turning Collective Neural Energy into Global Impact"
            </Text>
            <View style={styles.missionDivider} />
            <Text style={styles.missionBody}>
              NeuroQuest combines neuroscience-backed brain training with real
              charitable giving. Every interaction strengthens neural pathways
              while funding verified global causes.
            </Text>
            <View style={styles.missionMetrics}>
              <View style={styles.missionMetric}>
                <Text style={styles.missionMetricVal}>EI</Text>
                <Text style={styles.missionMetricLabel}>Emotional{"\n"}Intelligence</Text>
              </View>
              <Feather name="arrow-right" size={14} color={Colors.whiteAlpha30} />
              <View style={styles.missionMetric}>
                <Text style={styles.missionMetricVal}>MP</Text>
                <Text style={styles.missionMetricLabel}>Mental{"\n"}Performance</Text>
              </View>
              <Feather name="arrow-right" size={14} color={Colors.whiteAlpha30} />
              <View style={styles.missionMetric}>
                <Text style={styles.missionMetricVal}>NEB</Text>
                <Text style={styles.missionMetricLabel}>Neural Energy{"\n"}Boost</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal visible={showBloom} transparent animationType="none" statusBarTranslucent onRequestClose={handleBloomDismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={bloomStyles.overlay}
        >
          <Animated.View style={[bloomStyles.backdrop, { opacity: bloomFadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleBloomDismiss} />
          </Animated.View>
          <Animated.View
            style={[
              bloomStyles.card,
              {
                opacity: bloomFadeAnim,
                transform: [{ scale: bloomScaleAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                "rgba(90,61,143,0.15)",
                "rgba(13,59,59,0.95)",
                "rgba(10,26,10,0.98)",
              ]}
              style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <View style={bloomStyles.flowerWrap}>
              <Text style={bloomStyles.flowerEmoji}>🌸</Text>
              <Animated.View
                style={[
                  bloomStyles.flowerGlow,
                  {
                    opacity: bloomFadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.6],
                    }),
                  },
                ]}
              />
            </View>

            {!bloomSubmitted ? (
              <>
                <Text style={bloomStyles.eyebrow}>MORNING BLOOM</Text>
                <Text style={bloomStyles.title}>What are you grateful for today?</Text>
                <Text style={bloomStyles.subtitle}>
                  Daily gratitude rewires your prefrontal cortex for positivity and resilience
                </Text>

                <View style={bloomStyles.inputWrap}>
                  <TextInput
                    style={bloomStyles.input}
                    placeholder="Today I'm grateful for..."
                    placeholderTextColor={Colors.whiteAlpha30}
                    value={gratitudeText}
                    onChangeText={setGratitudeText}
                    multiline
                    maxLength={280}
                    numberOfLines={3}
                    textAlignVertical="top"
                    autoFocus={false}
                  />
                  <Text style={bloomStyles.charCount}>
                    {gratitudeText.length}/280
                  </Text>
                </View>

                <Pressable
                  onPress={handleBloomSubmit}
                  disabled={!gratitudeText.trim() || isSubmittingBloom}
                  style={({ pressed }) => [
                    bloomStyles.submitBtn,
                    (!gratitudeText.trim() || isSubmittingBloom) && bloomStyles.submitBtnDisabled,
                    pressed && gratitudeText.trim() && !isSubmittingBloom && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <LinearGradient
                    colors={
                      gratitudeText.trim()
                        ? [Colors.goldLight, Colors.gold, Colors.goldDim]
                        : ["rgba(212,175,55,0.2)", "rgba(212,175,55,0.1)"]
                    }
                    style={bloomStyles.submitGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons
                      name="leaf"
                      size={18}
                      color={gratitudeText.trim() ? Colors.forestDeep : Colors.whiteAlpha30}
                    />
                    <Text
                      style={[
                        bloomStyles.submitText,
                        !gratitudeText.trim() && { color: Colors.whiteAlpha30 },
                      ]}
                    >
                      Plant Your Gratitude
                    </Text>
                  </LinearGradient>
                </Pressable>

                <View style={bloomStyles.rewardPreview}>
                  <Ionicons name="flash" size={14} color={Colors.balanceAmber} />
                  <Text style={bloomStyles.rewardPreviewText}>
                    +20 Neural Energy reward
                  </Text>
                </View>

                <Pressable onPress={handleBloomDismiss} style={bloomStyles.skipBtn}>
                  <Text style={bloomStyles.skipText}>Maybe later</Text>
                </Pressable>
              </>
            ) : (
              <Animated.View
                style={[
                  bloomStyles.successWrap,
                  {
                    opacity: rewardAnim,
                    transform: [
                      {
                        scale: rewardAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.6, 1.1, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={bloomStyles.successEmoji}>✨</Text>
                <Text style={bloomStyles.successTitle}>Beautiful!</Text>
                <Text style={bloomStyles.successSub}>
                  Your gratitude strengthens neural pathways
                </Text>
                <View style={bloomStyles.rewardBadge}>
                  <Ionicons name="flash" size={18} color={Colors.balanceAmber} />
                  <Text style={bloomStyles.rewardBadgeText}>+20 Neural Energy</Text>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
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
  starSmall: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.champagne,
  },
  starTiny: {
    position: "absolute",
    width: 1.5,
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: Colors.whiteAlpha60,
  },
  nebulaGlow1: {
    position: "absolute",
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.cosmicGlow,
  },
  nebulaGlow2: {
    position: "absolute",
    top: 200,
    left: -120,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(26, 39, 68, 0.3)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.goldAlpha20,
    backgroundColor: Colors.goldAlpha05,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.goldDim,
    letterSpacing: 3,
  },
  username: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
    marginTop: 4,
    lineHeight: 26,
  },
  streakContainer: {
    alignItems: "center",
    gap: 4,
  },
  streakBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.goldAlpha30,
    backgroundColor: Colors.goldAlpha08,
    alignItems: "center",
    justifyContent: "center",
  },
  streakNumber: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.gold,
  },
  streakLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
    letterSpacing: 0.5,
  },
  heroBanner: {
    padding: 28,
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.gold,
    alignSelf: "center",
  },
  heroEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldRose,
    letterSpacing: 4,
    marginBottom: 12,
  },
  heroAmount: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 52,
    color: Colors.white,
    letterSpacing: -1,
  },
  heroSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha60,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    gap: 0,
    width: "100%",
    justifyContent: "center",
  },
  heroStat: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  heroStatNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.gold,
  },
  heroStatLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.whiteAlpha10,
  },
  personalStats: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  personalCard: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  personalValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
  },
  personalLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    letterSpacing: 0.5,
  },
  gratitudeCard: {
    padding: 20,
    gap: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  gratitudeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  gratitudeFlower: {
    fontSize: 28,
    marginTop: 2,
  },
  gratitudeEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.compassionPink,
    letterSpacing: 3,
    marginBottom: 6,
  },
  gratitudeText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 15,
    color: Colors.champagne,
    lineHeight: 22,
  },
  gratitudeReward: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
  },
  gratitudeRewardText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.balanceAmber,
  },
  gratitudePrompt: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
    marginBottom: 16,
  },
  gratitudePromptTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.champagne,
  },
  gratitudePromptSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha50,
    marginTop: 2,
  },
  gratitudePromptBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
  },
  gratitudePromptBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.balanceAmber,
  },
  empathyCard: {
    padding: 22,
    gap: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  empathyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  empathyEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.neuralPurple,
    letterSpacing: 3,
  },
  empathySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    marginTop: 2,
  },
  empathyScoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  empathyScoreNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  empathyChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  empathyChangeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.empathyGreen,
  },
  empathyBars: {
    gap: 8,
  },
  empathyBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    height: 6,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 100,
    overflow: "hidden",
  },
  empathyBarFill: {
    height: "100%",
    borderRadius: 100,
  },
  empathyBarValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    width: 32,
  },
  hbhsCard: {
    padding: 22,
    gap: 14,
    marginBottom: 20,
    overflow: "hidden",
  },
  hbhsEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.compassionPink,
    letterSpacing: 3,
  },
  hbhsMain: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  hbhsScore: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 48,
    color: Colors.white,
  },
  hbhsBadge: {
    backgroundColor: Colors.compassionPinkDim,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hbhsBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: Colors.compassionPink,
    letterSpacing: 2,
  },
  hbhsFormula: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    textAlign: "center",
  },
  neuralRow: {
    flexDirection: "row",
    gap: 8,
  },
  neuralMetric: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  neuralMetricLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    letterSpacing: 1,
  },
  neuralMetricValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  neuralMetricName: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.whiteAlpha50,
  },
  sectionEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
    marginBottom: 16,
  },
  livesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  livesCard: {
    width: "47%",
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  livesIcon: {
    fontSize: 28,
  },
  livesValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.gold,
  },
  livesLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  shareCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 14,
    marginBottom: 28,
    overflow: "hidden",
  },
  shareTextWrap: {
    flex: 1,
    gap: 2,
  },
  shareTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  shareSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
  },
  causesContainer: {
    marginHorizontal: -24,
    marginBottom: 28,
  },
  causesScroll: {
    paddingHorizontal: 24,
    gap: 10,
  },
  causeCard: {
    width: 140,
    padding: 18,
    gap: 6,
    overflow: "hidden",
    position: "relative",
  },
  causeCardSelected: {
    borderColor: Colors.goldAlpha30,
  },
  causeIcon: {
    fontSize: 28,
  },
  causeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.whiteAlpha80,
    marginTop: 4,
  },
  causeLabelSelected: {
    color: Colors.white,
  },
  causeOrg: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
    lineHeight: 14,
  },
  causeCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 36,
  },
  primaryAction: {
    flex: 1,
    borderRadius: 100,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 14,
  },
  primaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
    borderRadius: 100,
  },
  primaryText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 17,
    color: Colors.forestDeep,
    letterSpacing: 0.5,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.goldAlpha20,
    backgroundColor: Colors.goldAlpha05,
  },
  secondaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.gold,
  },
  feedList: {
    gap: 8,
    marginBottom: 32,
  },
  feedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.goldAlpha10,
    borderWidth: 1,
    borderColor: Colors.goldAlpha20,
    alignItems: "center",
    justifyContent: "center",
  },
  feedAvatarText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.gold,
  },
  feedInfo: {
    flex: 1,
    gap: 2,
  },
  feedCause: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.whiteAlpha90,
  },
  feedTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  feedAmount: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.gold,
  },
  partnersCard: {
    padding: 24,
    gap: 12,
    marginBottom: 24,
  },
  partnersEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
  },
  partnersBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    lineHeight: 20,
  },
  partnersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  partnerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  partnerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  partnerName: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.whiteAlpha60,
  },
  missionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.15)",
    padding: 28,
    gap: 16,
    overflow: "hidden",
  },
  missionQuote: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 20,
    color: Colors.champagne,
    textAlign: "center",
    lineHeight: 30,
  },
  missionDivider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.goldAlpha20,
    alignSelf: "center",
  },
  missionBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha30,
    textAlign: "center",
    lineHeight: 20,
  },
  missionMetrics: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  missionMetric: {
    alignItems: "center",
    gap: 4,
  },
  missionMetricVal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.gold,
  },
  missionMetricLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    textAlign: "center",
    lineHeight: 13,
  },
});

const bloomStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    padding: 32,
    alignItems: "center",
    overflow: "hidden",
  },
  flowerWrap: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  flowerEmoji: {
    fontSize: 48,
  },
  flowerGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(244,114,182,0.25)",
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.compassionPink,
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.champagne,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  inputWrap: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    marginBottom: 16,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.whiteAlpha90,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
    textAlign: "right",
    marginTop: 8,
  },
  submitBtn: {
    width: "100%",
    borderRadius: 100,
    overflow: "hidden",
    marginBottom: 12,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 100,
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.forestDeep,
  },
  rewardPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  rewardPreviewText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.balanceAmber,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha30,
  },
  successWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  successTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.champagne,
  },
  successSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    marginBottom: 8,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  rewardBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.balanceAmber,
  },
});
