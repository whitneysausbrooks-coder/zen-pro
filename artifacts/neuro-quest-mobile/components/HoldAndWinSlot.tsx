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
const SYMBOLS = ["💎", "⚡", "🌿", "🔔", "⭐", "🧠"];
const MULTIPLIERS: Record<string, number> = {
  "💎": 10, "⚡": 7, "🌿": 3, "🔔": 5, "⭐": 4, "🧠": 8,
};

const TIERS = [
  { label: "10 NE", cost: 10, color: Colors.mindfulBlue },
  { label: "30 NE", cost: 30, color: Colors.balanceAmber },
  { label: "50 NE", cost: 50, color: Colors.gold },
];

export interface HoldWinResult {
  won: boolean;
  multiplier: number;
  label: string;
}

interface Props {
  neuralEnergy: number;
  onSpinStart: (cost: number) => boolean;
  onResult: (result: HoldWinResult, cost: number) => void;
  /** Pro members play for free — bypasses the Neural Energy cost gate. */
  unlimited?: boolean;
}

type Outcome = "triple" | "pair" | "miss";

function rollOutcome(): Outcome {
  const r = Math.random() * 100;
  if (r < 11) return "triple";
  if (r < 30) return "pair";
  return "miss";
}

function generateRespinReels(
  outcome: Outcome,
  held: boolean[],
  currentReels: number[]
): number[] {
  const result = [...currentReels];
  const unheldIndices: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (!held[i]) unheldIndices.push(i);
  }

  if (unheldIndices.length === 0) return result;

  const heldSymbols: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (held[i]) heldSymbols.push(currentReels[i]);
  }

  switch (outcome) {
    case "triple": {
      const target =
        heldSymbols.length > 0
          ? heldSymbols[0]
          : Math.floor(Math.random() * SYMBOLS.length);
      for (const i of unheldIndices) result[i] = target;
      break;
    }
    case "pair": {
      if (heldSymbols.length === 2 && heldSymbols[0] === heldSymbols[1]) {
        let diff: number;
        do {
          diff = Math.floor(Math.random() * SYMBOLS.length);
        } while (diff === heldSymbols[0]);
        for (const i of unheldIndices) result[i] = diff;
      } else if (heldSymbols.length === 1) {
        if (unheldIndices.length >= 2) {
          result[unheldIndices[0]] = heldSymbols[0];
          let diff: number;
          do {
            diff = Math.floor(Math.random() * SYMBOLS.length);
          } while (diff === heldSymbols[0]);
          result[unheldIndices[1]] = diff;
        } else {
          result[unheldIndices[0]] = heldSymbols[0];
        }
      } else {
        const sym = Math.floor(Math.random() * SYMBOLS.length);
        let diff: number;
        do {
          diff = Math.floor(Math.random() * SYMBOLS.length);
        } while (diff === sym);
        result[unheldIndices[0]] = sym;
        result[unheldIndices[1]] = sym;
        if (unheldIndices[2] !== undefined) result[unheldIndices[2]] = diff;
      }
      break;
    }
    case "miss": {
      const used = new Set<number>();
      for (let i = 0; i < 3; i++) {
        if (held[i]) used.add(currentReels[i]);
      }
      for (const i of unheldIndices) {
        let sym: number;
        let attempts = 0;
        do {
          sym = Math.floor(Math.random() * SYMBOLS.length);
          attempts++;
        } while (used.has(sym) && attempts < 100);
        result[i] = sym;
        used.add(sym);
      }
      break;
    }
  }

  return result;
}

function evaluateReels(reels: number[]): {
  outcome: Outcome;
  matchSymbol: string;
} {
  const s1 = SYMBOLS[reels[0]];
  const s2 = SYMBOLS[reels[1]];
  const s3 = SYMBOLS[reels[2]];

  if (s1 === s2 && s2 === s3)
    return { outcome: "triple", matchSymbol: s1 };
  if (s1 === s2 || s2 === s3 || s1 === s3) {
    const sym = s1 === s2 ? s1 : s1 === s3 ? s1 : s2;
    return { outcome: "pair", matchSymbol: sym };
  }
  return { outcome: "miss", matchSymbol: "" };
}

