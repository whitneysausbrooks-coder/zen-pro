import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { SlotMachine, WheelResult } from "@/components/SlotMachine";
import { HoldAndWinSlot, HoldWinResult } from "@/components/HoldAndWinSlot";
import { DiamondJackpotSlot, DiamondResult } from "@/components/DiamondJackpotSlot";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import Colors from "@/constants/colors";
import { useRouter } from "expo-router";
import { useProAccess } from "@/contexts/ProAccessContext";

const { width: screenW } = Dimensions.get("window");
const nd = Platform.OS !== "web";

const NE_KEY = "nq_neural_energy";
const SPINS_KEY = "nq_spins_left";
const WINS_KEY = "nq_total_wins";
const PLAY_SESSION_KEY = "nq_play_session";
const TOTAL_SPINS_USED_KEY = "nq_total_spins_used";
const LAST_SPIN_REFILL_KEY = "nq_last_spin_refill";

const WHEEL_SPIN_COST = 10;
const DAILY_FREE_SPINS = 5;
const REFILL_INTERVAL_MS = 24 * 60 * 60 * 1000;

type ResultState = "idle" | "win" | "lose";

// Compassion Reels: hitting a Compassion Milestone triggers a REAL,
// business-funded micro-donation routed to a nonprofit via every.org. The
// player never pays — NeuroQuest funds it from a capped monthly giving budget
// enforced server-side. The amounts and impact shown here are the real ledger,
// not a simulation.
interface CompassionImpact {
  this_month_cents: number;
  monthly_budget_cents: number;
  monthly_remaining_cents: number;
  all_time_cents: number;
  supporters_this_month: number;
  milestone_cents: number;
  nonprofit: string;
}

function getApiBase(): string {
  return Platform.OS === "web" ? "" : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
}

