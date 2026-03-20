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
const SYMBOLS = ["💎", "👑", "💰", "🃏", "🎲", "🍀"];
const PAYOUTS: Record<string, number> = {
  "💎": 15, "👑": 12, "💰": 8, "🃏": 5, "🎲": 4, "🍀": 6,
};

const TIERS = [
  { label: "1¢", cents: 1, multiplier: 1, color: Colors.mindfulBlue },
  { label: "3¢", cents: 3, multiplier: 3, color: Colors.balanceAmber },
  { label: "5¢", cents: 5, multiplier: 5, color: Colors.gold },
];

interface Props {
  onResult: (won: boolean, donationCents: number) => void;
}

export function DiamondJackpotSlot({ onResult }: Props) {
  const [reels, setReels] = useState([0, 1, 2, 3, 4]);
  const [displayReels, setDisplayReels] = useState([0, 1, 2, 3, 4]);
  const [phase, setPhase] = useState<"bet" | "spinning" | "result">("bet");
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
    if (phase !== "bet") return;
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("spinning");
    setResultText("");
    setPayout(0);

    const jackpotChance = Math.random();
    let finals: number[];
    if (jackpotChance < 0.05) {
      const sym = Math.floor(Math.random() * SYMBOLS.length);
      finals = [sym, sym, sym, sym, sym];
    } else if (jackpotChance < 0.15) {
      const sym = Math.floor(Math.random() * SYMBOLS.length);
      const pos = Math.floor(Math.random() * 3);
      finals = [0, 1, 2, 3, 4].map((i) =>
        i >= pos && i < pos + 3 ? sym : Math.floor(Math.random() * SYMBOLS.length)
      );
    } else {
      finals = [0, 1, 2, 3, 4].map(() => Math.floor(Math.random() * SYMBOLS.length));
    }
    setReels(finals);

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
          evaluateResult(finals);
        }
      }, 500 + i * 350);
      timeoutRefs.current.push(tid);
    });
  }, [phase, selectedTier]);

  const evaluateResult = useCallback((finals: number[]) => {
    const tier = TIERS[selectedTier];
    const syms = finals.map((i) => SYMBOLS[i]);

    const counts: Record<string, number> = {};
    syms.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });

    let maxCount = 0;
    let maxSym = "";
    Object.entries(counts).forEach(([sym, count]) => {
      if (count > maxCount) { maxCount = count; maxSym = sym; }
    });

    let donationCents = 0;
    if (maxCount === 5) {
      donationCents = (PAYOUTS[maxSym] || 5) * tier.multiplier * 3;
      setResultText(`💎 MEGA JACKPOT! ${maxSym}×5 — ${donationCents}¢ donated!`);
    } else if (maxCount === 4) {
      donationCents = (PAYOUTS[maxSym] || 5) * tier.multiplier * 2;
      setResultText(`🔥 Four of a Kind! ${maxSym}×4 — ${donationCents}¢ donated!`);
    } else if (maxCount === 3) {
      donationCents = Math.ceil((PAYOUTS[maxSym] || 3) * tier.multiplier * 0.8);
      setResultText(`Three ${maxSym}! — ${donationCents}¢ donated!`);
    } else {
      let consecutive = 1;
      let maxConsecutive = 1;
      for (let i = 1; i < syms.length; i++) {
        if (syms[i] === syms[i - 1]) { consecutive++; maxConsecutive = Math.max(maxConsecutive, consecutive); }
        else { consecutive = 1; }
      }
      if (maxConsecutive >= 2) {
        donationCents = Math.ceil(tier.cents * 0.5) || 1;
        setResultText(`Small match — ${donationCents}¢ donated!`);
      } else {
        setResultText("No match — spin again!");
      }
    }

    setPayout(donationCents);
    setPhase("result");
    Animated.timing(resultAnim, { toValue: 1, duration: 400, useNativeDriver: nd }).start();
    onResult(donationCents > 0, donationCents);

    if (nd) {
      if (donationCents > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const rid = setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.timing(resultAnim, { toValue: 0, duration: 300, useNativeDriver: nd }).start(() => {
        if (!mountedRef.current) return;
        setPhase("bet");
        resultAnim.setValue(0);
      });
    }, 2500);
    timeoutRefs.current.push(rid);
  }, [selectedTier, onResult]);

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#0d0d2b", "#1a1a3e", "#0d0d2b"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.header}>
        <Text style={s.badge}>5-REEL PREMIUM</Text>
        <Text style={s.title}>Diamond Jackpot</Text>
        <Text style={s.sub}>5 reels, bigger matches, bigger donations</Text>
      </View>

      <View style={s.reelsRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Animated.View
            key={i}
            style={[s.reel, { transform: [{ translateY: bounceAnims[i] }] }]}
          >
            <Text style={s.reelSymbol}>{SYMBOLS[displayReels[i]]}</Text>
          </Animated.View>
        ))}
      </View>

      <View style={s.tierRow}>
        {TIERS.map((tier, i) => (
          <Pressable
            key={tier.label}
            onPress={() => { if (phase === "bet") setSelectedTier(i); }}
            style={[
              s.tierBtn,
              selectedTier === i && { borderColor: tier.color, backgroundColor: `${tier.color}15` },
            ]}
          >
            <Text style={[s.tierLabel, selectedTier === i && { color: tier.color }]}>
              {tier.label}
            </Text>
            <Text style={s.tierMult}>{tier.multiplier}× donation</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.payoutRow}>
        <View style={s.payoutItem}>
          <Text style={s.payoutEmoji}>💎×5</Text>
          <Text style={s.payoutVal}>Mega Donation</Text>
        </View>
        <View style={s.payoutDivider} />
        <View style={s.payoutItem}>
          <Text style={s.payoutEmoji}>×4</Text>
          <Text style={s.payoutVal}>Big Donation</Text>
        </View>
        <View style={s.payoutDivider} />
        <View style={s.payoutItem}>
          <Text style={s.payoutEmoji}>×3</Text>
          <Text style={s.payoutVal}>Donation Match</Text>
        </View>
      </View>

      <Pressable
        onPress={handleSpin}
        disabled={phase !== "bet"}
        style={({ pressed }) => [pressed && { opacity: 0.9 }, phase !== "bet" && { opacity: 0.5 }]}
      >
        <LinearGradient
          colors={phase === "bet" ? ["#4fc3f7", "#0288d1", "#01579b"] : ["#555", "#444", "#333"]}
          style={s.spinGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={s.spinText}>
            {phase === "spinning" ? "SPINNING..." : `SPIN — donate ${TIERS[selectedTier].label}`}
          </Text>
        </LinearGradient>
      </Pressable>

      {resultText !== "" && (
        <Animated.View style={[s.resultBanner, { opacity: resultAnim }]}>
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
    fontSize: 18,
    color: Colors.whiteAlpha60,
  },
  tierMult: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.whiteAlpha30,
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
