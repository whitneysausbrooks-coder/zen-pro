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

interface Emotion {
  name: string;
  emoji: string;
  color: string;
  description: string;
}

const EMOTIONS: Emotion[] = [
  { name: "Joy", emoji: "😊", color: "#FBBF24", description: "Raised cheeks, crinkled eyes, upturned mouth" },
  { name: "Surprise", emoji: "😲", color: "#60A5FA", description: "Wide eyes, raised brows, open mouth" },
  { name: "Fear", emoji: "😨", color: "#A78BFA", description: "Wide eyes, tense brows, slightly open mouth" },
  { name: "Anger", emoji: "😠", color: "#EF4444", description: "Lowered brows, tightened lips, flared nostrils" },
  { name: "Disgust", emoji: "🤢", color: "#4ADE80", description: "Wrinkled nose, raised upper lip, narrowed eyes" },
  { name: "Sadness", emoji: "😢", color: "#818CF8", description: "Drooping eyelids, downturned mouth, furrowed brow" },
  { name: "Contempt", emoji: "😏", color: "#F97316", description: "One-sided mouth raise, asymmetric expression" },
  { name: "Trust", emoji: "🤝", color: "#34D399", description: "Open expression, soft eyes, relaxed features" },
  { name: "Anticipation", emoji: "🤔", color: "#E8C84A", description: "Forward lean, focused gaze, slightly raised brows" },
  { name: "Calm", emoji: "😌", color: "#67E8F9", description: "Relaxed muscles, slow blink, gentle smile" },
];

interface Trial {
  emotion: Emotion;
  options: string[];
  correctIdx: number;
}

function generateTrial(difficulty: number): Trial {
  const emotionIdx = Math.floor(Math.random() * EMOTIONS.length);
  const emotion = EMOTIONS[emotionIdx];
  const optionCount = difficulty >= 2 ? 4 : 3;
  const options = [emotion.name];
  while (options.length < optionCount) {
    const rand = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)].name;
    if (!options.includes(rand)) options.push(rand);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { emotion, options, correctIdx: options.indexOf(emotion.name) };
}

interface Props {
  onClose: () => void;
}

