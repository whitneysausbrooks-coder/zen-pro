import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";

type BreathPhase = "idle" | "inhale" | "hold" | "exhale";
const INHALE_DURATION = 4000;
const HOLD_DURATION = 7000;
const EXHALE_DURATION = 8000;
const TOTAL_CYCLES = 4;

interface BreathingPacerProps {
  onClose: () => void;
}

export function BreathingPacer({ onClose }: BreathingPacerProps) {
  const [phase, setPhase] = useState<BreathPhase>("idle");
  const [cycle, setCycle] = useState(0);
  const [done, setDone] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    scaleAnim.stopAnimation();
    opacityAnim.stopAnimation();
  }, []);

  const runCycle = useCallback(
    (currentCycle: number) => {
      if (currentCycle >= TOTAL_CYCLES) {
        setDone(true);
        setPhase("idle");
        return;
      }

      setPhase("inhale");
      setCycle(currentCycle + 1);
      if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: INHALE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: nd,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: INHALE_DURATION,
          useNativeDriver: nd,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        setPhase("hold");
        if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        timerRef.current = setTimeout(() => {
          setPhase("exhale");
          if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 0.4,
              duration: EXHALE_DURATION,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: nd,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.3,
              duration: EXHALE_DURATION,
              useNativeDriver: nd,
            }),
          ]).start();

          timerRef.current = setTimeout(() => {
            runCycle(currentCycle + 1);
          }, EXHALE_DURATION);
        }, HOLD_DURATION);
      }, INHALE_DURATION);
    },
    []
  );

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const handleStart = useCallback(() => {
    setDone(false);
    setCycle(0);
    scaleAnim.setValue(0.4);
    opacityAnim.setValue(0.3);
    runCycle(0);
  }, [runCycle]);

  const handleStop = useCallback(() => {
    clearTimers();
    setPhase("idle");
    scaleAnim.setValue(0.4);
    opacityAnim.setValue(0.3);
  }, [clearTimers]);

  const phaseLabel =
    phase === "inhale"
      ? "Breathe In"
      : phase === "hold"
      ? "Hold"
      : phase === "exhale"
      ? "Breathe Out"
      : "";

  const phaseTime =
    phase === "inhale" ? "4s" : phase === "hold" ? "7s" : phase === "exhale" ? "8s" : "";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>4-7-8 Breathing</Text>
        <View style={styles.cycleBadge}>
          <Text style={styles.cycleText}>{cycle}/{TOTAL_CYCLES}</Text>
        </View>
      </View>

      <Text style={styles.instruction}>
        Activates the parasympathetic nervous system through vagus nerve stimulation
      </Text>

      <View style={styles.circleContainer}>
        <Animated.View
          style={[
            styles.circle,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <LinearGradient
            colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
            style={styles.circleGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        <View style={styles.phaseOverlay}>
          {phase !== "idle" ? (
            <>
              <Text style={styles.phaseLabel}>{phaseLabel}</Text>
              <Text style={styles.phaseTime}>{phaseTime}</Text>
            </>
          ) : done ? (
            <>
              <Ionicons name="checkmark-circle" size={40} color={Colors.gold} />
              <Text style={styles.doneLabel}>Session Complete</Text>
              <Text style={styles.doneSub}>Your nervous system thanks you</Text>
            </>
          ) : (
            <Text style={styles.readyLabel}>Tap Start to begin</Text>
          )}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.gold }]} />
          <Text style={styles.legendText}>4s inhale</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.whiteAlpha50 }]} />
          <Text style={styles.legendText}>7s hold</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.goldDim }]} />
          <Text style={styles.legendText}>8s exhale</Text>
        </View>
      </View>

      {phase === "idle" && (
        <Pressable onPress={handleStart} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
          <LinearGradient
            colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
            style={styles.startBtn}
          >
            <Text style={styles.startText}>{done ? "Again" : "Start"}</Text>
          </LinearGradient>
        </Pressable>
      )}

      {phase !== "idle" && (
        <Pressable onPress={handleStop} style={styles.stopBtn}>
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
  },
  cycleBadge: {
    backgroundColor: Colors.goldAlpha15,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  cycleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.gold,
  },
  instruction: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  circleContainer: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    overflow: "hidden",
  },
  circleGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 130,
  },
  phaseOverlay: {
    alignItems: "center",
    gap: 4,
  },
  phaseLabel: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: Colors.white,
  },
  phaseTime: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.whiteAlpha80,
  },
  readyLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.whiteAlpha50,
  },
  doneLabel: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
    marginTop: 8,
  },
  doneSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
  },
  legend: {
    flexDirection: "row",
    gap: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha50,
  },
  startBtn: {
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 100,
  },
  startText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.forestDeep,
    textAlign: "center",
  },
  stopBtn: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  stopText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.whiteAlpha80,
  },
});
