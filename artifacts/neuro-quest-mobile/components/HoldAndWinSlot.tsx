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
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";
const SYMBOLS = ["💎", "7️⃣", "🍒", "🔔", "⭐", "🎰"];
const MULTIPLIERS: Record<string, number> = {
  "💎": 10, "7️⃣": 7, "🍒": 3, "🔔": 5, "⭐": 4, "🎰": 8,
};

const TIERS = [
  { label: "1¢", cents: 1, multiplier: 1, color: Colors.mindfulBlue },
  { label: "3¢", cents: 3, multiplier: 3, color: Colors.balanceAmber },
  { label: "5¢", cents: 5, multiplier: 5, color: Colors.gold },
];

interface Props {
  onResult: (won: boolean, donationCents: number) => void;
}

export function HoldAndWinSlot({ onResult }: Props) {
  const [reels, setReels] = useState([0, 2, 4]);
  const [held, setHeld] = useState([false, false, false]);
  const [phase, setPhase] = useState<"bet" | "spinning" | "hold" | "respin" | "result">("bet");
  const [selectedTier, setSelectedTier] = useState(0);
  const [resultText, setResultText] = useState("");
  const [payout, setPayout] = useState(0);
  const [displayReels, setDisplayReels] = useState([0, 2, 4]);
  const spinAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const resultAnim = useRef(new Animated.Value(0)).current;
  const intervalRefs = useRef<(ReturnType<typeof setInterval> | null)[]>([null, null, null]);
  const tickRefs = useRef([0, 0, 0]);
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

  const spinReels = useCallback((heldMask: boolean[], finalIndices: number[], onDone: () => void) => {
    let stopped = 0;
    const total = heldMask.filter((h) => !h).length;
    if (total === 0) { onDone(); return; }

    heldMask.forEach((isHeld, i) => {
      if (isHeld) return;
      tickRefs.current[i] = 0;
      intervalRefs.current[i] = setInterval(() => {
        tickRefs.current[i]++;
        setDisplayReels((prev) => {
          const next = [...prev];
          next[i] = tickRefs.current[i] % SYMBOLS.length;
          return next;
        });
      }, 70);

      const tid = setTimeout(() => {
        if (intervalRefs.current[i]) clearInterval(intervalRefs.current[i]!);
        intervalRefs.current[i] = null;
        if (!mountedRef.current) return;
        setDisplayReels((prev) => {
          const next = [...prev];
          next[i] = finalIndices[i];
          return next;
        });
        Animated.sequence([
          Animated.timing(spinAnims[i], { toValue: -8, duration: 50, useNativeDriver: nd }),
          Animated.spring(spinAnims[i], { toValue: 0, friction: 5, useNativeDriver: nd }),
        ]).start();
        stopped++;
        if (stopped >= total) onDone();
      }, 600 + i * 400);
      timeoutRefs.current.push(tid);
    });
  }, []);

  const handleSpin = useCallback(() => {
    if (phase !== "bet") return;
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("spinning");
    setHeld([false, false, false]);
    setResultText("");
    setPayout(0);

    const r = [0, 1, 2].map(() => Math.floor(Math.random() * SYMBOLS.length));
    setReels(r);

    spinReels([false, false, false], r, () => {
      setPhase("hold");
    });
  }, [phase, spinReels]);

  const toggleHold = useCallback((idx: number) => {
    if (phase !== "hold") return;
    if (nd) Haptics.selectionAsync();
    setHeld((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }, [phase]);

  const handleRespin = useCallback(() => {
    if (phase !== "hold") return;
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("respin");

    const newReels = reels.map((r, i) =>
      held[i] ? r : Math.floor(Math.random() * SYMBOLS.length)
    );
    setReels(newReels);

    spinReels(held, newReels, () => {
      const tier = TIERS[selectedTier];
      const s1 = SYMBOLS[newReels[0]];
      const s2 = SYMBOLS[newReels[1]];
      const s3 = SYMBOLS[newReels[2]];

      let donationCents = 0;
      if (s1 === s2 && s2 === s3) {
        donationCents = (MULTIPLIERS[s1] || 3) * tier.cents;
        setResultText(`JACKPOT! ${s1}${s1}${s1} — ${donationCents}¢ donated!`);
      } else if (s1 === s2 || s2 === s3 || s1 === s3) {
        const matchSym = s1 === s2 ? s1 : s1 === s3 ? s1 : s2;
        donationCents = Math.ceil((MULTIPLIERS[matchSym] || 2) * tier.cents * 0.3);
        setResultText(`Pair! ${matchSym}${matchSym} — ${donationCents}¢ donated!`);
      } else {
        setResultText("No match — try again!");
      }

      setPayout(donationCents);
      setPhase("result");
      Animated.timing(resultAnim, { toValue: 1, duration: 400, useNativeDriver: nd }).start();
      onResult(donationCents > 0, donationCents);

      const rid = setTimeout(() => {
        if (!mountedRef.current) return;
        Animated.timing(resultAnim, { toValue: 0, duration: 300, useNativeDriver: nd }).start(() => {
          if (!mountedRef.current) return;
          setPhase("bet");
          resultAnim.setValue(0);
        });
      }, 2500);
      timeoutRefs.current.push(rid);
    });
  }, [phase, reels, held, selectedTier, spinReels, onResult]);

  const handleSkipHold = useCallback(() => {
    if (phase !== "hold") return;
    const noHold: boolean[] = [false, false, false];
    setHeld(noHold);

    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("respin");

    const newReels = reels.map(() => Math.floor(Math.random() * SYMBOLS.length));
    setReels(newReels);

    spinReels(noHold, newReels, () => {
      if (!mountedRef.current) return;
      const tier = TIERS[selectedTier];
      const s1 = SYMBOLS[newReels[0]];
      const s2 = SYMBOLS[newReels[1]];
      const s3 = SYMBOLS[newReels[2]];

      let donationCents = 0;
      if (s1 === s2 && s2 === s3) {
        donationCents = (MULTIPLIERS[s1] || 3) * tier.cents;
        setResultText(`JACKPOT! ${s1}${s1}${s1} — ${donationCents}¢ donated!`);
      } else if (s1 === s2 || s2 === s3 || s1 === s3) {
        const matchSym = s1 === s2 ? s1 : s1 === s3 ? s1 : s2;
        donationCents = Math.ceil((MULTIPLIERS[matchSym] || 2) * tier.cents * 0.3);
        setResultText(`Pair! ${matchSym}${matchSym} — ${donationCents}¢ donated!`);
      } else {
        setResultText("No match — try again!");
      }

      setPayout(donationCents);
      setPhase("result");
      Animated.timing(resultAnim, { toValue: 1, duration: 400, useNativeDriver: nd }).start();
      onResult(donationCents > 0, donationCents);

      const rid = setTimeout(() => {
        if (!mountedRef.current) return;
        Animated.timing(resultAnim, { toValue: 0, duration: 300, useNativeDriver: nd }).start(() => {
          if (!mountedRef.current) return;
          setPhase("bet");
          resultAnim.setValue(0);
        });
      }, 2500);
      timeoutRefs.current.push(rid);
    });
  }, [phase, reels, selectedTier, spinReels, onResult]);

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#1a0a2e", "#0d1f3c", "#1a0a2e"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.header}>
        <Text style={s.badge}>HOLD & WIN</Text>
        <Text style={s.title}>Vegas Hold</Text>
        <Text style={s.sub}>Hold your best reels, donate on match</Text>
      </View>

      <View style={s.reelsRow}>
        {[0, 1, 2].map((i) => (
          <Pressable
            key={i}
            onPress={() => toggleHold(i)}
            disabled={phase !== "hold"}
          >
            <Animated.View
              style={[
                s.reel,
                held[i] && s.reelHeld,
                { transform: [{ translateY: spinAnims[i] }] },
              ]}
            >
              <Text style={s.reelSymbol}>{SYMBOLS[displayReels[i]]}</Text>
              {held[i] && (
                <View style={s.holdBadge}>
                  <Text style={s.holdText}>HOLD</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>
        ))}
      </View>

      {phase === "hold" && (
        <View style={s.holdInstructions}>
          <Ionicons name="hand-left" size={16} color={Colors.balanceAmber} />
          <Text style={s.holdInstructionText}>Tap reels to hold, then respin</Text>
        </View>
      )}

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

      {phase === "hold" ? (
        <View style={s.holdActions}>
          <Pressable onPress={handleRespin} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
              style={s.spinGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={s.spinText}>RESPIN</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleSkipHold} style={s.skipBtn}>
            <Text style={s.skipText}>Respin All</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handleSpin}
          disabled={phase !== "bet"}
          style={({ pressed }) => [pressed && { opacity: 0.9 }, (phase !== "bet") && { opacity: 0.5 }]}
        >
          <LinearGradient
            colors={phase === "bet" ? ["#9b59b6", "#8e44ad", "#6c3483"] : ["#555", "#444", "#333"]}
            style={s.spinGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={s.spinText}>
              {phase === "spinning" || phase === "respin" ? "SPINNING..." : `SPIN — donate ${TIERS[selectedTier].label}`}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

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
    borderColor: "rgba(155,89,182,0.3)",
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
    color: "#9b59b6",
    letterSpacing: 3,
    backgroundColor: "rgba(155,89,182,0.15)",
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
    gap: 10,
  },
  reel: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 2,
    borderColor: "rgba(155,89,182,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  reelHeld: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(212,175,55,0.08)",
  },
  reelSymbol: {
    fontSize: 42,
  },
  holdBadge: {
    position: "absolute",
    bottom: -6,
    backgroundColor: Colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  holdText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: Colors.forestDeep,
    letterSpacing: 1,
  },
  holdInstructions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  holdInstructionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.balanceAmber,
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
  holdActions: {
    gap: 8,
    alignItems: "center",
  },
  skipBtn: {
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
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
    color: Colors.forestDeep,
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
