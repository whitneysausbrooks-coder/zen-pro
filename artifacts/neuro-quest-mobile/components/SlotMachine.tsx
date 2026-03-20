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
const VISIBLE_SYMBOLS = 3;

interface ReelProps {
  spinning: boolean;
  finalIndex: number;
  delay: number;
  onStop: () => void;
}

function Reel({ spinning, finalIndex, delay, onStop }: ReelProps) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const nativeDriver = Platform.OS !== "web";
    if (spinning) {
      Animated.loop(
        Animated.timing(scrollY, {
          toValue: SYMBOLS.length * SYMBOL_HEIGHT,
          duration: 300,
          useNativeDriver: nativeDriver,
        })
      ).start();
    } else {
      scrollY.stopAnimation();
      const target = finalIndex * SYMBOL_HEIGHT;
      Animated.spring(scrollY, {
        toValue: target % (SYMBOLS.length * SYMBOL_HEIGHT),
        useNativeDriver: nativeDriver,
        friction: 8,
        tension: 40,
      }).start(() => {
        setCurrentIndex(finalIndex);
        onStop();
      });
    }
  }, [spinning, finalIndex]);

  const translateY = scrollY.interpolate({
    inputRange: [0, SYMBOLS.length * SYMBOL_HEIGHT],
    outputRange: [0, -SYMBOLS.length * SYMBOL_HEIGHT],
    extrapolate: "extend",
  });

  const extendedSymbols = [...SYMBOLS, ...SYMBOLS, ...SYMBOLS];

  return (
    <View style={styles.reelContainer}>
      <LinearGradient
        colors={["rgba(7,13,9,0.95)", "transparent", "transparent", "rgba(7,13,9,0.95)"]}
        style={styles.reelFade}
        pointerEvents="none"
      />
      <View style={styles.reelWindow}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          {extendedSymbols.map((sym, i) => (
            <View key={i} style={styles.symbolCell}>
              <Text style={styles.symbol}>{sym}</Text>
            </View>
          ))}
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
  const [finalIndices, setFinalIndices] = useState([0, 1, 2]);
  const [stoppedCount, setStoppedCount] = useState(0);
  const [isWin, setIsWin] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const nd = Platform.OS !== "web";
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

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    const r1 = Math.floor(Math.random() * SYMBOLS.length);
    const r2 = Math.floor(Math.random() * SYMBOLS.length);
    const jackpot = Math.random() < 0.15;
    const r3 = jackpot ? r1 : Math.floor(Math.random() * SYMBOLS.length);
    const r4 = jackpot ? r1 : Math.floor(Math.random() * SYMBOLS.length);
    const win = r1 === r2 && r2 === r3;

    setIsWin(win);
    setFinalIndices([r1, r2, r3]);
    setStoppedCount(0);
    setSpinning(true);
  }, [spinning, spinsLeft]);

  const handleReelStop = useCallback(() => {
    setStoppedCount((prev) => {
      const next = prev + 1;
      if (next === 3) {
        setSpinning(false);
        onSpin(isWin);
        if (Platform.OS !== "web") {
          if (isWin) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      }
      return next;
    });
  }, [isWin, onSpin]);

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
              spinning={spinning}
              finalIndex={finalIndices[i]}
              delay={i * 200}
              onStop={handleReelStop}
            />
          ))}
        </View>

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
  },
  reelContainer: {
    width: 80,
    height: SYMBOL_HEIGHT * VISIBLE_SYMBOLS,
    position: "relative",
  },
  reelFade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    borderRadius: 12,
  },
  reelWindow: {
    width: 80,
    height: SYMBOL_HEIGHT * VISIBLE_SYMBOLS,
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
  symbol: {
    fontSize: 40,
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
