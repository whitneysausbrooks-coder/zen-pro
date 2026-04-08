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
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";

export type WheelSegment = {
  value: number;
  label: string;
  color: string;
  icon: string;
  multiplier: number;
  weight: number;
};

const WHEEL_SEGMENTS: WheelSegment[] = [
  { value: 50,  label: "50",   color: "#2A4A35", icon: "🌿", multiplier: 5,   weight: 6 },
  { value: 0,   label: "MISS", color: "#1A2744", icon: "💨", multiplier: 0,   weight: 16 },
  { value: 20,  label: "20",   color: "#3D2B6B", icon: "✨", multiplier: 2,   weight: 12 },
  { value: 75,  label: "75",   color: "#0D3B3B", icon: "🧠", multiplier: 7.5, weight: 4 },
  { value: 15,  label: "15",   color: "#2A1F4E", icon: "💫", multiplier: 1.5, weight: 14 },
  { value: 500, label: "500",  color: "#8B6914", icon: "👑", multiplier: 50,  weight: 1 },
  { value: 25,  label: "25",   color: "#1B3022", icon: "🌍", multiplier: 2.5, weight: 8 },
  { value: 100, label: "100",  color: "#4A2D6B", icon: "💎", multiplier: 10,  weight: 3 },
  { value: 10,  label: "10",   color: "#14271A", icon: "🌱", multiplier: 1,   weight: 16 },
  { value: 0,   label: "2x",   color: "#6B3D2B", icon: "🔥", multiplier: 0,   weight: 6 },
  { value: 30,  label: "30",   color: "#0A1A10", icon: "☀️", multiplier: 3,   weight: 8 },
  { value: 200, label: "200",  color: "#5A3D8F", icon: "🌟", multiplier: 20,  weight: 2 },
];

const SEGMENT_COUNT = WHEEL_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const WHEEL_RADIUS = 140;
const CENTER = WHEEL_RADIUS + 10;
const SVG_SIZE = CENTER * 2;

const TOTAL_WEIGHT = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);

function weightedRandomIndex(): number {
  const roll = Math.random() * TOTAL_WEIGHT;
  let cumulative = 0;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    cumulative += WHEEL_SEGMENTS[i].weight;
    if (roll < cumulative) return i;
  }
  return WHEEL_SEGMENTS.length - 1;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export interface WheelResult {
  isWin: boolean;
  isBoost: boolean;
  prizeValue: number;
  multiplier: number;
  prizeLabel: string;
}

interface SlotMachineProps {
  onSpin: (result: WheelResult) => void;
  spinsLeft: number;
  disabled?: boolean;
}