export function HoldAndWinSlot({ neuralEnergy, onSpinStart, onResult, unlimited }: Props) {
  const [reels, setReels] = useState([0, 2, 4]);
  const [held, setHeld] = useState([false, false, false]);
  const [phase, setPhase] = useState<
    "ready" | "spinning" | "hold" | "respin" | "result"
  >("ready");
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
  const intervalRefs = useRef<(ReturnType<typeof setInterval> | null)[]>([
    null,
    null,
    null,
  ]);
  const tickRefs = useRef([0, 0, 0]);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const respinLockRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      intervalRefs.current.forEach((id) => {
        if (id) clearInterval(id);
      });
      timeoutRefs.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  const spinReels = useCallback(
    (
      heldMask: boolean[],
      finalIndices: number[],
      onDone: () => void
    ) => {
      let stopped = 0;
      const total = heldMask.filter((h) => !h).length;
      if (total === 0) {
        onDone();
        return;
      }

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
          if (intervalRefs.current[i])
            clearInterval(intervalRefs.current[i]!);
          intervalRefs.current[i] = null;
          if (!mountedRef.current) return;
          setDisplayReels((prev) => {
            const next = [...prev];
            next[i] = finalIndices[i];
            return next;
          });
          Animated.sequence([
            Animated.timing(spinAnims[i], {
              toValue: -8,
              duration: 50,
              useNativeDriver: nd,
            }),
            Animated.spring(spinAnims[i], {
              toValue: 0,
              friction: 5,
              useNativeDriver: nd,
            }),
          ]).start();
          stopped++;
          if (stopped >= total) onDone();
        }, 600 + i * 400);
        timeoutRefs.current.push(tid);
      });
    },
    []
  );

  const handleSpin = useCallback(() => {
    if (phase !== "ready") return;

    const tier = TIERS[selectedTier];
    const canSpin = onSpinStart(tier.cost);
    if (!canSpin) return;

    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("spinning");
    setHeld([false, false, false]);
    setResultText("");
    setPayout(0);

    const r = [0, 1, 2].map(() =>
      Math.floor(Math.random() * SYMBOLS.length)
    );
    setReels(r);

    spinReels([false, false, false], r, () => {
      setPhase("hold");
    });
  }, [phase, spinReels, selectedTier, onSpinStart]);

  const toggleHold = useCallback(
    (idx: number) => {
      if (phase !== "hold") return;
      if (nd) Haptics.selectionAsync();
      setHeld((prev) => {
        const next = [...prev];
        next[idx] = !next[idx];
        return next;
      });
    },
    [phase]
  );

  const finishSpin = useCallback(
    (finalReels: number[]) => {
      if (!mountedRef.current) return;
      const tier = TIERS[selectedTier];

      const { outcome, matchSymbol } = evaluateReels(finalReels);

      let resultMultiplier = 0;
      let donationCents = 0;

      if (outcome === "triple") {
        resultMultiplier = MULTIPLIERS[matchSymbol] || 3;
        donationCents = Math.round(tier.cost * resultMultiplier);
        const net = donationCents - tier.cost;
        setResultText(
          `Triple Match! ${matchSymbol}${matchSymbol}${matchSymbol} — +${donationCents} NE (net +${net})`
        );
      } else if (outcome === "pair") {
        resultMultiplier = 0.5;
        donationCents = Math.round(tier.cost * resultMultiplier);
        const net = donationCents - tier.cost;
        setResultText(
          `Pair ${matchSymbol}${matchSymbol} — half energy back +${donationCents} NE (net ${net})`
        );
      } else {
        setResultText(`No match — spent ${tier.cost} NE`);
      }

      setPayout(donationCents);
      setPhase("result");
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: nd,
      }).start();

      onResult(
        {
          won: resultMultiplier > 0,
          multiplier: resultMultiplier,
          label:
            outcome === "triple"
              ? `Triple ${matchSymbol}×3`
              : outcome === "pair"
              ? `Pair ${matchSymbol}×2`
              : "No match",
        },
        tier.cost
      );

      if (nd) {
        if (resultMultiplier > 0)
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        else
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const rid = setTimeout(() => {
        if (!mountedRef.current) return;
        Animated.timing(resultAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: nd,
        }).start(() => {
          if (!mountedRef.current) return;
          setPhase("ready");
          respinLockRef.current = false;
          resultAnim.setValue(0);
        });
      }, 2500);
      timeoutRefs.current.push(rid);
    },
    [selectedTier, onResult]
  );

  const handleRespin = useCallback(() => {
    if (phase !== "hold" || respinLockRef.current) return;
    respinLockRef.current = true;
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("respin");

    const outcome = rollOutcome();
    const newReels = generateRespinReels(outcome, held, reels);
    setReels(newReels);

    spinReels(held, newReels, () => {
      finishSpin(newReels);
    });
  }, [phase, reels, held, spinReels, finishSpin]);

  const handleSkipHold = useCallback(() => {
    if (phase !== "hold" || respinLockRef.current) return;
    respinLockRef.current = true;
    const noHold: boolean[] = [false, false, false];
    setHeld(noHold);

    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("respin");

    const outcome = rollOutcome();
    const newReels = generateRespinReels(outcome, noHold, reels);
    setReels(newReels);

    spinReels(noHold, newReels, () => {
      finishSpin(newReels);
    });
  }, [phase, reels, spinReels, finishSpin]);

  const canAfford = !!unlimited || neuralEnergy >= TIERS[selectedTier].cost;

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#1a0a2e", "#0d1f3c", "#1a0a2e"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.header}>
        <Text style={s.badge}>HOLD & GROW</Text>
        <Text style={s.title}>Neural Hold</Text>
        <Text style={s.sub}>
          Hold your best symbols, replay for a match
        </Text>
      </View>

      <View style={s.reelsRow}>
        {[0, 1, 2].map((i) => (
          <Pressable
            key={i}
            onPress={() => toggleHold(i)}
            disabled={phase !== "hold"}
            accessibilityRole="button"
            accessibilityLabel={`Symbol ${i + 1}: ${SYMBOLS[displayReels[i]]}${held[i] ? ", held" : ""}`}
          >
            <Animated.View
              style={[
                s.reel,
                held[i] && s.reelHeld,
                { transform: [{ translateY: spinAnims[i] }] },
              ]}
            >
              <Text style={s.reelSymbol}>
                {SYMBOLS[displayReels[i]]}
              </Text>
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
          <Ionicons
            name="hand-left"
            size={16}
            color={Colors.balanceAmber}
          />
          <Text style={s.holdInstructionText}>
            Tap symbols to hold, then replay
          </Text>
        </View>
      )}

      <View style={s.tierRow}>
        {TIERS.map((tier, i) => (
          <Pressable
            key={tier.label}
            onPress={() => {
              if (phase === "ready") setSelectedTier(i);
            }}
            style={[
              s.tierBtn,
              selectedTier === i && {
                borderColor: tier.color,
                backgroundColor: `${tier.color}15`,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Play ${tier.label}`}
          >
            <Text
              style={[
                s.tierLabel,
                selectedTier === i && { color: tier.color },
              ]}
            >
              {tier.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.oddsRow}>
        <Text style={s.oddsLabel}>How it works:</Text>
        <Text style={s.oddsText}>Match symbols to earn Neural Energy</Text>
      </View>

      {phase === "hold" ? (
        <View style={s.holdActions}>
          <Pressable
            onPress={handleRespin}
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="Replay unheld symbols"
          >
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
              style={s.spinGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={s.spinText}>REPLAY</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleSkipHold} style={s.skipBtn} accessibilityRole="button" accessibilityLabel="Replay all symbols without holding">
            <Text style={s.skipText}>Replay All</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handleSpin}
          disabled={phase !== "ready" || !canAfford}
          style={({ pressed }) => [
            pressed && { opacity: 0.9 },
            (phase !== "ready" || !canAfford) && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            !canAfford
              ? "Insufficient Neural Energy"
              : `Play for ${TIERS[selectedTier].label}`
          }
        >
          <LinearGradient
            colors={
              phase === "ready" && canAfford
                ? ["#9b59b6", "#8e44ad", "#6c3483"]
                : ["#555", "#444", "#333"]
            }
            style={s.spinGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={s.spinText}>
              {phase === "spinning" || phase === "respin"
                ? "PLAYING..."
                : !canAfford
                ? "NEED MORE NE"
                : `PLAY — ${TIERS[selectedTier].label}`}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

      {resultText !== "" && (
        <Animated.View
          style={[s.resultBanner, { opacity: resultAnim }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[
              s.resultText,
              payout > 0
                ? { color: Colors.gold }
                : { color: Colors.whiteAlpha50 },
            ]}
          >
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
    fontSize: 16,
    color: Colors.whiteAlpha60,
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
