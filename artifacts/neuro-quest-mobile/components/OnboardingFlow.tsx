import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

const { width, height } = Dimensions.get("window");
const nd = Platform.OS !== "web";
const ONBOARDING_KEY = "nq_onboarding_complete";

const STEPS = [
  {
    eyebrow: "WELCOME TO",
    title: "NeuroQuest",
    subtitle: "Where science meets\ncompassion",
    body: "Train your brain. Grow your empathy.\nMake a real difference — one thought at a time.",
    icon: "🧠",
    gradient: [Colors.celestialPurple, Colors.forestDeep, Colors.black] as const,
    accentColor: Colors.neuralPurple,
  },
  {
    eyebrow: "NEUROPLASTICITY",
    title: "Train Your Mind",
    subtitle: "Science-backed games\nthat rewire your brain",
    body: "Memory, focus, emotional intelligence — \neach exercise strengthens real neural pathways.",
    icon: "⚡",
    gradient: [Colors.celestialBlue, Colors.forestDeep, Colors.black] as const,
    accentColor: Colors.mindfulBlue,
  },
  {
    eyebrow: "COMPASSION",
    title: "Grow Your Heart",
    subtitle: "Every milestone\nfunds real change",
    body: "30% of subscription revenue goes directly\nto verified charity partners worldwide.",
    icon: "💛",
    gradient: ["#1A2A1A" as string, Colors.forestDeep, Colors.black] as const,
    accentColor: Colors.empathyGreen,
  },
  {
    eyebrow: "YOUR JOURNEY",
    title: "Begin Today",
    subtitle: "Earn Neural Energy™\nwith every session",
    body: "Start with a gratitude moment.\nYour first 20 Neural Energy awaits.",
    icon: "✨",
    gradient: [Colors.nebula, Colors.celestialPurple, Colors.black] as const,
    accentColor: Colors.gold,
  },
];

interface Props {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const bodySlide = useRef(new Animated.Value(40)).current;
  const btnFade = useRef(new Animated.Value(0)).current;

  const dotAnims = useRef(STEPS.map(() => new Animated.Value(0))).current;
  const orbPulse = useRef(new Animated.Value(0)).current;

  const isAnimating = useRef(false);

  const runEntrance = useCallback((index: number) => {
    iconScale.setValue(0);
    titleSlide.setValue(30);
    bodySlide.setValue(40);
    btnFade.setValue(0);
    fadeAnim.setValue(1);
    slideAnim.setValue(0);

    dotAnims.forEach((d, i) => d.setValue(i === index ? 1 : 0));

    Animated.stagger(120, [
      Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: nd }),
      Animated.parallel([
        Animated.spring(titleSlide, { toValue: 0, friction: 7, tension: 60, useNativeDriver: nd }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 1, useNativeDriver: nd }),
      ]),
      Animated.spring(bodySlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: nd }),
      Animated.timing(btnFade, { toValue: 1, duration: 400, useNativeDriver: nd }),
    ]).start(() => {
      isAnimating.current = false;
    });
  }, []);

  React.useEffect(() => {
    runEntrance(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, { toValue: 1, duration: 3000, useNativeDriver: nd }),
        Animated.timing(orbPulse, { toValue: 0, duration: 3000, useNativeDriver: nd }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const goNext = useCallback(() => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: nd }),
      Animated.timing(slideAnim, { toValue: -40, duration: 250, useNativeDriver: nd }),
    ]).start(() => {
      const next = step + 1;
      if (next >= STEPS.length) {
        handleComplete();
        return;
      }
      setStep(next);
      slideAnim.setValue(40);
      runEntrance(next);
    });
  }, [step]);

  const handleComplete = useCallback(async () => {
    if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    } catch {}
    onComplete();
  }, [onComplete]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const orbScale = orbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const orbOpacity = orbPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.5, 0.3],
  });

  return (
    <View style={styles.container} accessibilityRole="none">
      <LinearGradient
        colors={[...current.gradient]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            backgroundColor: current.accentColor,
            transform: [{ scale: orbScale }],
            opacity: orbOpacity,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbSmall,
          {
            backgroundColor: current.accentColor,
            transform: [{ scale: orbScale }],
            opacity: orbOpacity.interpolate({
              inputRange: [0.3, 0.5],
              outputRange: [0.15, 0.25],
              extrapolate: "clamp",
            }),
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 40,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.topSection}>
          <Animated.View
            style={[
              styles.iconWrap,
              { transform: [{ scale: iconScale }] },
            ]}
            accessibilityElementsHidden
          >
            <View
              style={[
                styles.iconCircle,
                { borderColor: current.accentColor },
              ]}
            >
              <Text style={styles.icon}>{current.icon}</Text>
            </View>
          </Animated.View>

          <Animated.View
            style={{ transform: [{ translateY: titleSlide }] }}
          >
            <Text
              style={[styles.eyebrow, { color: current.accentColor }]}
              accessibilityRole="header"
            >
              {current.eyebrow}
            </Text>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.subtitle}>{current.subtitle}</Text>
          </Animated.View>

          <Animated.View
            style={{ transform: [{ translateY: bodySlide }] }}
          >
            <Text style={styles.body}>{current.body}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.bottomSection, { opacity: btnFade }]}>
          <View
            style={styles.dots}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}
          >
            {STEPS.map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === step ? current.accentColor : Colors.whiteAlpha20,
                    width: i === step ? 24 : 8,
                  },
                ]}
                accessible={false}
                importantForAccessibility="no"
              />
            ))}
          </View>

          <Pressable
            onPress={goNext}
            style={({ pressed }) => [
              styles.ctaWrap,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Begin your journey" : "Continue to next step"}
          >
            <LinearGradient
              colors={[current.accentColor, Colors.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>
                {isLast ? "Begin Your Journey" : "Continue"}
              </Text>
            </LinearGradient>
          </Pressable>

          {!isLast && (
            <Pressable
              onPress={handleComplete}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  orb: {
    position: "absolute",
    top: -height * 0.15,
    right: -width * 0.3,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
  },
  orbSmall: {
    position: "absolute",
    bottom: height * 0.1,
    left: -width * 0.25,
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  topSection: {
    flex: 1,
    justifyContent: "center",
    gap: 28,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 44,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 42,
    color: Colors.white,
    textAlign: "center",
    lineHeight: 50,
  },
  subtitle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 20,
    color: Colors.whiteAlpha60,
    textAlign: "center",
    lineHeight: 28,
    marginTop: 8,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    lineHeight: 24,
    marginTop: 4,
  },
  bottomSection: {
    gap: 20,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaWrap: {
    width: "100%",
  },
  cta: {
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.forestDeep,
    letterSpacing: 0.3,
  },
  skip: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.whiteAlpha30,
    letterSpacing: 0.5,
    paddingVertical: 8,
  },
});

export { ONBOARDING_KEY };