async function getPlaySessionId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(PLAY_SESSION_KEY);
    if (!id) {
      id = `play_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(PLAY_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `play_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function prettyNonprofit(slug: string | undefined): string {
  if (!slug || slug === "feeding-america") return "Feeding America";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatCents(cents: number | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [neuralEnergy, setNeuralEnergy] = useState(100);
  const [spinsLeft, setSpinsLeft] = useState(5);
  const [totalWins, setTotalWins] = useState(0);
  const [impact, setImpact] = useState<CompassionImpact | null>(null);
  const [lastMilestone, setLastMilestone] = useState<{ donatedCents: number; capped: boolean } | null>(null);
  const [result, setResult] = useState<ResultState>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const resultAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.8)).current;
  const donationPulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const neRef = useRef(neuralEnergy);
  const spinLockRef = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationAmount, setCelebrationAmount] = useState(0);

  // Pro members get unlimited daily plays and play premium games for free.
  // Mirror into a ref so the spin callbacks read the latest value without
  // forcing the games to re-render mid-spin.
  const { isPro } = useProAccess();
  const isProRef = useRef(isPro);

  useEffect(() => {
    neRef.current = neuralEnergy;
  }, [neuralEnergy]);

  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ne, s, w, lastRefill] = await Promise.all([
          AsyncStorage.getItem(NE_KEY),
          AsyncStorage.getItem(SPINS_KEY),
          AsyncStorage.getItem(WINS_KEY),
          AsyncStorage.getItem(LAST_SPIN_REFILL_KEY),
        ]);
        if (ne !== null) {
          const parsed = parseInt(ne, 10);
          setNeuralEnergy(Number.isNaN(parsed) ? 100 : parsed);
        }

        let currentSpins = 5;
        if (s !== null) {
          const parsed = parseInt(s, 10);
          if (!Number.isNaN(parsed)) currentSpins = parsed;
        }

        const lastRefillMs = lastRefill ? parseInt(lastRefill, 10) : 0;
        const now = Date.now();
        if (!Number.isFinite(lastRefillMs) || now - lastRefillMs >= REFILL_INTERVAL_MS) {
          const refilled = Math.max(currentSpins, DAILY_FREE_SPINS);
          currentSpins = refilled;
          await AsyncStorage.setItem(SPINS_KEY, String(refilled));
          await AsyncStorage.setItem(LAST_SPIN_REFILL_KEY, String(now));
        }
        setSpinsLeft(currentSpins);

        if (w !== null) {
          const parsed = parseInt(w, 10);
          if (!Number.isNaN(parsed)) setTotalWins(parsed);
        }
      } catch {}
      setIsLoading(false);
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: nd }).start();
    };
    load();
    fetchImpact();

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const persistNE = useCallback((value: number) => {
    AsyncStorage.setItem(NE_KEY, String(value));
  }, []);

  const showResult = useCallback((state: ResultState) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setResult(state);
    Animated.parallel([
      Animated.timing(resultAnim, { toValue: 1, duration: 300, useNativeDriver: nd }),
      Animated.spring(resultScale, { toValue: 1, useNativeDriver: nd, friction: 7 }),
    ]).start();

    toastTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(resultAnim, { toValue: 0, duration: 400, useNativeDriver: nd }),
        Animated.timing(resultScale, { toValue: 0.8, duration: 400, useNativeDriver: nd }),
      ]).start(() => setResult("idle"));
      toastTimer.current = null;
    }, 2800);
  }, []);

  const fetchImpact = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/donations/compassion-impact`);
      if (!res.ok) return;
      const data = await res.json();
      setImpact({
        this_month_cents: data.this_month_cents ?? 0,
        monthly_budget_cents: data.monthly_budget_cents ?? 0,
        monthly_remaining_cents: data.monthly_remaining_cents ?? 0,
        all_time_cents: data.all_time_cents ?? 0,
        supporters_this_month: data.supporters_this_month ?? 0,
        milestone_cents: data.milestone_cents ?? 0,
        nonprofit: data.nonprofit ?? "feeding-america",
      });
    } catch {}
  }, []);

  // A Compassion Milestone triggers a REAL, business-funded micro-donation on the
  // server (capped monthly). The player never pays. We optimistically reflect the
  // returned ledger totals so the impact card stays in sync with the real cap.
  const recordMilestone = useCallback(
    async (kind: string) => {
      Animated.sequence([
        Animated.timing(donationPulse, { toValue: 1, duration: 300, useNativeDriver: nd }),
        Animated.timing(donationPulse, { toValue: 0, duration: 2000, useNativeDriver: nd }),
      ]).start();
      try {
        const sessionId = await getPlaySessionId();
        const res = await fetch(`${getApiBase()}/api/donations/compassion-milestone`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, milestone_kind: kind }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setLastMilestone({ donatedCents: data.donated_cents ?? 0, capped: !!data.capped });
        setImpact((prev) => ({
          this_month_cents: data.monthly_total_cents ?? prev?.this_month_cents ?? 0,
          monthly_budget_cents: data.monthly_budget_cents ?? prev?.monthly_budget_cents ?? 0,
          monthly_remaining_cents: data.monthly_remaining_cents ?? prev?.monthly_remaining_cents ?? 0,
          all_time_cents: (prev?.all_time_cents ?? 0) + (data.donated_cents ?? 0),
          supporters_this_month: prev?.supporters_this_month ?? 0,
          milestone_cents: prev?.milestone_cents ?? (data.donated_cents || 0),
          nonprofit: data.nonprofit ?? prev?.nonprofit ?? "feeding-america",
        }));
        // Re-sync with the authoritative server ledger (supporters, all-time,
        // settled) so the optimistic update above can't drift out of truth.
        fetchImpact();
      } catch {}
    },
    [fetchImpact]
  );

  const incrementSpinCount = useCallback(async () => {
    const prev = parseInt((await AsyncStorage.getItem(TOTAL_SPINS_USED_KEY)) || "0", 10) || 0;
    await AsyncStorage.setItem(TOTAL_SPINS_USED_KEY, String(prev + 1));
  }, []);

  const handleWheelSpin = useCallback(
    async (wheelResult: WheelResult) => {
      await incrementSpinCount();

      // Pro members have unlimited plays — never decrement their counter.
      if (!isProRef.current) {
        const newSpins = Math.max(0, spinsLeft - 1);
        setSpinsLeft(newSpins);
        await AsyncStorage.setItem(SPINS_KEY, String(newSpins));
      }

      if (wheelResult.isWin && !wheelResult.isBoost) {
        const payout = Math.round(WHEEL_SPIN_COST * wheelResult.multiplier);
        setNeuralEnergy((prev) => {
          const next = prev + payout;
          persistNE(next);
          return next;
        });
        recordMilestone("reels_match");
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(payout);
        setShowCelebration(true);
      } else if (wheelResult.isBoost) {
        recordMilestone("reels_boost");
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(WHEEL_SPIN_COST * 2);
        setShowCelebration(true);
      } else {
        showResult("lose");
      }
    },
    [spinsLeft, showResult, recordMilestone, incrementSpinCount, persistNE]
  );

  const handlePremiumSpinStart = useCallback(
    (cost: number): boolean => {
      if (spinLockRef.current) return false;

      // Pro members play all premium games for free — no NE check, no deduction.
      if (isProRef.current) {
        spinLockRef.current = true;
        setTimeout(() => {
          if (spinLockRef.current) spinLockRef.current = false;
        }, 15000);
        return true;
      }

      const currentNE = neRef.current;
      if (currentNE < cost) {
        Alert.alert(
          "Not enough Neural Energy",
          `You need ${cost} NE but have ${currentNE} NE. Earn more through brain training — daily plays also refill automatically every 24 hours.`,
          [{ text: "OK" }]
        );
        return false;
      }

      spinLockRef.current = true;

      const nextNE = currentNE - cost;
      neRef.current = nextNE;
      setNeuralEnergy(nextNE);
      persistNE(nextNE);

      setTimeout(() => {
        if (spinLockRef.current) {
          spinLockRef.current = false;
        }
      }, 15000);

      return true;
    },
    [persistNE]
  );

  const handleHoldWinResult = useCallback(
    async (gameResult: HoldWinResult, cost: number) => {
      spinLockRef.current = false;
      await incrementSpinCount();

      if (gameResult.won) {
        const payout = Math.round(cost * gameResult.multiplier);
        const nextNE = neRef.current + payout;
        neRef.current = nextNE;
        setNeuralEnergy(nextNE);
        persistNE(nextNE);
        recordMilestone("hold_and_win");
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(payout);
        setShowCelebration(true);
      } else {
        showResult("lose");
      }
    },
    [showResult, recordMilestone, incrementSpinCount, persistNE]
  );

  const handleDiamondResult = useCallback(
    async (gameResult: DiamondResult, cost: number) => {
      spinLockRef.current = false;
      await incrementSpinCount();

      if (gameResult.won) {
        const payout = Math.round(cost * gameResult.multiplier);
        const nextNE = neRef.current + payout;
        neRef.current = nextNE;
        setNeuralEnergy(nextNE);
        persistNE(nextNE);
        recordMilestone("diamond");
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(payout);
        setShowCelebration(true);
      } else {
        showResult("lose");
      }
    },
    [showResult, recordMilestone, incrementSpinCount, persistNE]
  );

  const handleEarnEnergy = useCallback(() => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Route to brain training, where Neural Energy is earned through play.
    router.push("/(tabs)/train");
  }, [router]);

  const handleShareWin = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg =
      `I've completed ${totalWins} good deed${totalWins !== 1 ? "s" : ""} on NeuroQuest! 🧠\n\n` +
      "Every round trains my brain through neuroplasticity exercises.\n" +
      "Compassion-focused brain training. → neuroquest.app";
    if (Platform.OS === "web") {
      try {
        await Clipboard.setStringAsync(msg);
        Alert.alert("Copied!", "Share text copied to clipboard.");
      } catch {}
    } else {
      try {
        await Share.share({ message: msg, title: "My NeuroQuest Good Deeds!" });
      } catch {}
    }
  }, [totalWins]);

  const resultConfig =
    result === "win"
      ? { title: "Milestone reached", subtitle: "Neural Energy added to your balance", color: Colors.gold }
      : result === "lose"
      ? { title: "Keep going", subtitle: "Every round strengthens your mind", color: Colors.whiteAlpha50 }
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.celestialBlue, Colors.black, Colors.black]}
        locations={[0, 0.12, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.nebulaGlow} />
      <View pointerEvents="none" style={styles.starA} />
      <View pointerEvents="none" style={styles.starB} />
      <View pointerEvents="none" style={styles.starC} />
      <View pointerEvents="none" style={styles.starD} />
      <View pointerEvents="none" style={styles.starE} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: isLoading ? 0 : fadeIn }}>
        <View style={styles.header} accessibilityRole="header">
          <Text style={styles.eyebrow}>COMPASSION REELS</Text>
          <Text style={styles.title}>Play for Good</Text>
          <Text style={styles.subtitle}>Hit a Compassion Milestone — we fund a real donation, never you</Text>
        </View>

        <GlassCard style={styles.balanceCard} borderColor={Colors.goldAlpha20} elevated>
          <LinearGradient
            colors={["rgba(212,175,55,0.08)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Neural Energy</Text>
              <Text style={styles.balanceValue}>{neuralEnergy.toLocaleString()}</Text>
              <Text style={styles.balanceSub}>NE Balance</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Plays Left</Text>
              <Text style={[styles.balanceValue, { color: Colors.empathyGreen }]}>{isPro ? "∞" : spinsLeft}</Text>
              <Text style={styles.balanceSub}>Compassion Reels</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Good Deeds</Text>
              <Text style={[styles.balanceValue, { color: Colors.neuralPurple }]}>{totalWins}</Text>
              <Text style={styles.balanceSub}>All Games</Text>
            </View>
          </View>
        </GlassCard>

        <SlotMachine onSpin={handleWheelSpin} spinsLeft={spinsLeft} unlimited={isPro} />

        <View style={styles.premiumDivider}>
          <View style={styles.premiumLine} />
          <Text style={styles.premiumLabel}>PREMIUM GAMES</Text>
          <View style={styles.premiumLine} />
        </View>

        <View style={styles.premiumInfo}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.whiteAlpha30} />
          <Text style={styles.premiumInfoText}>
            {isPro
              ? "Zen Pro: all premium games are free to play. Rewards = base cost × Multiplier."
              : "Premium games cost Neural Energy. Rewards = NE spent × Multiplier. Balance deducted before play."}
          </Text>
        </View>

        <HoldAndWinSlot
          neuralEnergy={neuralEnergy}
          onSpinStart={handlePremiumSpinStart}
          onResult={handleHoldWinResult}
          unlimited={isPro}
        />
        <DiamondJackpotSlot
          neuralEnergy={neuralEnergy}
          onSpinStart={handlePremiumSpinStart}
          onResult={handleDiamondResult}
          unlimited={isPro}
        />

        <GlassCard style={styles.microDonationCard} borderColor="rgba(74,222,128,0.2)" elevated>
          <LinearGradient
            colors={["rgba(74,222,128,0.08)", "rgba(96,165,250,0.04)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.microEyebrow}>COMPASSION IMPACT</Text>
          <Text style={styles.microSubtitle}>
            Real, business-funded donations to {prettyNonprofit(impact?.nonprofit)} — funded by NeuroQuest, never you
          </Text>

          <View style={styles.microStats}>
            <View style={styles.microStatMain}>
              <Text style={styles.microTotalLabel}>Funded This Month</Text>
              <Animated.Text
                style={[
                  styles.microTotal,
                  {
                    transform: [
                      {
                        scale: donationPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {formatCents(impact?.this_month_cents)}
              </Animated.Text>
            </View>
            <View style={styles.microStatsRow}>
              <View style={styles.microStatItem}>
                <Text style={styles.microStatVal}>{formatCents(impact?.all_time_cents)}</Text>
                <Text style={styles.microStatLabel}>All-Time</Text>
              </View>
              <View style={styles.microStatDivider} />
              <View style={styles.microStatItem}>
                <Text style={styles.microStatVal}>{formatCents(impact?.monthly_budget_cents)}</Text>
                <Text style={styles.microStatLabel}>Monthly Cap</Text>
              </View>
              <View style={styles.microStatDivider} />
              <View style={styles.microStatItem}>
                <Text style={styles.microStatVal}>{impact?.supporters_this_month ?? 0}</Text>
                <Text style={styles.microStatLabel}>Players</Text>
              </View>
            </View>
          </View>

          {lastMilestone && (
            <Animated.View
              style={[
                styles.lastDonation,
                {
                  opacity: donationPulse.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0.6, 1, 0.6],
                  }),
                },
              ]}
            >
              <View style={styles.lastDonationDot} />
              <Text style={styles.lastDonationText}>
                {lastMilestone.donatedCents > 0
                  ? `Compassion Milestone! We just funded ${formatCents(lastMilestone.donatedCents)} to ${prettyNonprofit(impact?.nonprofit)}`
                  : `This month's giving goal is reached — milestones still celebrate, giving resumes next month`}
              </Text>
            </Animated.View>
          )}

          <View style={styles.microBudget}>
            <View style={styles.microBudgetHead}>
              <Text style={styles.microBudgetTitle}>This Month's Giving Budget</Text>
              <Text style={styles.microBudgetPct}>
                {formatCents(impact?.this_month_cents)} / {formatCents(impact?.monthly_budget_cents)}
              </Text>
            </View>
            <View style={styles.microCauseBar}>
              <View
                style={[
                  styles.microCauseFill,
                  {
                    width: `${
                      impact && impact.monthly_budget_cents > 0
                        ? Math.min(100, Math.round((impact.this_month_cents / impact.monthly_budget_cents) * 100))
                        : 0
                    }%`,
                    backgroundColor: Colors.empathyGreen,
                  },
                ]}
              />
            </View>
            <Text style={styles.microBudgetNote}>
              {impact && impact.monthly_remaining_cents <= 0
                ? "Monthly giving goal reached — thank you for playing. Giving resets next month."
                : `${formatCents(impact?.monthly_remaining_cents)} of business-funded giving left this month`}
            </Text>
          </View>
        </GlassCard>

        {(!isPro && spinsLeft === 0 && neuralEnergy < 10) && (
          <GlassCard style={styles.noSpinsCard} borderColor={Colors.goldAlpha20}>
            <LinearGradient
              colors={[Colors.goldAlpha05, "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.noSpinsTitle}>Low on Energy</Text>
            <Text style={styles.noSpinsBody}>
              Earn more Neural Energy through brain training. Daily plays refill automatically every 24 hours.
            </Text>
            <Pressable onPress={handleEarnEnergy} style={({ pressed }) => [pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Go to brain training to earn Neural Energy">
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                style={styles.buyButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="fitness" size={18} color={Colors.forestDeep} />
                <Text style={styles.buyButtonText}>Train to Earn Energy</Text>
              </LinearGradient>
            </Pressable>
          </GlassCard>
        )}

        <Pressable onPress={handleShareWin} style={({ pressed }) => [pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="Share your good deeds with friends">
          <GlassCard style={styles.shareCard} borderColor="rgba(167,139,250,0.2)">
            <LinearGradient
              colors={["rgba(167,139,250,0.08)", "rgba(244,114,182,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Feather name="share-2" size={20} color={Colors.neuralPurple} />
            <View style={styles.shareTextWrap}>
              <Text style={styles.shareTitle}>Share Your Good Deeds</Text>
              <Text style={styles.shareSub}>Challenge friends to play for good</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.whiteAlpha30} />
          </GlassCard>
        </Pressable>

        <GlassCard style={styles.howCard} borderColor={Colors.glassBorderLight}>
          <Text style={styles.howEyebrow}>HOW IT WORKS</Text>
          {[
            { icon: "🧠", text: "Each round trains neuroplasticity through pattern recognition" },
            { icon: "⚡", text: "Neural Energy is deducted before each premium round — no double claims" },
            { icon: "❤️", text: "Hit a Compassion Milestone and NeuroQuest funds a real donation to a verified nonprofit — our money, never yours" },
            { icon: "🛡️", text: "Giving is capped by a fixed monthly budget; when it's reached, milestones still celebrate and giving resumes next month" },
          ].map((item, i) => (
            <View key={i} style={styles.howRow}>
              <Text style={styles.howIcon}>{item.icon}</Text>
              <Text style={styles.howText}>{item.text}</Text>
            </View>
          ))}
        </GlassCard>
        </Animated.View>
      </ScrollView>

      <CelebrationOverlay
        visible={showCelebration}
        winAmount={celebrationAmount}
        onFinish={() => setShowCelebration(false)}
      />

      {result !== "idle" && resultConfig && (
        <Animated.View
          style={[
            styles.resultToast,
            {
              opacity: resultAnim,
              transform: [{ scale: resultScale }],
              top: insets.top + 20,
            },
          ]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          pointerEvents="none"
        >
          <GlassCard style={styles.resultCard} borderColor={resultConfig.color} elevated>
            <Text style={[styles.resultTitle, { color: resultConfig.color }]}>
              {resultConfig.title}
            </Text>
            <Text style={styles.resultSub}>{resultConfig.subtitle}</Text>
          </GlassCard>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nebulaGlow: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.cosmicGlow,
    zIndex: 0,
  },
  starA: { position: "absolute", top: 60, left: 30, width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.starlight, opacity: 0.6 },
  starB: { position: "absolute", top: 100, right: 50, width: 2, height: 2, borderRadius: 1, backgroundColor: Colors.champagne, opacity: 0.5 },
  starC: { position: "absolute", top: 180, left: 120, width: 2, height: 2, borderRadius: 1, backgroundColor: Colors.whiteAlpha60, opacity: 0.4 },
  starD: { position: "absolute", top: 50, right: 100, width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.starlight, opacity: 0.3 },
  starE: { position: "absolute", top: 140, left: 60, width: 1.5, height: 1.5, borderRadius: 0.75, backgroundColor: Colors.champagne, opacity: 0.7 },
  scroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  header: {
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: Colors.white,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    marginTop: 2,
    textAlign: "center",
  },
  balanceCard: {
    padding: 20,
    overflow: "hidden",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  balanceItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  balanceLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  balanceValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.gold,
  },
  balanceSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
  },
  balanceDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.whiteAlpha10,
  },
  resultToast: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 100,
  },
  resultCard: {
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  resultTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
  },
  resultSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    textAlign: "center",
  },
  premiumDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 8,
  },
  premiumLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.goldAlpha15,
  },
  premiumLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 3,
  },
  premiumInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  premiumInfoText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    lineHeight: 16,
  },
  noSpinsCard: {
    padding: 28,
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  noSpinsTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  noSpinsBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    lineHeight: 20,
  },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 100,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  buyButtonText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: Colors.forestDeep,
  },
  shareCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 14,
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
  howCard: {
    padding: 24,
    gap: 16,
  },
  howEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
  },
  howRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  howIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  howText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    lineHeight: 21,
  },
  microDonationCard: {
    padding: 24,
    gap: 14,
    overflow: "hidden",
  },
  microEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.empathyGreen,
    letterSpacing: 3,
  },
  microSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
  },
  microStats: {
    gap: 14,
  },
  microStatMain: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 16,
  },
  microTotalLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  microTotal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    color: Colors.empathyGreen,
  },
  microStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  microStatItem: {
    alignItems: "center",
    gap: 2,
  },
  microStatVal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.gold,
  },
  microStatLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
  },
  microStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.whiteAlpha10,
  },
  lastDonation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(74,222,128,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.15)",
  },
  lastDonationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.empathyGreen,
  },
  lastDonationText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.empathyGreen,
    flex: 1,
  },
  microBudget: {
    gap: 8,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 12,
    padding: 14,
  },
  microBudgetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  microBudgetTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.whiteAlpha60,
  },
  microBudgetPct: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.empathyGreen,
  },
  microBudgetNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha50,
    marginTop: 2,
  },
  microCauseBar: {
    width: "100%",
    height: 6,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 3,
    overflow: "hidden",
  },
  microCauseFill: {
    height: "100%",
    borderRadius: 3,
    opacity: 0.85,
  },
});
