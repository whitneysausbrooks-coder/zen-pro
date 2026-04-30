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
import { initIAP, purchaseProduct, fetchEntitlements } from "@/lib/iap";

const { width: screenW } = Dimensions.get("window");
const nd = Platform.OS !== "web";

const NE_KEY = "nq_neural_energy";
const SPINS_KEY = "nq_spins_left";
const WINS_KEY = "nq_total_wins";
const DONATIONS_KEY = "nq_micro_donations";
const TOTAL_SPINS_USED_KEY = "nq_total_spins_used";
const LAST_SPIN_REFILL_KEY = "nq_last_spin_refill";

const WHEEL_SPIN_COST = 10;
const DONATION_RATE = 0.30;
const DAILY_FREE_SPINS = 5;
const REFILL_INTERVAL_MS = 24 * 60 * 60 * 1000;

type ResultState = "idle" | "win" | "lose";

const SPIN_PACKS = [
  { id: "pack_5", spins: 5, price: "$0.99", priceNum: 0.99, label: "Starter", productId: "pro.neuroquestzen.app.spins.5" },
  { id: "pack_15", spins: 15, price: "$1.99", priceNum: 1.99, label: "Popular", badge: "POPULAR", productId: "pro.neuroquestzen.app.spins.15" },
  { id: "pack_50", spins: 50, price: "$4.99", priceNum: 4.99, label: "Pro", badge: "BEST VALUE", productId: "pro.neuroquestzen.app.spins.50" },
];

