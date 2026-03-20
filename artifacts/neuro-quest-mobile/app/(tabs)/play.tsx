import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { SlotMachine } from "@/components/SlotMachine";
import Colors from "@/constants/colors";

const { width: screenW } = Dimensions.get("window");
const nd = Platform.OS !== "web";
const SPINS_KEY = "nq_spins_left";
const WINS_KEY = "nq_total_wins";
const DONATIONS_KEY = "nq_micro_donations";

type ResultState = "idle" | "win" | "lose";

const MICRO_DONATION_AMOUNTS = [0.10, 0.25, 0.50, 0.15, 0.30, 0.20];
const DONATION_CAUSES = [
  "Clean Water", "End Hunger", "Education", "Mental Health", "Climate Action", "Ocean Cleanup",
];

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const [spinsLeft, setSpinsLeft] = useState(5);
  const [totalWins, setTotalWins] = useState(0);
  const [totalDonated, setTotalDonated] = useState(0);
  const [lastDonation, setLastDonation] = useState<{ amount: number; cause: string } | null>(null);
  const [result, setResult] = useState<ResultState>("idle");
  const resultAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.8)).current;
  const donationPulse = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await AsyncStorage.getItem(SPINS_KEY);
        const w = await AsyncStorage.getItem(WINS_KEY);
        const d = await AsyncStorage.getItem(DONATIONS_KEY);
        if (s) setSpinsLeft(parseInt(s));
        if (w) setTotalWins(parseInt(w));
        if (d) setTotalDonated(parseFloat(d));
      } catch {}
    };
    load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
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

  const triggerMicroDonation = useCallback(
    async (isWin: boolean) => {
      const amount = isWin
        ? MICRO_DONATION_AMOUNTS[Math.floor(Math.random() * MICRO_DONATION_AMOUNTS.length)] * 2
        : MICRO_DONATION_AMOUNTS[Math.floor(Math.random() * MICRO_DONATION_AMOUNTS.length)];
      const cause = DONATION_CAUSES[Math.floor(Math.random() * DONATION_CAUSES.length)];
      const rounded = Math.round(amount * 100) / 100;
      setTotalDonated((prev) => {
        const newTotal = Math.round((prev + rounded) * 100) / 100;
        AsyncStorage.setItem(DONATIONS_KEY, String(newTotal));
        return newTotal;
      });
      setLastDonation({ amount: rounded, cause });

      Animated.sequence([
        Animated.timing(donationPulse, { toValue: 1, duration: 300, useNativeDriver: nd }),
        Animated.timing(donationPulse, { toValue: 0, duration: 2000, useNativeDriver: nd }),
      ]).start();
    },
    []
  );

  const handleSpin = useCallback(
    async (isWin: boolean) => {
      const newSpins = Math.max(0, spinsLeft - 1);
      setSpinsLeft(newSpins);
      await AsyncStorage.setItem(SPINS_KEY, String(newSpins));

      triggerMicroDonation(isWin);

      if (isWin) {
        const newWins = totalWins + 1;
        setTotalWins(newWins);
        await AsyncStorage.setItem(WINS_KEY, String(newWins));
        showResult("win");
      } else {
        showResult("lose");
      }
    },
    [spinsLeft, totalWins, showResult, triggerMicroDonation]
  );

  const handleBuySpins = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newSpins = spinsLeft + 10;
    setSpinsLeft(newSpins);
    await AsyncStorage.setItem(SPINS_KEY, String(newSpins));
  }, [spinsLeft]);

  const handleShareWin = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message:
          `I just hit ${totalWins} jackpot${totalWins !== 1 ? "s" : ""} on NeuroQuest! 🎰✨\n\n` +
          "Every spin trains my brain AND funds real charities.\n" +
          "30% of all revenue donated to verified partners worldwide.\n\n" +
          "Join the Compassion Casino → neuroquest.app",
        title: "NeuroQuest Jackpot!",
      });
    } catch {}
  }, [totalWins]);

  const resultConfig =
    result === "win"
      ? { title: "Jackpot!", subtitle: "A donation goes to your chosen cause", color: Colors.gold }
      : result === "lose"
      ? { title: "Keep Going", subtitle: "Every spin strengthens your mind", color: Colors.whiteAlpha50 }
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.celestialBlue, Colors.black, Colors.black]}
        locations={[0, 0.12, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.nebulaGlow} />
      <View style={styles.starA} />
      <View style={styles.starB} />
      <View style={styles.starC} />
      <View style={styles.starD} />
      <View style={styles.starE} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>COMPASSION CASINO</Text>
          <Text style={styles.title}>Spin for Good</Text>
          <Text style={styles.subtitle}>For entertainment & mindfulness only</Text>
        </View>

        {result !== "idle" && resultConfig && (
          <Animated.View
            style={[
              styles.resultToast,
              {
                opacity: resultAnim,
                transform: [{ scale: resultScale }],
              },
            ]}
          >
            <GlassCard style={styles.resultCard} borderColor={resultConfig.color} elevated>
              <Text style={[styles.resultTitle, { color: resultConfig.color }]}>
                {resultConfig.title}
              </Text>
              <Text style={styles.resultSub}>{resultConfig.subtitle}</Text>
            </GlassCard>
          </Animated.View>
        )}

        <SlotMachine onSpin={handleSpin} spinsLeft={spinsLeft} />

        <GlassCard style={styles.winsCard} borderColor={Colors.glassBorderLight}>
          <View style={styles.winsRow}>
            <View style={styles.winsLeft}>
              <Ionicons name="trophy" size={18} color={Colors.gold} />
              <Text style={styles.winsText}>
                <Text style={styles.winsNum}>{totalWins}</Text>{" "}
                jackpot{totalWins !== 1 ? "s" : ""} triggered
              </Text>
            </View>
            <View style={styles.donationTag}>
              <View style={styles.donationDot} />
              <Text style={styles.donationText}>Real donations</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.microDonationCard} borderColor="rgba(74,222,128,0.2)" elevated>
          <LinearGradient
            colors={["rgba(74,222,128,0.08)", "rgba(96,165,250,0.04)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.microEyebrow}>MICRO-DONATIONS</Text>
          <Text style={styles.microSubtitle}>Every spin generates a real charitable donation</Text>

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
                <Text style={styles.microStatLabel}>Jackpots</Text>
              </View>
              <View style={styles.microStatDivider} />
              <View style={styles.microStatItem}>
                <Text style={styles.microStatVal}>30%</Text>
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
                ${lastDonation.amount.toFixed(2)} donated to {lastDonation.cause}
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

        {spinsLeft === 0 && (
          <GlassCard style={styles.noSpinsCard} borderColor={Colors.goldAlpha20}>
            <LinearGradient
              colors={[Colors.goldAlpha05, "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.noSpinsTitle}>No Spins Remaining</Text>
            <Text style={styles.noSpinsBody}>
              Get more spins to keep training your mind and funding global causes.
            </Text>
            <Pressable onPress={handleBuySpins} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                style={styles.buyButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add-circle" size={18} color={Colors.forestDeep} />
                <Text style={styles.buyButtonText}>Get 10 Extra Spins — $2.99</Text>
              </LinearGradient>
            </Pressable>
          </GlassCard>
        )}

        <Pressable onPress={handleShareWin} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
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
            { icon: "🌍", text: "Match 3 symbols to trigger a real charitable donation" },
            { icon: "❤️", text: "30% of all revenue is donated to verified charity partners" },
          ].map((item, i) => (
            <View key={i} style={styles.howRow}>
              <Text style={styles.howIcon}>{item.icon}</Text>
              <Text style={styles.howText}>{item.text}</Text>
            </View>
          ))}
        </GlassCard>
      </ScrollView>
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
  resultToast: {
    position: "absolute",
    top: 120,
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
  winsCard: {
    padding: 16,
  },
  winsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  winsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  winsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha60,
  },
  winsNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  donationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.goldAlpha05,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.goldAlpha10,
  },
  donationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  donationText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.goldRose,
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
});
