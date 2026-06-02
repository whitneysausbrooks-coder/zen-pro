import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";
const SYMBOLS = ["💎", "👑", "🌟", "🌿", "🌸", "🍀"];
const PAYOUTS: Record<string, number> = {
  "💎": 15, "👑": 12, "🌟": 8, "🌿": 5, "🌸": 4, "🍀": 6,
};

const TIERS = [
  { label: "10 NE", cost: 10, color: Colors.mindfulBlue },
  { label: "30 NE", cost: 30, color: Colors.balanceAmber },
  { label: "50 NE", cost: 50, color: Colors.gold },
];

export interface DiamondResult {
  won: boolean;
  multiplier: number;
  label: string;
}

interface Props {
  neuralEnergy: number;
  onSpinStart: (cost: number) => boolean;
  onResult: (result: DiamondResult, cost: number) => void;
  /** Pro members play for free — bypasses the Neural Energy cost gate. */
  unlimited?: boolean;
}

type DiamondOutcome = "mega" | "four" | "three" | "pair" | "miss";

function rollDiamondOutcome(): DiamondOutcome {
  const r = Math.random() * 100;
  if (r < 1) return "mega";
  if (r < 3) return "four";
  if (r < 9) return "three";
  if (r < 20) return "pair";
  return "miss";
}

function generateDiamondReels(outcome: DiamondOutcome): number[] {
  switch (outcome) {
    case "mega": {
      const s = Math.floor(Math.random() * SYMBOLS.length);
      return [s, s, s, s, s];
    }
    case "four": {
      const s = Math.floor(Math.random() * SYMBOLS.length);
      let diff: number;
      do { diff = Math.floor(Math.random() * SYMBOLS.length); } while (diff === s);
      const pos = Math.floor(Math.random() * 5);
      const reels = [s, s, s, s, s];
      reels[pos] = diff;
      return reels;
    }
    case "three": {
      const s = Math.floor(Math.random() * SYMBOLS.length);
      const start = Math.floor(Math.random() * 3);
      const reels: number[] = [];
      for (let i = 0; i < 5; i++) {
        if (i >= start && i < start + 3) {
          reels.push(s);
        } else {
          let r: number;
          do { r = Math.floor(Math.random() * SYMBOLS.length); } while (r === s);
          reels.push(r);
        }
      }
      return reels;
    }
    case "pair": {
      const s = Math.floor(Math.random() * SYMBOLS.length);
      const start = Math.floor(Math.random() * 4);
      const reels: number[] = [];
      const used = new Set<number>([s]);
      for (let i = 0; i < 5; i++) {
        if (i === start || i === start + 1) {
          reels.push(s);
        } else {
          let r: number;
          let attempts = 0;
          do {
            r = Math.floor(Math.random() * SYMBOLS.length);
            attempts++;
          } while (used.has(r) && attempts < 50);
          reels.push(r);
          used.add(r);
        }
      }
      return reels;
    }
    case "miss":
    default: {
      const available = Array.from({ length: SYMBOLS.length }, (_, i) => i);
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      return available.slice(0, 5);
    }
  }
}

function evaluateDiamondReels(finals: number[]): {
  outcome: DiamondOutcome;
  matchSym: string;
  matchCount: number;
} {
  const syms = finals.map((i) => SYMBOLS[i]);
  const counts: Record<string, number> = {};
  syms.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });

  let maxCount = 0;
  let maxSym = "";
  Object.entries(counts).forEach(([sym, count]) => {
    if (count > maxCount) { maxCount = count; maxSym = sym; }
  });

  if (maxCount >= 5) return { outcome: "mega", matchSym: maxSym, matchCount: 5 };
  if (maxCount === 4) return { outcome: "four", matchSym: maxSym, matchCount: 4 };
  if (maxCount === 3) return { outcome: "three", matchSym: maxSym, matchCount: 3 };

  let consecutive = 1;
  let maxConsecutive = 1;
  let consSym = syms[0];
  for (let i = 1; i < syms.length; i++) {
    if (syms[i] === syms[i - 1]) {
      consecutive++;
      if (consecutive > maxConsecutive) {
        maxConsecutive = consecutive;
        consSym = syms[i];
      }
    } else {
      consecutive = 1;
    }
  }
  if (maxConsecutive >= 2) return { outcome: "pair", matchSym: consSym, matchCount: 2 };

  return { outcome: "miss", matchSym: "", matchCount: 0 };
}

