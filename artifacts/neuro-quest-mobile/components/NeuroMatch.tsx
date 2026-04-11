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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";

const CARD_ICONS: Array<{ icon: string; color: string }> = [
  { icon: "brain", color: "#A78BFA" },
  { icon: "heart", color: "#F472B6" },
  { icon: "star-four-points", color: "#FBBF24" },
  { icon: "lightning-bolt", color: "#E8C84A" },
  { icon: "diamond", color: "#60A5FA" },
  { icon: "flower", color: "#4ADE80" },
  { icon: "shield", color: "#F97316" },
  { icon: "rocket", color: "#EF4444" },
  { icon: "leaf", color: "#34D399" },
  { icon: "music", color: "#818CF8" },
  { icon: "fire", color: "#FB923C" },
  { icon: "snowflake", color: "#67E8F9" },
];

interface Card {
  id: number;
  pairId: number;
  icon: string;
  color: string;
  flipped: boolean;
  matched: boolean;
}

const LEVELS = [
  { name: "Beginner", pairs: 4, cols: 4, rows: 2 },
  { name: "Intermediate", pairs: 8, cols: 4, rows: 4 },
  { name: "Advanced", pairs: 12, cols: 4, rows: 6 },
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck(pairCount: number): Card[] {
  const icons = shuffleArray(CARD_ICONS).slice(0, pairCount);
  const cards: Card[] = [];
  icons.forEach((ic, idx) => {
    cards.push({ id: idx * 2, pairId: idx, icon: ic.icon, color: ic.color, flipped: false, matched: false });
    cards.push({ id: idx * 2 + 1, pairId: idx, icon: ic.icon, color: ic.color, flipped: false, matched: false });
  });
  return shuffleArray(cards);
}

interface Props {
  onClose: () => void;
}

export function NeuroMatch({ onClose }: Props) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [cards, setCards] = useState<Card[]>(() => createDeck(LEVELS[0].pairs));
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const level = LEVELS[levelIdx];
  const totalPairs = level.pairs;

  useEffect(() => {
    if (gameOver || timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, gameOver]);

  useEffect(() => {
    if (matchedPairs === totalPairs && !gameOver) {
      setWon(true);
      setGameOver(true);
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [matchedPairs, totalPairs, gameOver]);

  const handleCard = useCallback(
    (cardId: number) => {
      if (gameOver) return;
      if (selected.length >= 2) return;
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.flipped || card.matched) return;

      if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const next = cards.map((c) => (c.id === cardId ? { ...c, flipped: true } : c));
      setCards(next);
      const newSel = [...selected, cardId];
      setSelected(newSel);

      if (newSel.length === 2) {
        setMoves((m) => m + 1);
        const c1 = next.find((c) => c.id === newSel[0])!;
        const c2 = next.find((c) => c.id === newSel[1])!;

        if (c1.pairId === c2.pairId) {
          if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.05, duration: 100, useNativeDriver: nd }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: nd }),
          ]).start();
          setTimeout(() => {
            setCards((prev) => prev.map((c) => (c.pairId === c1.pairId ? { ...c, matched: true } : c)));
            setMatchedPairs((m) => m + 1);
            setSelected([]);
          }, 300);
        } else {
          setTimeout(() => {
            setCards((prev) => prev.map((c) => (newSel.includes(c.id) ? { ...c, flipped: false } : c)));
            setSelected([]);
          }, 800);
        }
      }
    },
    [cards, selected, gameOver, scaleAnim]
  );

  const handleNextLevel = useCallback(() => {
    if (levelIdx < LEVELS.length - 1) {
      const next = levelIdx + 1;
      setLevelIdx(next);
      setCards(createDeck(LEVELS[next].pairs));
      setSelected([]);
      setMoves(0);
      setMatchedPairs(0);
      setTimeLeft(60 + next * 30);
      setGameOver(false);
      setWon(false);
    }
  }, [levelIdx]);

  const handleRestart = useCallback(() => {
    setCards(createDeck(LEVELS[levelIdx].pairs));
    setSelected([]);
    setMoves(0);
    setMatchedPairs(0);
    setTimeLeft(60 + levelIdx * 30);
    setGameOver(false);
    setWon(false);
  }, [levelIdx]);

  const neuralReward = matchedPairs * 5 + (won ? 20 : 0);

  useEffect(() => {
    if (gameOver && neuralReward > 0) {
      (async () => {
        try {
          const cur = await AsyncStorage.getItem("nq_neural_energy");
          const next = (cur ? (parseInt(cur, 10) || 0) : 0) + neuralReward;
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
          <Text style={styles.resultEmoji}>{won ? "🧠" : "⏰"}</Text>
          <Text style={styles.resultTitle}>{won ? "Level Complete!" : "Time's Up!"}</Text>
          <Text style={styles.resultSub}>
            {matchedPairs}/{totalPairs} pairs · {moves} moves
          </Text>
          <View style={styles.rewardRow}>
            <Ionicons name="flash" size={20} color={Colors.gold} />
            <Text style={styles.rewardText}>+{neuralReward} Neural Energy</Text>
          </View>
          <View style={styles.resultActions}>
            {won && levelIdx < LEVELS.length - 1 && (
              <Pressable onPress={handleNextLevel} style={styles.nextBtn}>
                <LinearGradient colors={[Colors.goldLight, Colors.gold]} style={styles.nextGrad}>
                  <Text style={styles.nextText}>Next Level</Text>
                </LinearGradient>
              </Pressable>
            )}
            <Pressable onPress={handleRestart} style={styles.restartBtn}>
              <Text style={styles.restartText}>Play Again</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeResultBtn}>
              <Text style={styles.closeResultText}>Done</Text>
            </Pressable>
          </View>
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
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{level.name}</Text>
        </View>
        <View style={styles.timerBadge}>
          <Ionicons name="time" size={16} color={timeLeft <= 10 ? "#EF4444" : Colors.gold} />
          <Text style={[styles.timerText, timeLeft <= 10 && { color: "#EF4444" }]}>{timeLeft}s</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.statText}>Pairs: {matchedPairs}/{totalPairs}</Text>
        <Text style={styles.statText}>Moves: {moves}</Text>
      </View>

      <Animated.View style={[styles.grid, { transform: [{ scale: scaleAnim }] }]}>
        {Array.from({ length: level.rows }).map((_, row) => (
          <View key={row} style={styles.gridRow}>
            {cards.slice(row * level.cols, (row + 1) * level.cols).map((card) => (
              <Pressable
                key={card.id}
                onPress={() => handleCard(card.id)}
                style={({ pressed }) => [
                  styles.card,
                  card.matched && styles.cardMatched,
                  pressed && !card.flipped && !card.matched && { opacity: 0.8 },
                ]}
              >
                {card.flipped || card.matched ? (
                  <View style={[styles.cardFace, { borderColor: card.color + "60" }]}>
                    <MaterialCommunityIcons name={card.icon as any} size={28} color={card.color} />
                  </View>
                ) : (
                  <View style={styles.cardBack}>
                    <MaterialCommunityIcons name="help-circle-outline" size={22} color={Colors.whiteAlpha30} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  levelBadge: { backgroundColor: "rgba(167,139,250,0.15)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  levelText: { color: Colors.neuralPurple, fontSize: 13, fontWeight: "600", letterSpacing: 1 },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  timerText: { color: Colors.gold, fontSize: 16, fontWeight: "700" },
  statsRow: { flexDirection: "row", justifyContent: "center", gap: 24, marginBottom: 20 },
  statText: { color: Colors.whiteAlpha50, fontSize: 14 },
  grid: { alignItems: "center", gap: 8 },
  gridRow: { flexDirection: "row", gap: 8 },
  card: { width: 72, height: 88, borderRadius: 12 },
  cardMatched: { opacity: 0.4 },
  cardBack: {
    flex: 1, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  cardFace: {
    flex: 1, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  resultCard: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  resultEmoji: { fontSize: 56, marginBottom: 16 },
  resultTitle: { color: Colors.white, fontSize: 28, fontWeight: "700", marginBottom: 8 },
  resultSub: { color: Colors.whiteAlpha50, fontSize: 16, marginBottom: 20 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28 },
  rewardText: { color: Colors.gold, fontSize: 20, fontWeight: "700" },
  resultActions: { gap: 12, width: "100%" },
  nextBtn: { borderRadius: 16, overflow: "hidden" },
  nextGrad: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  nextText: { color: Colors.forestDeep, fontSize: 17, fontWeight: "700" },
  restartBtn: { paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha20, alignItems: "center" },
  restartText: { color: Colors.white, fontSize: 16, fontWeight: "600" },
  closeResultBtn: { paddingVertical: 12, alignItems: "center" },
  closeResultText: { color: Colors.whiteAlpha50, fontSize: 15 },
});
