import AsyncStorage from "@react-native-async-storage/async-storage";
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

type PuzzleType = "arithmetic" | "fibonacci" | "double" | "prime" | "custom";

interface Puzzle {
  type: PuzzleType;
  sequence: number[];
  answer: number;
  options: number[];
  hint: string;
}

function generatePuzzle(difficulty: number): Puzzle {
  const types: PuzzleType[] = ["arithmetic", "fibonacci", "double", "prime", "custom"];
  const type = types[Math.floor(Math.random() * Math.min(types.length, 2 + difficulty))];

  let sequence: number[] = [];
  let answer: number;
  let hint: string;

  switch (type) {
    case "fibonacci": {
      const a = Math.floor(Math.random() * 5) + 1;
      const b = Math.floor(Math.random() * 5) + a;
      sequence = [a, b];
      for (let i = 2; i < 5 + difficulty; i++) sequence.push(sequence[i - 1] + sequence[i - 2]);
      answer = sequence.pop()!;
      hint = "Each number is the sum of the two before it";
      break;
    }
    case "double": {
      const start = Math.floor(Math.random() * 5) + 1;
      sequence = [start];
      for (let i = 1; i < 4 + difficulty; i++) sequence.push(sequence[i - 1] * 2);
      answer = sequence.pop()!;
      hint = "Each number doubles the previous";
      break;
    }
    case "prime": {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
      const startIdx = Math.floor(Math.random() * 4);
      sequence = primes.slice(startIdx, startIdx + 4 + difficulty);
      answer = sequence.pop()!;
      hint = "These are consecutive prime numbers";
      break;
    }
    case "custom": {
      const base = Math.floor(Math.random() * 10) + 1;
      const step1 = Math.floor(Math.random() * 5) + 2;
      const step2 = Math.floor(Math.random() * 3) + 1;
      sequence = [base];
      for (let i = 1; i < 5 + difficulty; i++) {
        sequence.push(sequence[i - 1] + (i % 2 === 0 ? step1 : step2));
      }
      answer = sequence.pop()!;
      hint = `Alternating steps of +${step2} and +${step1}`;
      break;
    }
    default: {
      const start = Math.floor(Math.random() * 20) + 1;
      const step = Math.floor(Math.random() * (5 + difficulty)) + 2;
      sequence = [];
      for (let i = 0; i < 5 + difficulty; i++) sequence.push(start + step * i);
      answer = sequence.pop()!;
      hint = `Each number increases by ${step}`;
      break;
    }
  }

  const options = [answer];
  while (options.length < 4) {
    const offset = (Math.floor(Math.random() * 10) + 1) * (Math.random() > 0.5 ? 1 : -1);
    const wrong = answer + offset;
    if (wrong > 0 && !options.includes(wrong)) options.push(wrong);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { type, sequence, answer, options, hint };
}

interface Props {
  onClose: () => void;
}

export function LogicLift({ onClose }: Props) {
  const [round, setRound] = useState(1);
  const [totalRounds] = useState(10);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle>(() => generatePuzzle(0));
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleAnswer = useCallback(
    (answer: number) => {
      if (feedback || gameOver) return;
      setSelectedAnswer(answer);
      const correct = answer === puzzle.answer;
      setFeedback(correct ? "correct" : "wrong");

      if (correct) {
        setScore((s) => s + 10 + streak * 3);
        setStreak((s) => s + 1);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setStreak(0);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: nd }),
        ]).start();
      }

      setTimeout(() => {
        if (round >= totalRounds) {
          setGameOver(true);
        } else {
          const newDiff = Math.min(3, Math.floor((round + 1) / 3));
          setDifficulty(newDiff);
          setPuzzle(generatePuzzle(newDiff));
          setRound((r) => r + 1);
          setFeedback(null);
          setSelectedAnswer(null);
          setShowHint(false);
        }
      }, 1200);
    },
    [puzzle, feedback, gameOver, round, totalRounds, streak, shakeAnim]
  );

  const neuralReward = Math.floor(score / 3) + (score >= 80 ? 20 : 0);

  useEffect(() => {
    if (gameOver && neuralReward > 0) {
      (async () => {
        try {
          const cur = await AsyncStorage.getItem("nq_neural_energy");
          const next = (cur ? parseInt(cur, 10) : 0) + neuralReward;
          await AsyncStorage.setItem("nq_neural_energy", String(next));
        } catch {}
      })();
    }
  }, [gameOver]);

  if (gameOver) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.forestDeep, Colors.black]} style={StyleSheet.absoluteFill} />
        <View style={styles.resultCard}>
          <Text style={styles.resultEmoji}>{score >= 80 ? "🧩" : "🔢"}</Text>
          <Text style={styles.resultTitle}>{score >= 80 ? "Logic Master!" : "Good Effort!"}</Text>
          <Text style={styles.resultSub}>Score: {score} · Best streak: {streak}</Text>
          <View style={styles.rewardRow}>
            <Ionicons name="flash" size={20} color={Colors.gold} />
            <Text style={styles.rewardText}>+{neuralReward} Neural Energy</Text>
          </View>
          <Pressable onPress={() => { setRound(1); setScore(0); setStreak(0); setDifficulty(0); setPuzzle(generatePuzzle(0)); setFeedback(null); setSelectedAnswer(null); setShowHint(false); setGameOver(false); }} style={styles.restartBtn}>
            <Text style={styles.restartText}>Play Again</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeResultBtn}>
            <Text style={styles.closeResultText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </Pressable>
        <Text style={styles.roundText}>{round}/{totalRounds}</Text>
        <View style={styles.scoreRow}>
          <Ionicons name="flash" size={16} color={Colors.gold} />
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      {streak > 1 && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>{streak}x streak!</Text>
        </View>
      )}

      <View style={styles.puzzleArea}>
        <Text style={styles.puzzleLabel}>What comes next?</Text>
        <Animated.View style={[styles.sequenceRow, { transform: [{ translateX: shakeAnim }] }]}>
          {puzzle.sequence.map((num, i) => (
            <View key={i} style={styles.seqItem}>
              <Text style={styles.seqText}>{num}</Text>
            </View>
          ))}
          <View style={styles.seqMissing}>
            <Text style={styles.seqMissingText}>?</Text>
          </View>
        </Animated.View>

        {showHint && (
          <Text style={styles.hintText}>{puzzle.hint}</Text>
        )}
        {!showHint && !feedback && (
          <Pressable onPress={() => setShowHint(true)} style={styles.hintBtn}>
            <Ionicons name="bulb" size={16} color={Colors.balanceAmber} />
            <Text style={styles.hintBtnText}>Show Hint</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.optionsGrid}>
        {puzzle.options.map((opt, i) => {
          const isSelected = selectedAnswer === opt;
          const isCorrectAnswer = opt === puzzle.answer;
          let bg = "rgba(255,255,255,0.06)";
          let border = "rgba(255,255,255,0.1)";
          if (feedback && isCorrectAnswer) { bg = "rgba(74,222,128,0.15)"; border = Colors.empathyGreen; }
          else if (feedback && isSelected && !isCorrectAnswer) { bg = "rgba(239,68,68,0.15)"; border = "#EF4444"; }
          return (
            <Pressable
              key={i}
              onPress={() => handleAnswer(opt)}
              style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  roundText: { color: Colors.whiteAlpha50, fontSize: 15, fontWeight: "600" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  scoreText: { color: Colors.gold, fontSize: 18, fontWeight: "700" },
  streakBadge: { alignSelf: "center", backgroundColor: "rgba(74,222,128,0.12)", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginBottom: 12 },
  streakText: { color: Colors.empathyGreen, fontSize: 13, fontWeight: "700" },
  puzzleArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  puzzleLabel: { color: Colors.whiteAlpha50, fontSize: 16, marginBottom: 24, letterSpacing: 1 },
  sequenceRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 },
  seqItem: { width: 52, height: 52, borderRadius: 12, backgroundColor: "rgba(167,139,250,0.12)", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)", alignItems: "center", justifyContent: "center" },
  seqText: { color: Colors.white, fontSize: 20, fontWeight: "700" },
  seqMissing: { width: 52, height: 52, borderRadius: 12, backgroundColor: "rgba(212,175,55,0.1)", borderWidth: 2, borderColor: Colors.gold, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  seqMissingText: { color: Colors.gold, fontSize: 24, fontWeight: "700" },
  hintBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  hintBtnText: { color: Colors.balanceAmber, fontSize: 14 },
  hintText: { color: Colors.balanceAmber, fontSize: 14, fontStyle: "italic", textAlign: "center" },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", paddingBottom: 24 },
  optionBtn: { width: "45%", paddingVertical: 18, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  optionText: { color: Colors.white, fontSize: 22, fontWeight: "700" },
  resultCard: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  resultEmoji: { fontSize: 56, marginBottom: 16 },
  resultTitle: { color: Colors.white, fontSize: 28, fontWeight: "700", marginBottom: 8 },
  resultSub: { color: Colors.whiteAlpha50, fontSize: 16, marginBottom: 20 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28 },
  rewardText: { color: Colors.gold, fontSize: 20, fontWeight: "700" },
  restartBtn: { paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha20, alignItems: "center", width: "100%", marginBottom: 12 },
  restartText: { color: Colors.white, fontSize: 16, fontWeight: "600" },
  closeResultBtn: { paddingVertical: 12, alignItems: "center" },
  closeResultText: { color: Colors.whiteAlpha50, fontSize: 15 },
});
