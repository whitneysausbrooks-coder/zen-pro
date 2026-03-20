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

const SYMBOLS = ["🌿", "☀️", "💧", "🌍", "❤️", "✨"];
const SYMBOL_HEIGHT = 80;
const nd = Platform.OS !== "web";

interface ReelProps {
  symbols: string[];
  spinning: boolean;
  finalSymbolIndex: number;
  stopDelay: number;
  onStopped: () => void;
}

function Reel({ symbols, spinning, finalSymbolIndex, stopDelay, onStopped }: ReelProps) {
  const [displayIndex, setDisplayIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const hasStoppedRef = useRef(false);

  useEffect(() => {
    if (spinning) {
      hasStoppedRef.current = false;
      let tick = 0;
      intervalRef.current = setInterval(() => {
        tick++;
        setDisplayIndex(tick % symbols.length);
      }, 80);

      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setDisplayIndex(finalSymbolIndex);

        bounceAnim.setValue(-12);
        Animated.spring(bounceAnim, {
          toValue: 0,
          useNativeDriver: nd,
          friction: 5,
          tension: 150,
        }).start(() => {
          if (!hasStoppedRef.current) {
            hasStoppedRef.current = true;
            onStopped();
          }
        });
      }, stopDelay);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [spinning, finalSymbolIndex, stopDelay]);

  const aboveIndex = (displayIndex - 1 + symbols.length) % symbols.length;
  const belowIndex = (displayIndex + 1) % symbols.length;

  return (
    <View style={styles.reelContainer}>
      <LinearGradient
        colors={["rgba(7,13,9,0.95)", "transparent", "transparent", "rgba(7,13,9,0.95)"]}
        style={styles.reelFade}
        pointerEvents="none"
      />
      <View style={styles.reelWindow}>
        <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
          <View style={styles.symbolCell}>
            <Text style={[styles.symbol, styles.symbolDim]}>{symbols[aboveIndex]}</Text>
          </View>
          <View style={[styles.symbolCell, styles.symbolCellCenter]}>
            <Text style={styles.symbol}>{symbols[displayIndex]}</Text>
          </View>
          <View style={styles.symbolCell}>
            <Text style={[styles.symbol, styles.symbolDim]}>{symbols[belowIndex]}</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

interface SlotMachineProps {
  onSpin: (isWin: boolean) => void;
  spinsLeft: number;
}

export function SlotMachine({ onSpin, spinsLeft }: SlotMachineProps) {
  const [spinning, setSpinning] = useState(false);
  const [finalIndices, setFinalIndices] = useState([0, 2, 4]);
  const [stoppedCount, setStoppedCount] = useState(0);
  const winRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: nd }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: nd }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleSpin = useCallback(() => {
    if (spinning || spinsLeft <= 0) return;

    if (nd) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    const r1 = Math.floor(Math.random() * SYMBOLS.length);
    const r2 = Math.floor(Math.random() * SYMBOLS.length);
    const jackpot = Math.random() < 0.15;
    const r3 = jackpot ? r1 : Math.floor(Math.random() * SYMBOLS.length);
    const win = r1 === r2 && r2 === r3;

    winRef.current = win;
    setFinalIndices([r1, r2, r3]);
    setStoppedCount(0);
    setSpinning(true);
  }, [spinning, spinsLeft]);

  const handleReelStopped = useCallback(() => {
    setStoppedCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setTimeout(() => {
          setSpinning(false);
          const isWin = winRef.current;
          onSpin(isWin);
          if (nd) {
            if (isWin) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        }, 0);
      }
      return next;
    });
  }, [onSpin]);

  return (
    <View style={styles.container}>
      <View style={styles.machine}>
        <LinearGradient
          colors={[Colors.forestDeep, Colors.forest, Colors.forestDeep]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.machineTop}>
          <Text style={styles.machineTitle}>Compassion</Text>
          <Text style={styles.machineSubtitle}>JACKPOT</Text>
        </View>

        <View style={styles.reelsRow}>
          {[0, 1, 2].map((i) => (
            <Reel
              key={i}
              symbols={SYMBOLS}
              spinning={spinning}
              finalSymbolIndex={finalIndices[i]}
              stopDelay={800 + i * 500}
              onStopped={handleReelStopped}
            />
          ))}
        </View>

        <View style={styles.centerLine} />

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={handleSpin}
            disabled={spinning || spinsLeft <= 0}
            style={({ pressed }) => [
              styles.spinButton,
              pressed && styles.spinButtonPressed,
              (spinning || spinsLeft <= 0) && styles.spinButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={spinsLeft > 0 ? [Colors.goldLight, Colors.gold, Colors.goldDim] : ["#555", "#444", "#333"]}
              style={styles.spinGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.spinText}>
                {spinning ? "Spinning..." : spinsLeft > 0 ? "SPIN" : "No Spins"}
              </Text>
              <Text style={styles.spinsCount}>
                {spinsLeft} spin{spinsLeft !== 1 ? "s" : ""} left
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  machine: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    padding: 20,
    gap: 16,
  },
  machineTop: {
    alignItems: "center",
  },
  machineTitle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 16,
    color: Colors.goldLight,
    letterSpacing: 2,
  },
  machineSubtitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.gold,
    letterSpacing: 6,
  },
  reelsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.goldAlpha15,
    position: "relative",
  },
  centerLine: {
    position: "absolute",
    left: 32,
    right: 32,
    top: "50%",
    height: 0,
    borderTopWidth: 0,
  },
  reelContainer: {
    width: 80,
    height: SYMBOL_HEIGHT * 3,
    position: "relative",
  },
  reelFade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    borderRadius: 12,
  },
  reelWindow: {
    width: 80,
    height: SYMBOL_HEIGHT * 3,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: Colors.goldAlpha15,
  },
  symbolCell: {
    width: 80,
    height: SYMBOL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  symbolCellCenter: {
    backgroundColor: "rgba(212, 175, 55, 0.08)",
  },
  symbol: {
    fontSize: 40,
  },
  symbolDim: {
    opacity: 0.4,
  },
  spinButton: {
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  spinButtonPressed: {
    transform: [{ scale: 0.96 }],
    shadowOpacity: 0.2,
  },
  spinButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  spinGradient: {
    paddingVertical: 18,
    paddingHorizontal: 60,
    alignItems: "center",
    borderRadius: 50,
  },
  spinText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.forestDeep,
    letterSpacing: 2,
  },
  spinsCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.forestDeep,
    opacity: 0.7,
    marginTop: 2,
  },
});