export function SlotMachine({ onSpin, spinsLeft, disabled }: SlotMachineProps) {
  const [spinning, setSpinning] = useState(false);
  const [lastWinIndex, setLastWinIndex] = useState<number | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const cumulativeRotation = useRef(0);
  const mountedRef = useRef(true);
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (activeAnimRef.current) activeAnimRef.current.stop();
    };
  }, []);

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
    if (spinning || spinsLeft <= 0 || disabled) return;

    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const winIndex = weightedRandomIndex();
    const segment = WHEEL_SEGMENTS[winIndex];
    const isBoost = segment.label === "2x";
    const isWin = segment.value > 0 || isBoost;

    const segmentCenterAngle = winIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetAngle = 360 - segmentCenterAngle;
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const totalRotation = fullSpins * 360 + targetAngle;

    const startValue = cumulativeRotation.current;
    const endValue = startValue + totalRotation;
    cumulativeRotation.current = endValue;

    spinAnim.setValue(startValue);
    setSpinning(true);
    setLastWinIndex(null);

    const anim = Animated.timing(spinAnim, {
      toValue: endValue,
      duration: 4000 + Math.random() * 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nd,
    });
    activeAnimRef.current = anim;

    anim.start(() => {
      activeAnimRef.current = null;
      if (!mountedRef.current) return;

      setSpinning(false);
      setLastWinIndex(winIndex);

      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: nd }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: nd }),
      ]).start();

      if (nd) {
        if (isWin) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }

      onSpin({
        isWin,
        isBoost,
        prizeValue: segment.value,
        multiplier: segment.multiplier,
        prizeLabel: segment.label,
      });
    });
  }, [spinning, spinsLeft, disabled, onSpin]);

  const wheelRotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const isDisabled = spinning || spinsLeft <= 0 || !!disabled;

  return (
    <View style={styles.container}>
      <View style={styles.machine}>
        <LinearGradient
          colors={[Colors.forestDeep, Colors.forest, Colors.forestDeep]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.machineTop}>
          <Text style={styles.machineTitle}>Compassion</Text>
          <Text style={styles.machineSubtitle}>LUCKY WHEEL</Text>
        </View>

        <View style={styles.wheelContainer}>
          <View style={styles.pointer} />

          <Animated.View
            style={[
              styles.wheelWrapper,
              { transform: [{ rotate: wheelRotation }] },
            ]}
          >
            <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
              <Circle cx={CENTER} cy={CENTER} r={WHEEL_RADIUS + 4} fill="none" stroke={Colors.gold} strokeWidth={3} opacity={0.4} />
              {WHEEL_SEGMENTS.map((seg, i) => {
                const startAngle = i * SEGMENT_ANGLE;
                const endAngle = startAngle + SEGMENT_ANGLE;
                const d = describeArc(CENTER, CENTER, WHEEL_RADIUS, startAngle, endAngle);
                const midAngle = startAngle + SEGMENT_ANGLE / 2;
                const labelR = WHEEL_RADIUS * 0.62;
                const labelPos = polarToCartesian(CENTER, CENTER, labelR, midAngle);
                const iconR = WHEEL_RADIUS * 0.85;
                const iconPos = polarToCartesian(CENTER, CENTER, iconR, midAngle);

                return (
                  <G key={i}>
                    <Path
                      d={d}
                      fill={lastWinIndex === i ? Colors.gold : seg.color}
                      stroke={Colors.goldAlpha30}
                      strokeWidth={1.5}
                    />
                    <SvgText
                      x={iconPos.x}
                      y={iconPos.y}
                      fontSize={16}
                      textAnchor="middle"
                      alignmentBaseline="central"
                    >
                      {seg.icon}
                    </SvgText>
                    <SvgText
                      x={labelPos.x}
                      y={labelPos.y}
                      fontSize={seg.value >= 100 ? 13 : 15}
                      fontWeight="bold"
                      fill={lastWinIndex === i ? Colors.forestDeep : Colors.champagne}
                      textAnchor="middle"
                      alignmentBaseline="central"
                      transform={`rotate(${midAngle}, ${labelPos.x}, ${labelPos.y})`}
                    >
                      {seg.label}
                    </SvgText>
                  </G>
                );
              })}
              <Circle cx={CENTER} cy={CENTER} r={28} fill={Colors.forestDeep} stroke={Colors.gold} strokeWidth={2} />
              <SvgText
                x={CENTER}
                y={CENTER + 1}
                fontSize={10}
                fontWeight="bold"
                fill={Colors.gold}
                textAnchor="middle"
                alignmentBaseline="central"
              >
                SPIN
              </SvgText>
            </Svg>
          </Animated.View>
        </View>

        {lastWinIndex !== null && (
          <Animated.View style={[styles.resultBanner, { opacity: glowAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1, 0.8] }) }]}>
            <Text style={styles.resultText}>
              {WHEEL_SEGMENTS[lastWinIndex].icon}{" "}
              {WHEEL_SEGMENTS[lastWinIndex].label === "MISS"
                ? "No Win"
                : WHEEL_SEGMENTS[lastWinIndex].label === "2x"
                ? "2x Boost!"
                : `+${WHEEL_SEGMENTS[lastWinIndex].label} NE`}
            </Text>
          </Animated.View>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={handleSpin}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.spinButton,
              pressed && styles.spinButtonPressed,
              isDisabled && styles.spinButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={spinning ? "Wheel is spinning" : spinsLeft > 0 ? `Spin the wheel, ${spinsLeft} spins left` : "No spins remaining"}
          >
            <LinearGradient
              colors={!isDisabled ? [Colors.goldLight, Colors.gold, Colors.goldDim] : ["#555", "#444", "#333"]}
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
  wheelContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: SVG_SIZE + 20,
  },
  wheelWrapper: {
    width: SVG_SIZE,
    height: SVG_SIZE,
  },
  pointer: {
    position: "absolute",
    top: -2,
    zIndex: 10,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 24,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.gold,
    alignSelf: "center",
  },
  resultBanner: {
    alignItems: "center",
    paddingVertical: 8,
  },
  resultText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.gold,
    textAlign: "center",
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