const DONATION_CAUSES = [
  "Clean Water", "End Hunger", "Education", "Mental Health", "Climate Action", "Ocean Cleanup",
];

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [neuralEnergy, setNeuralEnergy] = useState(100);
  const [spinsLeft, setSpinsLeft] = useState(5);
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);
  const [totalWins, setTotalWins] = useState(0);
  const [totalDonated, setTotalDonated] = useState(0);
  const [lastDonation, setLastDonation] = useState<{ amount: number; cause: string } | null>(null);
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

  useEffect(() => {
    neRef.current = neuralEnergy;
  }, [neuralEnergy]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ne, s, w, d, lastRefill] = await Promise.all([
          AsyncStorage.getItem(NE_KEY),
          AsyncStorage.getItem(SPINS_KEY),
          AsyncStorage.getItem(WINS_KEY),
          AsyncStorage.getItem(DONATIONS_KEY),
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
        if (d !== null) {
          const parsed = parseFloat(d);
          if (!Number.isNaN(parsed)) setTotalDonated(parsed);
        }
      } catch {}
      setIsLoading(false);
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: nd }).start();
    };
    load();

    if (Platform.OS === "ios") {
      initIAP().catch(() => {});
    }

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

  const trackDonation = useCallback(
    (amount: number) => {
      const donationAmount = Math.round(amount * DONATION_RATE * 100) / 100;
      if (donationAmount <= 0) return;
      const cause = DONATION_CAUSES[Math.floor(Math.random() * DONATION_CAUSES.length)];
      setTotalDonated((prev) => {
        const newTotal = Math.round((prev + donationAmount) * 100) / 100;
        AsyncStorage.setItem(DONATIONS_KEY, String(newTotal));
        return newTotal;
      });
      setLastDonation({ amount: donationAmount, cause });

      Animated.sequence([
        Animated.timing(donationPulse, { toValue: 1, duration: 300, useNativeDriver: nd }),
        Animated.timing(donationPulse, { toValue: 0, duration: 2000, useNativeDriver: nd }),
      ]).start();
    },
    []
  );

  const incrementSpinCount = useCallback(async () => {
    const prev = parseInt((await AsyncStorage.getItem(TOTAL_SPINS_USED_KEY)) || "0", 10) || 0;
    await AsyncStorage.setItem(TOTAL_SPINS_USED_KEY, String(prev + 1));
  }, []);

  const handleWheelSpin = useCallback(
    async (wheelResult: WheelResult) => {
      await incrementSpinCount();

      const newSpins = Math.max(0, spinsLeft - 1);
      setSpinsLeft(newSpins);
      await AsyncStorage.setItem(SPINS_KEY, String(newSpins));

      if (wheelResult.isWin && !wheelResult.isBoost) {
        const payout = Math.round(WHEEL_SPIN_COST * wheelResult.multiplier);
        setNeuralEnergy((prev) => {
          const next = prev + payout;
          persistNE(next);
          return next;
        });
        trackDonation(payout);
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(payout);
        setShowCelebration(true);
      } else if (wheelResult.isBoost) {
        trackDonation(WHEEL_SPIN_COST * 2);
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(WHEEL_SPIN_COST * 2);
        setShowCelebration(true);
      } else {
        trackDonation(WHEEL_SPIN_COST * 0.1);
        showResult("lose");
      }
    },
    [spinsLeft, showResult, trackDonation, incrementSpinCount, persistNE]
  );

  const handlePremiumSpinStart = useCallback(
    (cost: number): boolean => {
      if (spinLockRef.current) return false;

      const currentNE = neRef.current;
      if (currentNE < cost) {
        Alert.alert(
          "Insufficient Neural Energy",
          `You need ${cost} NE but have ${currentNE} NE. Earn more through brain training or purchase additional energy.`,
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
        trackDonation(payout);
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(payout);
        setShowCelebration(true);
      } else {
        trackDonation(cost * 0.1);
        showResult("lose");
      }
    },
    [showResult, trackDonation, incrementSpinCount, persistNE]
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
        trackDonation(payout);
        setTotalWins((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(WINS_KEY, String(next));
          return next;
        });
        showResult("win");
        setCelebrationAmount(payout);
        setShowCelebration(true);
      } else {
        trackDonation(cost * 0.1);
        showResult("lose");
      }
    },
    [showResult, trackDonation, incrementSpinCount, persistNE]
  );

  const creditSpins = useCallback(async (amount: number) => {
    const current = parseInt((await AsyncStorage.getItem(SPINS_KEY)) || "0", 10) || 0;
    const next = current + amount;
    setSpinsLeft(next);
    await AsyncStorage.setItem(SPINS_KEY, String(next));
  }, []);

  // T003 — restored real IAP path. Server-side `requireUserOrDevice` already
  // accepts our HMAC device-signed calls, and `purchaseProduct` flows through
  // `signedFetch` so receipt validation succeeds without Clerk on mobile.
  const reconcileSpinsWithServer = useCallback(async (): Promise<boolean> => {
    try {
      const ents = await fetchEntitlements();
      if (typeof ents?.spin_balance === "number") {
        setSpinsLeft(ents.spin_balance);
        await AsyncStorage.setItem(SPINS_KEY, String(ents.spin_balance));
        return true;
      }
    } catch {}
    return false;
  }, []);

  const runSpinPackPurchase = useCallback(async (pack: typeof SPIN_PACKS[0]) => {
    if (Platform.OS !== "ios") {
      Alert.alert("iOS only", "In-app purchases are currently available on iOS.");
      return;
    }
    try {
      setPurchasingPack(pack.id);
      const result = await purchaseProduct(pack.productId);
      if (!result.duplicate) {
        await creditSpins(pack.spins);
      }
      // Server is the source of truth post-receipt-validation.
      await reconcileSpinsWithServer();
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Purchase Successful",
        result.duplicate
          ? "This transaction has already been applied to your account."
          : `${pack.spins} spins added to your account. Thank you for supporting mental health charities!`,
        [{ text: "OK" }]
      );
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("cancel") || msg.includes("E_USER_CANCELLED")) return;
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Purchase Failed", msg || "Something went wrong. Please try again.");
    } finally {
      setPurchasingPack(null);
    }
  }, [creditSpins, reconcileSpinsWithServer]);

  const handleBuySpinPack = useCallback((pack: typeof SPIN_PACKS[0]) => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `Buy ${pack.spins} spins`,
      `${pack.price} via secure App Store purchase.\n\nA portion of every purchase is donated to mental health charities. Thank you for your support!`,
      [
        { text: "Cancel", style: "cancel" },
        { text: `Buy ${pack.price}`, style: "default", onPress: () => runSpinPackPurchase(pack) },
      ]
    );
  }, [runSpinPackPurchase]);

  const handleBuySpins = useCallback(() => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Route to /shop where the full pack picker lives.
    router.push("/(tabs)/shop");
  }, [router]);

  const handleShareWin = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg =
      `I've earned ${totalWins} win${totalWins !== 1 ? "s" : ""} on NeuroQuest! 🧠\n\n` +
      "Every interaction trains my brain through neuroplasticity exercises.\n" +
      "Compassion-focused brain training. → neuroquest.app";
    if (Platform.OS === "web") {
      try {
        await Clipboard.setStringAsync(msg);
        Alert.alert("Copied!", "Share text copied to clipboard.");
      } catch {}
    } else {
      try {
        await Share.share({ message: msg, title: "My NeuroQuest Wins!" });
      } catch {}
    }
  }, [totalWins]);

  const resultConfig =
    result === "win"
      ? { title: "You Won!", subtitle: "Neural Energy credited to your balance", color: Colors.gold }
      : result === "lose"
      ? { title: "Keep Going", subtitle: "Every spin strengthens your mind", color: Colors.whiteAlpha50 }
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
          <Text style={styles.eyebrow}>COMPASSION WHEEL</Text>
          <Text style={styles.title}>Spin for Good</Text>
          <Text style={styles.subtitle}>For entertainment & mindfulness only</Text>
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
              <Text style={styles.balanceLabel}>Free Spins</Text>
              <Text style={[styles.balanceValue, { color: Colors.empathyGreen }]}>{spinsLeft}</Text>
              <Text style={styles.balanceSub}>Lucky Wheel</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Total Wins</Text>
              <Text style={[styles.balanceValue, { color: Colors.neuralPurple }]}>{totalWins}</Text>
              <Text style={styles.balanceSub}>All Games</Text>
            </View>
          </View>
        </GlassCard>

        <SlotMachine onSpin={handleWheelSpin} spinsLeft={spinsLeft} />

        <GlassCard style={styles.spinPackCard} borderColor={Colors.goldAlpha20}>
          <LinearGradient
            colors={[Colors.goldAlpha08, Colors.goldAlpha05, "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <Text style={styles.spinPackEyebrow}>EXTRA SPINS</Text>
          <Text style={styles.spinPackSubtitle}>Bonus spins that never expire</Text>
          <View style={styles.spinPackRow}>
            {SPIN_PACKS.map((pack) => (
              <Pressable
                key={pack.id}
                onPress={() => handleBuySpinPack(pack)}
                style={({ pressed }) => [styles.spinPackItem, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${pack.spins} spins for ${pack.price}`}
              >
                {"badge" in pack && pack.badge && (
                  <View style={styles.spinPackBadge}>
                    <Text style={styles.spinPackBadgeText}>{pack.badge}</Text>
                  </View>
                )}
                <Text style={styles.spinPackCount}>{pack.spins}</Text>
                <Text style={styles.spinPackLabel}>spins</Text>
                <LinearGradient
                  colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                  style={styles.spinPackPriceBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.spinPackPrice}>{pack.price}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
          <View style={styles.spinPackDonation}>
            <View style={styles.spinPackDonationDot} />
            <Text style={styles.spinPackDonationText}>30% of every purchase supports charity</Text>
          </View>
        </GlassCard>

        <View style={styles.premiumDivider}>
          <View style={styles.premiumLine} />
          <Text style={styles.premiumLabel}>PREMIUM GAMES</Text>
          <View style={styles.premiumLine} />
        </View>

        <View style={styles.premiumInfo}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.whiteAlpha30} />
          <Text style={styles.premiumInfoText}>
            Premium games cost Neural Energy. Rewards = Stake × Multiplier. Balance deducted before spin.
          </Text>
        </View>

        <HoldAndWinSlot
          neuralEnergy={neuralEnergy}
          onSpinStart={handlePremiumSpinStart}
          onResult={handleHoldWinResult}
        />
        <DiamondJackpotSlot
          neuralEnergy={neuralEnergy}
          onSpinStart={handlePremiumSpinStart}
          onResult={handleDiamondResult}
        />

        <GlassCard style={styles.microDonationCard} borderColor="rgba(74,222,128,0.2)" elevated>
          <LinearGradient
            colors={["rgba(74,222,128,0.08)", "rgba(96,165,250,0.04)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.microEyebrow}>IMPACT TRACKER</Text>
          <Text style={styles.microSubtitle}>{Math.round(DONATION_RATE * 100)}% of all gameplay value goes to charity</Text>

          <View style={styles.microStats}>
            <View style={styles.microStatMain}>
              <Text style={styles.microTotalLabel}>Your Total Impact</Text>
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
                ${totalDonated.toFixed(2)}
              </Animated.Text>
            </View>
            <View style={styles.microStatsRow}>
              <View style={styles.microStatItem}>
                <Text style={styles.microStatVal}>{totalWins}</Text>
                <Text style={styles.microStatLabel}>Wins</Text>
              </View>
              <View style={styles.microStatDivider} />
              <View style={styles.microStatItem}>
                <Text style={styles.microStatVal}>{Math.round(DONATION_RATE * 100)}%</Text>
                <Text style={styles.microStatLabel}>To Charity</Text>
              </View>
              <View style={styles.microStatDivider} />
              <View style={styles.microStatItem}>
                <Text style={styles.microStatVal}>6</Text>
                <Text style={styles.microStatLabel}>Causes</Text>
              </View>
            </View>
          </View>

          {lastDonation && (
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
                ${lastDonation.amount.toFixed(2)} impact tracked for {lastDonation.cause}
              </Text>
            </Animated.View>
          )}

          <View style={styles.microBreakdown}>
            <Text style={styles.microBreakdownTitle}>Where Your Donations Go</Text>
            {DONATION_CAUSES.map((cause, i) => {
              const basePct = Math.floor((1 / DONATION_CAUSES.length) * 100);
              const pct = i < (100 - basePct * DONATION_CAUSES.length) ? basePct + 1 : basePct;
              return (
                <View key={cause} style={styles.microCauseRow}>
                  <View style={[styles.microCauseDot, { backgroundColor: [Colors.mindfulBlue, Colors.balanceAmber, Colors.empathyGreen, Colors.neuralPurple, Colors.compassionPink, Colors.gold][i] }]} />
                  <Text style={styles.microCauseName}>{cause}</Text>
                  <View style={styles.microCauseBar}>
                    <View style={[styles.microCauseFill, { width: `${pct}%`, backgroundColor: [Colors.mindfulBlue, Colors.balanceAmber, Colors.empathyGreen, Colors.neuralPurple, Colors.compassionPink, Colors.gold][i] }]} />
                  </View>
                  <Text style={styles.microCausePct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {(spinsLeft === 0 && neuralEnergy < 10) && (
          <GlassCard style={styles.noSpinsCard} borderColor={Colors.goldAlpha20}>
            <LinearGradient
              colors={[Colors.goldAlpha05, "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.noSpinsTitle}>Low on Energy</Text>
            <Text style={styles.noSpinsBody}>
              Earn more Neural Energy through brain training, or purchase additional energy to keep playing.
            </Text>
            <Pressable onPress={handleBuySpins} style={({ pressed }) => [pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Get more Neural Energy">
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                style={styles.buyButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add-circle" size={18} color={Colors.forestDeep} />
                <Text style={styles.buyButtonText}>Get Neural Energy</Text>
              </LinearGradient>
            </Pressable>
          </GlassCard>
        )}

        <Pressable onPress={handleShareWin} style={({ pressed }) => [pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="Share your wins with friends">
          <GlassCard style={styles.shareCard} borderColor="rgba(167,139,250,0.2)">
            <LinearGradient
              colors={["rgba(167,139,250,0.08)", "rgba(244,114,182,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Feather name="share-2" size={20} color={Colors.neuralPurple} />
            <View style={styles.shareTextWrap}>
              <Text style={styles.shareTitle}>Share Your Wins</Text>
              <Text style={styles.shareSub}>Challenge friends to spin for good</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.whiteAlpha30} />
          </GlassCard>
        </Pressable>

        <GlassCard style={styles.howCard} borderColor={Colors.glassBorderLight}>
          <Text style={styles.howEyebrow}>HOW IT WORKS</Text>
          {[
            { icon: "🧠", text: "Each spin trains neuroplasticity through pattern recognition" },
            { icon: "⚡", text: "Neural Energy is deducted before each premium spin — no double claims" },
            { icon: "❤️", text: `${Math.round(DONATION_RATE * 100)}% of all gameplay value goes to verified charity partners` },
            { icon: "📊", text: "Win rates are transparent: 70–80% miss, 11–20% partial, 1–11% top reward" },
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
  microBreakdown: {
    gap: 8,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 12,
    padding: 14,
  },
  microBreakdownTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.whiteAlpha60,
    marginBottom: 4,
  },
  microCauseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  microCauseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  microCauseName: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha50,
    width: 90,
  },
  microCauseBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 2,
    overflow: "hidden",
  },
  microCauseFill: {
    height: "100%",
    borderRadius: 2,
    opacity: 0.7,
  },
  microCausePct: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.whiteAlpha30,
    width: 28,
    textAlign: "right",
  },
  spinPackCard: {
    padding: 24,
    gap: 10,
    overflow: "hidden",
  },
  spinPackEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
  },
  spinPackSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
  },
  spinPackRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  spinPackItem: {
    flex: 1,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
    overflow: "hidden",
  },
  spinPackBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.goldAlpha15,
    paddingVertical: 3,
    alignItems: "center",
  },
  spinPackBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 7,
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  spinPackCount: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
    marginTop: 8,
  },
  spinPackLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  spinPackPriceBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 50,
  },
  spinPackPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.forestDeep,
  },
  spinPackDonation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  spinPackDonationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.empathyGreen,
  },
  spinPackDonationText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.empathyGreen,
    opacity: 0.8,
  },
});