export function DiamondJackpotSlot({ neuralEnergy, onSpinStart, onResult, unlimited }: Props) {
  const [displayReels, setDisplayReels] = useState([0, 1, 2, 3, 4]);
  const [phase, setPhase] = useState<"ready" | "spinning" | "result">("ready");
  const [selectedTier, setSelectedTier] = useState(0);
  const [resultText, setResultText] = useState("");
  const [payout, setPayout] = useState(0);
  const resultAnim = useRef(new Animated.Value(0)).current;
  const bounceAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const intervalRefs = useRef<(ReturnType<typeof setInterval> | null)[]>([null, null, null, null, null]);
  const tickRefs = useRef([0, 0, 0, 0, 0]);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      intervalRefs.current.forEach((id) => { if (id) clearInterval(id); });
      timeoutRefs.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  const handleSpin = useCallback(() => {
    if (phase !== "ready") return;

    const tier = TIERS[selectedTier];
    const canSpin = onSpinStart(tier.cost);
    if (!canSpin) return;

    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("spinning");
    setResultText("");
    setPayout(0);

    const outcome = rollDiamondOutcome();
    const finals = generateDiamondReels(outcome);

    let stopped = 0;
    finals.forEach((_, i) => {
      tickRefs.current[i] = 0;
      intervalRefs.current[i] = setInterval(() => {
        tickRefs.current[i]++;
        setDisplayReels((prev) => {
          const next = [...prev];
          next[i] = tickRefs.current[i] % SYMBOLS.length;
          return next;
        });
      }, 60);

      const tid = setTimeout(() => {
        if (intervalRefs.current[i]) clearInterval(intervalRefs.current[i]!);
        intervalRefs.current[i] = null;
        if (!mountedRef.current) return;
        setDisplayReels((prev) => {
          const next = [...prev];
          next[i] = finals[i];
          return next;
        });
        Animated.sequence([
          Animated.timing(bounceAnims[i], { toValue: -6, duration: 40, useNativeDriver: nd }),
          Animated.spring(bounceAnims[i], { toValue: 0, friction: 5, useNativeDriver: nd }),
        ]).start();

        stopped++;
        if (stopped >= 5) {
          evaluateAndReport(finals, tier.cost);
        }
      }, 500 + i * 350);
      timeoutRefs.current.push(tid);
    });
  }, [phase, selectedTier, onSpinStart]);

  const evaluateAndReport = useCallback((finals: number[], cost: number) => {
    const { outcome: actualOutcome, matchSym, matchCount } = evaluateDiamondReels(finals);

    let resultMultiplier = 0;
    let payoutAmount = 0;

    switch (actualOutcome) {
      case "mega": {
        resultMultiplier = (PAYOUTS[matchSym] || 5) * 3;
        payoutAmount = Math.round(cost * resultMultiplier);
        setResultText(`💎 Compassion Milestone! ${matchSym}×5 — +${payoutAmount} NE!`);
        break;
      }
      case "four": {
        resultMultiplier = (PAYOUTS[matchSym] || 5) * 1.5;
        payoutAmount = Math.round(cost * resultMultiplier);
        setResultText(`🔥 Four Match! ${matchSym}×4 — +${payoutAmount} NE!`);
        break;
      }
      case "three": {
        resultMultiplier = (PAYOUTS[matchSym] || 3) * 0.5;
        payoutAmount = Math.round(cost * resultMultiplier);
        setResultText(`Three ${matchSym}! — +${payoutAmount} NE`);
        break;
      }
      case "pair": {
        resultMultiplier = 0.3;
        payoutAmount = Math.round(cost * resultMultiplier);
        setResultText(`Small match — +${payoutAmount} NE`);
        break;
      }
      default: {
        setResultText("No match — play again!");
        break;
      }
    }

    setPayout(payoutAmount);
    setPhase("result");
    Animated.timing(resultAnim, { toValue: 1, duration: 400, useNativeDriver: nd }).start();

    onResult(
      {
        won: resultMultiplier > 0,
        multiplier: resultMultiplier,
        label:
          actualOutcome === "mega"
            ? `Mega ${matchSym}×5`
            : actualOutcome === "four"
            ? `Four ${matchSym}×4`
            : actualOutcome === "three"
            ? `Three ${matchSym}×3`
            : actualOutcome === "pair"
            ? `Pair ${matchSym}×2`
            : "No match",
      },
      cost
    );

    if (nd) {
      if (resultMultiplier > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const rid = setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.timing(resultAnim, { toValue: 0, duration: 300, useNativeDriver: nd }).start(() => {
        if (!mountedRef.current) return;
        setPhase("ready");
        resultAnim.setValue(0);
      });
    }, 2500);
    timeoutRefs.current.push(rid);
  }, [selectedTier, onResult]);

  const canAfford = !!unlimited || neuralEnergy >= TIERS[selectedTier].cost;

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#0d0d2b", "#1a1a3e", "#0d0d2b"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.header}>
        <Text style={s.badge}>5-MATCH PREMIUM</Text>
        <Text style={s.title}>Diamond Reward</Text>
        <Text style={s.sub}>5 symbols, bigger matches, bigger rewards</Text>
      </View>

      <View style={s.reelsRow} accessibilityLabel={`Symbols showing ${displayReels.map((r) => SYMBOLS[r]).join(", ")}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Animated.View
            key={i}
            style={[s.reel, { transform: [{ translateY: bounceAnims[i] }] }]}
            accessibilityLabel={`Symbol ${i + 1}: ${SYMBOLS[displayReels[i]]}`}
          >
            <Text style={s.reelSymbol}>{SYMBOLS[displayReels[i]]}</Text>
          </Animated.View>
        ))}
      </View>

      <View style={s.tierRow}>
        {TIERS.map((tier, i) => (
          <Pressable
            key={tier.label}
            onPress={() => { if (phase === "ready") setSelectedTier(i); }}
            style={[
              s.tierBtn,
              selectedTier === i && { borderColor: tier.color, backgroundColor: `${tier.color}15` },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Play ${tier.label}`}
          >
            <Text style={[s.tierLabel, selectedTier === i && { color: tier.color }]}>
              {tier.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.payoutRow}>
        <View style={s.payoutItem}>
          <Text style={s.payoutEmoji}>💎×5</Text>
          <Text style={s.payoutVal}>sym×3 mult</Text>
        </View>
        <View style={s.payoutDivider} />
        <View style={s.payoutItem}>
          <Text style={s.payoutEmoji}>×4</Text>
          <Text style={s.payoutVal}>sym×1.5 mult</Text>
        </View>
        <View style={s.payoutDivider} />
        <View style={s.payoutItem}>
          <Text style={s.payoutEmoji}>×3</Text>
          <Text style={s.payoutVal}>sym×0.5 mult</Text>
        </View>
      </View>

      <View style={s.oddsRow}>
        <Text style={s.oddsLabel}>How it works:</Text>
        <Text style={s.oddsText}>Match 3 or more symbols to earn Neural Energy</Text>
      </View>

      <Pressable
        onPress={handleSpin}
        disabled={phase !== "ready" || !canAfford}
        style={({ pressed }) => [pressed && { opacity: 0.9 }, (phase !== "ready" || !canAfford) && { opacity: 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel={
          !canAfford
            ? "Insufficient Neural Energy"
            : `Play for ${TIERS[selectedTier].label}`
        }
      >
        <LinearGradient
          colors={phase === "ready" && canAfford ? ["#4fc3f7", "#0288d1", "#01579b"] : ["#555", "#444", "#333"]}
          style={s.spinGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={s.spinText}>
            {phase === "spinning"
              ? "PLAYING..."
              : !canAfford
              ? "NEED MORE NE"
              : `PLAY — ${TIERS[selectedTier].label}`}
          </Text>
        </LinearGradient>
      </Pressable>

      {resultText !== "" && (
        <Animated.View style={[s.resultBanner, { opacity: resultAnim }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Text style={[s.resultText, payout > 0 ? { color: Colors.gold } : { color: Colors.whiteAlpha50 }]}>
            {resultText}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(79,195,247,0.3)",
    padding: 20,
    gap: 14,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  badge: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#4fc3f7",
    letterSpacing: 3,
    backgroundColor: "rgba(79,195,247,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    overflow: "hidden",
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
    marginTop: 4,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  reelsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  reel: {
    width: 58,
    height: 68,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1.5,
    borderColor: "rgba(79,195,247,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  reelSymbol: {
    fontSize: 32,
  },
  tierRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  tierBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 2,
  },
  tierLabel: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.whiteAlpha60,
  },
  payoutRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  payoutItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  payoutEmoji: {
    fontSize: 14,
    color: Colors.gold,
    fontFamily: "Inter_700Bold",
  },
  payoutVal: {
    fontFamily: "Inter_400Regular",
    fontSize: 8,
    color: Colors.whiteAlpha30,
    textAlign: "center",
  },
  payoutDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.glassBorderLight,
  },
  oddsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  oddsLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    letterSpacing: 1,
  },
  oddsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.whiteAlpha30,
  },
  spinGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 100,
    alignItems: "center",
  },
  spinText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: "#fff",
    letterSpacing: 2,
  },
  resultBanner: {
    alignItems: "center",
    paddingVertical: 8,
  },
  resultText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    textAlign: "center",
  },
});
