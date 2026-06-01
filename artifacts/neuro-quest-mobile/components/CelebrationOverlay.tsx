import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const WIN_EMOJIS = ["✨", "🌟", "⚡", "💎", "🧠", "🎉", "👑", "💫", "🔥", "🌍"];
const PARTICLE_COUNT = 18;
const EMOJI_COUNT = 8;

interface ParticleData {
  x: number;
  delay: number;
  size: number;
  color: string;
  duration: number;
}

interface EmojiData {
  emoji: string;
  x: number;
  delay: number;
  size: number;
  duration: number;
}

const GOLD_SHADES = [
  Colors.goldLight,
  Colors.gold,
  Colors.goldDim,
  Colors.champagne,
  Colors.empathyGreen,
  Colors.neuralPurple,
  Colors.mindfulBlue,
];

function generateParticles(): ParticleData[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * SCREEN_W,
    delay: Math.random() * 400,
    size: 4 + Math.random() * 6,
    color: GOLD_SHADES[Math.floor(Math.random() * GOLD_SHADES.length)],
    duration: 1200 + Math.random() * 800,
  }));
}

function generateEmojis(): EmojiData[] {
  return Array.from({ length: EMOJI_COUNT }, () => ({
    emoji: WIN_EMOJIS[Math.floor(Math.random() * WIN_EMOJIS.length)],
    x: 20 + Math.random() * (SCREEN_W - 60),
    delay: 200 + Math.random() * 600,
    size: 20 + Math.random() * 16,
    duration: 1400 + Math.random() * 600,
  }));
}

interface Props {
  visible: boolean;
  winAmount?: number;
  onFinish: () => void;
}

export function CelebrationOverlay({ visible, winAmount, onFinish }: Props) {
  const overlayFade = useRef(new Animated.Value(0)).current;
  const centerScale = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;
  const emojiAnims = useRef(
    Array.from({ length: EMOJI_COUNT }, () => ({
      y: new Animated.Value(-40),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;

  const [particles] = useState(generateParticles);
  const [emojis] = useState(generateEmojis);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    overlayFade.setValue(0);
    centerScale.setValue(0);
    centerOpacity.setValue(0);
    ringScale.setValue(0.5);
    ringOpacity.setValue(0);
    particleAnims.forEach((p) => {
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(0);
    });
    emojiAnims.forEach((e) => {
      e.y.setValue(-40);
      e.opacity.setValue(0);
      e.rotate.setValue(0);
    });
  }, []);

  useEffect(() => {
    if (!visible) return;

    cleanup();

    mountedRef.current = true;

    if (nd) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      hapticTimer.current = setTimeout(() => {
        if (mountedRef.current && nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 150);
    }

    Animated.timing(overlayFade, { toValue: 1, duration: 200, useNativeDriver: nd }).start();

    Animated.parallel([
      Animated.spring(centerScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: nd }),
      Animated.timing(centerOpacity, { toValue: 1, duration: 300, useNativeDriver: nd }),
    ]).start();

    Animated.parallel([
      Animated.timing(ringScale, { toValue: 2.5, duration: 800, useNativeDriver: nd }),
      Animated.sequence([
        Animated.timing(ringOpacity, { toValue: 0.6, duration: 200, useNativeDriver: nd }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 600, useNativeDriver: nd }),
      ]),
    ]).start();

    particleAnims.forEach((anim, i) => {
      const p = particles[i];
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(anim.scale, { toValue: 1, duration: 200, useNativeDriver: nd }),
          Animated.timing(anim.opacity, { toValue: 1, duration: 200, useNativeDriver: nd }),
          Animated.timing(anim.y, {
            toValue: -(200 + Math.random() * 300),
            duration: p.duration,
            useNativeDriver: nd,
          }),
        ]),
        Animated.timing(anim.opacity, { toValue: 0, duration: 300, useNativeDriver: nd }),
      ]).start();
    });

    emojiAnims.forEach((anim, i) => {
      const e = emojis[i];
      Animated.sequence([
        Animated.delay(e.delay),
        Animated.parallel([
          Animated.timing(anim.opacity, { toValue: 1, duration: 200, useNativeDriver: nd }),
          Animated.timing(anim.y, {
            toValue: SCREEN_H + 60,
            duration: e.duration,
            useNativeDriver: nd,
          }),
          Animated.timing(anim.rotate, {
            toValue: (Math.random() - 0.5) * 4,
            duration: e.duration,
            useNativeDriver: nd,
          }),
        ]),
      ]).start();
    });

    finishTimer.current = setTimeout(() => {
      Animated.timing(overlayFade, { toValue: 0, duration: 400, useNativeDriver: nd }).start(() => {
        cleanup();
        onFinish();
      });
    }, 2200);

    return () => {
      mountedRef.current = false;
      if (finishTimer.current) clearTimeout(finishTimer.current);
      if (hapticTimer.current) clearTimeout(hapticTimer.current);
      overlayFade.stopAnimation();
      centerScale.stopAnimation();
      centerOpacity.stopAnimation();
      ringScale.stopAnimation();
      ringOpacity.stopAnimation();
      particleAnims.forEach((p) => {
        p.y.stopAnimation();
        p.opacity.stopAnimation();
        p.scale.stopAnimation();
      });
      emojiAnims.forEach((e) => {
        e.y.stopAnimation();
        e.opacity.stopAnimation();
        e.rotate.stopAnimation();
      });
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayFade }]} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={`p-${i}`}
          style={[
            styles.particle,
            {
              left: p.x,
              bottom: SCREEN_H * 0.4,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: particleAnims[i].opacity,
              transform: [
                { translateY: particleAnims[i].y },
                { scale: particleAnims[i].scale },
              ],
            },
          ]}
        />
      ))}

      {emojis.map((e, i) => (
        <Animated.Text
          key={`e-${i}`}
          style={[
            styles.emoji,
            {
              left: e.x,
              fontSize: e.size,
              opacity: emojiAnims[i].opacity,
              transform: [
                { translateY: emojiAnims[i].y },
                {
                  rotate: emojiAnims[i].rotate.interpolate({
                    inputRange: [-2, 2],
                    outputRange: ["-30deg", "30deg"],
                  }),
                },
              ],
            },
          ]}
        >
          {e.emoji}
        </Animated.Text>
      ))}

      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.centerBadge,
          {
            opacity: centerOpacity,
            transform: [{ scale: centerScale }],
          },
        ]}
      >
        <LinearGradient
          colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
          style={styles.centerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.winEmoji}>🎉</Text>
          <Text style={styles.winTitle}>MILESTONE REACHED!</Text>
          {winAmount !== undefined && winAmount > 0 && (
            <Text style={styles.winAmount}>+{winAmount} NE</Text>
          )}
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  particle: {
    position: "absolute",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  emoji: {
    position: "absolute",
    top: -40,
  },
  ring: {
    position: "absolute",
    top: SCREEN_H * 0.35,
    left: SCREEN_W / 2 - 60,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.gold,
  },
  centerBadge: {
    position: "absolute",
    top: SCREEN_H * 0.3,
    left: SCREEN_W / 2 - 70,
    width: 140,
    height: 140,
    borderRadius: 70,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  centerGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  winEmoji: {
    fontSize: 28,
  },
  winTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.forestDeep,
    letterSpacing: 2,
  },
  winAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.forestDeep,
    opacity: 0.8,
  },
});
