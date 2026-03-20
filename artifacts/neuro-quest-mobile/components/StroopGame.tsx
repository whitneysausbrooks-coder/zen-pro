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

const COLOR_MAP: Record<string, string> = {
  RED: "#E05C5C",
  BLUE: "#5C8AE0",
  GREEN: "#5CB87A",
  YELLOW: "#E8C84A",
  PURPLE: "#9B5CE0",
  ORANGE: "#E09B5C",
};
const COLOR_NAMES = Object.keys(COLOR_MAP);

function generateRound() {
  const wordIndex = Math.floor(Math.random() * COLOR_NAMES.length);
  let colorIndex = Math.floor(Math.random() * COLOR_NAMES.length);
  if (Math.random() > 0.3) {
    while (colorIndex === wordIndex) {
      colorIndex = Math.floor(Math.random() * COLOR_NAMES.length);
    }
  }
  const word = COLOR_NAMES[wordIndex];
  const displayColor = COLOR_NAMES[colorIndex];
  const correctAnswer = displayColor;

  const options = [correctAnswer];
  while (options.length < 4) {
    const rand = COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)];
    if (!options.includes(rand)) options.push(rand);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { word, displayColor, correctAnswer, options };
}

interface StroopGameProps {
  onClose: () => void;
}

export function StroopGame({ onClose }: StroopGameProps) {
  const [round, setRound] = useState(generateRound);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (gameOver || timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameOver]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (gameOver) return;
      const correct = answer === round.correctAnswer;
      setTotal((t) => t + 1);
      setFeedback(correct ? "correct" : "wrong");

      if (correct) {
        setScore((s) => s + 1);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.1, duration: 100, useNativeDriver: nd }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: nd }),
        ]).start();
      } else {
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: nd }),
        ]).start();
      }

      setTimeout(() => {
        setFeedback(null);
        setRound(generateRound());
      }, 400);
    },
    [round, gameOver]
  );

  const handleRestart = useCallback(() => {
    setScore(0);
    setTotal(0);
    setTimeLeft(30);
    setGameOver(false);
    setRound(generateRound());
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Stroop Test</Text>
        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{timeLeft}s</Text>
        </View>
      </View>

      <Text style={styles.instruction}>
        Tap the <Text style={{ color: Colors.gold }}>INK COLOR</Text>, not the word
      </Text>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>{score}/{total} correct</Text>
      </View>

      {gameOver ? (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>Time's Up!</Text>
          <Text style={styles.gameOverScore}>
            {score}/{total} correct ({total > 0 ? Math.round((score / total) * 100) : 0}%)
          </Text>
          <Text style={styles.gameOverSub}>
            The Stroop test strengthens your prefrontal cortex by forcing conflict resolution between automatic reading and deliberate color identification.
          </Text>
          <Pressable onPress={handleRestart} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
              style={styles.restartBtn}
            >
              <Text style={styles.restartText}>Play Again</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <>
          <Animated.View
            style={[
              styles.wordContainer,
              { transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] },
              feedback === "correct" && styles.wordCorrect,
              feedback === "wrong" && styles.wordWrong,
            ]}
          >
            <Text style={[styles.word, { color: COLOR_MAP[round.displayColor] }]}>
              {round.word}
            </Text>
          </Animated.View>

          <View style={styles.optionsGrid}>
            {round.options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => handleAnswer(opt)}
                style={({ pressed }) => [
                  styles.optionBtn,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <View style={[styles.optionDot, { backgroundColor: COLOR_MAP[opt] }]} />
                <Text style={styles.optionLabel}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  timerBadge: {
    backgroundColor: Colors.goldAlpha15,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  timerText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.gold,
  },
  instruction: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    textAlign: "center",
  },
  scoreRow: {
    alignItems: "center",
  },
  scoreText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.whiteAlpha80,
  },
  wordContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  wordCorrect: {
    borderColor: Colors.success,
    backgroundColor: "rgba(92, 184, 122, 0.1)",
  },
  wordWrong: {
    borderColor: Colors.error,
    backgroundColor: "rgba(224, 92, 92, 0.1)",
  },
  word: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 48,
    textTransform: "uppercase",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  optionBtn: {
    width: "46%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  optionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  optionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  gameOverContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  gameOverTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: Colors.gold,
  },
  gameOverScore: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: Colors.white,
  },
  gameOverSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  restartBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 100,
    marginTop: 8,
  },
  restartText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.forestDeep,
  },
});
