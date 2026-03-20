import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { SlotMachine } from "@/components/SlotMachine";
import Colors from "@/constants/colors";

const SPINS_KEY = "nq_spins_left";
const WINS_KEY = "nq_total_wins";

type ResultState = "idle" | "win" | "near" | "lose";

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const [spinsLeft, setSpinsLeft] = useState(5);
  const [totalWins, setTotalWins] = useState(0);
  const [result, setResult] = useState<ResultState>("idle");
  const resultAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const load = async () => {
      try {
        const s = await AsyncStorage.getItem(SPINS_KEY);
        const w = await AsyncStorage.getItem(WINS_KEY);
        if (s) setSpinsLeft(parseInt(s));
        if (w) setTotalWins(parseInt(w));
      } catch {}
    };
    load();
  }, []);

  const showResult = useCallback((state: ResultState) => {
    setResult(state);
    const nd = Platform.OS !== "web";
    Animated.parallel([
      Animated.timing(resultAnim, { toValue: 1, duration: 300, useNativeDriver: nd }),
      Animated.spring(resultScale, { toValue: 1, useNativeDriver: nd, friction: 7 }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(resultAnim, { toValue: 0, duration: 400, useNativeDriver: nd }),
        Animated.timing(resultScale, { toValue: 0.8, duration: 400, useNativeDriver: nd }),
      ]).start(() => setResult("idle"));
    }, 2800);
  }, []);

  const handleSpin = useCallback(
    async (isWin: boolean) => {
      const newSpins = Math.max(0, spinsLeft - 1);
      setSpinsLeft(newSpins);
      await AsyncStorage.setItem(SPINS_KEY, String(newSpins));

      if (isWin) {
        const newWins = totalWins + 1;
        setTotalWins(newWins);
        await AsyncStorage.setItem(WINS_KEY, String(newWins));
        showResult("win");
      } else {
        showResult("lose");
      }
    },
    [spinsLeft, totalWins, showResult]
  );

  const handleBuySpins = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const newSpins = spinsLeft + 10;
    setSpinsLeft(newSpins);
    await AsyncStorage.setItem(SPINS_KEY, String(newSpins));
  }, [spinsLeft]);

  const getResultConfig = () => {
    switch (result) {
      case "win":
        return {
          emoji: "🎉",
          title: "Jackpot!",
          subtitle: "A donation goes to your cause",
          color: Colors.gold,
        };
      case "lose":
        return {
          emoji: "🌿",
          title: "Keep Training",
          subtitle: "Every spin strengthens your mind",
          color: Colors.whiteAlpha50,
        };
      default:
        return null;
    }
  };

  const resultConfig = getResultConfig();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.forestDeep, Colors.black, Colors.black]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Compassion Casino</Text>
          <Text style={styles.subtitle}>For entertainment & mindfulness only</Text>
        </View>

        {/* Result Toast */}
        {result !== "idle" && resultConfig && (
          <Animated.View
            style={[
              styles.resultToast,
              {
                opacity: resultAnim,
                transform: [{ scale: resultScale }],
                borderColor: resultConfig.color,
              },
            ]}
          >
            <GlassCard style={styles.resultCard} borderColor={resultConfig.color}>
              <Text style={styles.resultEmoji}>{resultConfig.emoji}</Text>
              <Text style={[styles.resultTitle, { color: resultConfig.color }]}>
                {resultConfig.title}
              </Text>
              <Text style={styles.resultSub}>{resultConfig.subtitle}</Text>
            </GlassCard>
          </Animated.View>
        )}

        {/* Slot Machine */}
        <SlotMachine onSpin={handleSpin} spinsLeft={spinsLeft} />

        {/* Win Count */}
        <GlassCard style={styles.winsCard}>
          <Ionicons name="trophy" size={20} color={Colors.gold} />
          <Text style={styles.winsText}>
            <Text style={styles.winsNum}>{totalWins}</Text> jackpot{totalWins !== 1 ? "s" : ""} triggered
          </Text>
        </GlassCard>

        {/* Buy More Spins */}
        {spinsLeft === 0 && (
          <View style={styles.noSpinsContainer}>
            <Text style={styles.noSpinsTitle}>No Spins Remaining</Text>
            <Text style={styles.noSpinsBody}>
              Get more spins to keep training your mind and feeding the world.
            </Text>
            <Pressable onPress={handleBuySpins} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                style={styles.buyButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add-circle" size={20} color={Colors.forestDeep} />
                <Text style={styles.buyButtonText}>Get 10 Extra Spins — $2.99</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* How It Works */}
        <GlassCard style={styles.howCard}>
          <Text style={styles.howTitle}>How It Works</Text>
          {[
            { icon: "🧠", text: "Each spin trains your neuroplasticity through pattern recognition" },
            { icon: "🌍", text: "Match 3 symbols to trigger a real charitable donation" },
            { icon: "❤️", text: "100% for entertainment — no prizes or gambling of any kind" },
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
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    color: Colors.white,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha50,
    marginTop: 4,
    textAlign: "center",
  },
  resultToast: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    zIndex: 100,
    borderRadius: 20,
  },
  resultCard: {
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  resultEmoji: {
    fontSize: 40,
  },
  resultTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
  },
  resultSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha80,
    textAlign: "center",
  },
  winsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  winsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha80,
  },
  winsNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  noSpinsContainer: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
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
  },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 100,
    marginTop: 8,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  buyButtonText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.forestDeep,
  },
  howCard: {
    padding: 20,
    gap: 12,
  },
  howTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
    marginBottom: 4,
  },
  howRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  howIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  howText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha80,
    lineHeight: 20,
  },
});