export function EmotionStorm({ onClose }: Props) {
  const [round, setRound] = useState(1);
  const [totalRounds] = useState(15);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(3);
  const [trial, setTrial] = useState<Trial>(() => generateTrial(0));
  const [feedback, setFeedback] = useState<"correct" | "wrong" | "timeout" | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: nd }).start();
  }, [round]);

  useEffect(() => {
    if (feedback || gameOver) return;
    if (timeLeft <= 0) {
      setFeedback("timeout");
      setStreak(0);
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => advanceRound(), 1200);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, feedback, gameOver]);

  const advanceRound = useCallback(() => {
    if (round >= totalRounds) {
      setGameOver(true);
      return;
    }
    const diff = Math.min(3, Math.floor(round / 5));
    setTrial(generateTrial(diff));
    setRound((r) => r + 1);
    setFeedback(null);
    setSelectedIdx(null);
    setTimeLeft(Math.max(2, 4 - diff));
    setShowDescription(diff < 2);
    scaleAnim.setValue(0.8);
  }, [round, totalRounds, scaleAnim]);

  const handleAnswer = useCallback(
    (idx: number) => {
      if (feedback || gameOver) return;
      setSelectedIdx(idx);
      const correct = idx === trial.correctIdx;
      setFeedback(correct ? "correct" : "wrong");

      if (correct) {
        const bonus = timeLeft * 3 + streak * 2;
        setScore((s) => s + 10 + bonus);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setStreak(0);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      setTimeout(() => advanceRound(), 1000);
    },
    [feedback, gameOver, trial, timeLeft, streak, advanceRound]
  );

  const neuralReward = Math.floor(score / 4) + (bestStreak >= 5 ? 15 : 0);

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
          <Text style={styles.resultEmoji}>{score >= 120 ? "🌟" : "💡"}</Text>
          <Text style={styles.resultTitle}>{score >= 120 ? "EQ Master!" : "Growing Awareness!"}</Text>
          <Text style={styles.resultSub}>Score: {score} · Best streak: {bestStreak}</Text>
          <View style={styles.scienceNote}>
            <Text style={styles.scienceText}>
              Micro-expression recognition strengthens the fusiform face area and improves
              social cognition — a key component of emotional intelligence.
            </Text>
          </View>
          <View style={styles.rewardRow}>
            <Ionicons name="flash" size={20} color={Colors.gold} />
            <Text style={styles.rewardText}>+{neuralReward} Neural Energy</Text>
          </View>
          <Pressable onPress={() => { setRound(1); setScore(0); setStreak(0); setBestStreak(0); setTimeLeft(3); setTrial(generateTrial(0)); setFeedback(null); setSelectedIdx(null); setGameOver(false); setShowDescription(true); }} style={styles.restartBtn}>
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

      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${(timeLeft / 4) * 100}%`, backgroundColor: timeLeft <= 1 ? "#EF4444" : Colors.gold }]} />
      </View>

      {streak > 1 && (
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={14} color={Colors.balanceAmber} />
          <Text style={styles.streakText}>{streak}x streak!</Text>
        </View>
      )}

      <Animated.View style={[styles.emojiArea, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.bigEmoji}>{trial.emotion.emoji}</Text>
        {showDescription && (
          <Text style={styles.emojiHint}>{trial.emotion.description}</Text>
        )}
      </Animated.View>

      <Text style={styles.questionText}>What emotion is this?</Text>

      <View style={styles.optionsArea}>
        {trial.options.map((opt, i) => {
          const isSelected = selectedIdx === i;
          const isCorrect = i === trial.correctIdx;
          let bg = "rgba(255,255,255,0.06)";
          let border = "rgba(255,255,255,0.1)";
          if (feedback && isCorrect) { bg = "rgba(74,222,128,0.15)"; border = Colors.empathyGreen; }
          else if (feedback && isSelected && !isCorrect) { bg = "rgba(239,68,68,0.15)"; border = "#EF4444"; }
          const emo = EMOTIONS.find((e) => e.name === opt);
          return (
            <Pressable
              key={i}
              onPress={() => handleAnswer(i)}
              style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
            >
              <Text style={styles.optionEmoji}>{emo?.emoji}</Text>
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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  roundText: { color: Colors.whiteAlpha50, fontSize: 15, fontWeight: "600" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  scoreText: { color: Colors.gold, fontSize: 18, fontWeight: "700" },
  timerBar: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 12, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 2 },
  streakBadge: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(251,191,36,0.12)", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginBottom: 8 },
  streakText: { color: Colors.balanceAmber, fontSize: 13, fontWeight: "700" },
  emojiArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  bigEmoji: { fontSize: 100, marginBottom: 16 },
  emojiHint: { color: Colors.whiteAlpha50, fontSize: 14, textAlign: "center", fontStyle: "italic", paddingHorizontal: 20 },
  questionText: { color: Colors.white, fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 16 },
  optionsArea: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", paddingBottom: 20 },
  optionBtn: { width: "47%", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1 },
  optionEmoji: { fontSize: 22 },
  optionText: { color: Colors.white, fontSize: 15, fontWeight: "600" },
  resultCard: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  resultEmoji: { fontSize: 56, marginBottom: 16 },
  resultTitle: { color: Colors.white, fontSize: 28, fontWeight: "700", marginBottom: 8 },
  resultSub: { color: Colors.whiteAlpha50, fontSize: 16, marginBottom: 16 },
  scienceNote: { backgroundColor: "rgba(167,139,250,0.08)", borderRadius: 12, padding: 14, marginBottom: 20 },
  scienceText: { color: Colors.whiteAlpha50, fontSize: 13, lineHeight: 18, textAlign: "center" },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28 },
  rewardText: { color: Colors.gold, fontSize: 20, fontWeight: "700" },
  restartBtn: { paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha20, alignItems: "center", width: "100%", marginBottom: 12 },
  restartText: { color: Colors.white, fontSize: 16, fontWeight: "600" },
  closeResultBtn: { paddingVertical: 12, alignItems: "center" },
  closeResultText: { color: Colors.whiteAlpha50, fontSize: 15 },
});
