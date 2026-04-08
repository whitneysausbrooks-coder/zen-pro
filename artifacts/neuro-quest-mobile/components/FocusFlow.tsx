import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";
const SCREEN_W = Dimensions.get("window").width - 32;
const LANE_COUNT = 3;
const LANE_W = SCREEN_W / LANE_COUNT;
const GAME_DURATION = 60;

interface FallingItem {
  id: number;
  lane: number;
  y: number;
  type: "focus" | "distraction";
  icon: string;
  color: string;
}

const FOCUS_ITEMS = [
  { icon: "brain", color: "#A78BFA" },
  { icon: "lightbulb-on", color: "#FBBF24" },
  { icon: "meditation", color: "#4ADE80" },
  { icon: "book-open-variant", color: "#60A5FA" },
];

const DISTRACTION_ITEMS = [
  { icon: "cellphone", color: "#EF4444" },
  { icon: "television", color: "#F97316" },
  { icon: "food", color: "#FB923C" },
  { icon: "sleep", color: "#9CA3AF" },
];

interface Props {
  onClose: () => void;
}

export function FocusFlow({ onClose }: Props) {
  const [playerLane, setPlayerLane] = useState(1);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const nextId = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (gameOver || timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, gameOver]);

  useEffect(() => {
    if (lives <= 0) setGameOver(true);
  }, [lives]);

  useEffect(() => {
    if (gameOver) return;
    const spawn = () => {
      const isFocus = Math.random() > 0.35;
      const pool = isFocus ? FOCUS_ITEMS : DISTRACTION_ITEMS;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const item: FallingItem = {
        id: nextId.current++,
        lane: Math.floor(Math.random() * LANE_COUNT),
        y: -60,
        type: isFocus ? "focus" : "distraction",
        icon: pick.icon,
        color: pick.color,
      };
      setItems((prev) => [...prev, item]);
    };
    const interval = setInterval(spawn, 900 - Math.min(score * 5, 400));
    return () => clearInterval(interval);
  }, [gameOver, score]);

  useEffect(() => {
    if (gameOver) return;
    const tick = () => {
      setItems((prev) => {
        const next: FallingItem[] = [];
        for (const item of prev) {
          const newY = item.y + 4;
          if (newY > 500) {
            if (item.type === "focus") {
              setCombo(0);
            }
            continue;
          }
          if (newY > 400 && newY <= 440 && item.lane === playerLane) {
            if (item.type === "focus") {
              setScore((s) => s + 10 + combo * 2);
              setCombo((c) => c + 1);
              if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.1, duration: 60, useNativeDriver: nd }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 60, useNativeDriver: nd }),
              ]).start();
            } else {
              setLives((l) => l - 1);
              setCombo(0);
              if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            continue;
          }
          next.push({ ...item, y: newY });
        }
        return next;
      });
      frameRef.current = setTimeout(tick, 40);
    };
    frameRef.current = setTimeout(tick, 40);
    return () => {
      if (frameRef.current) clearTimeout(frameRef.current);
    };
  }, [gameOver, playerLane, combo]);

  const moveLane = useCallback(
    (dir: -1 | 1) => {
      if (gameOver) return;
      setPlayerLane((l) => Math.max(0, Math.min(LANE_COUNT - 1, l + dir)));
      if (nd) Haptics.selectionAsync();
    },
    [gameOver]
  );

  const neuralReward = Math.floor(score / 5) + (score >= 100 ? 15 : 0);

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
          <Text style={styles.resultEmoji}>{score >= 100 ? "🎯" : "🧠"}</Text>
          <Text style={styles.resultTitle}>{score >= 100 ? "Sharp Focus!" : "Keep Training!"}</Text>
          <Text style={styles.resultSub}>Score: {score} · Best combo: {combo}x</Text>
          <View style={styles.rewardRow}>
            <Ionicons name="flash" size={20} color={Colors.gold} />
            <Text style={styles.rewardText}>+{neuralReward} Neural Energy</Text>
          </View>
          <Pressable onPress={() => { setScore(0); setLives(3); setTimeLeft(GAME_DURATION); setItems([]); setCombo(0); setGameOver(false); setPlayerLane(1); }} style={styles.restartBtn}>
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
        <View style={styles.scoreRow}>
          <Ionicons name="flash" size={16} color={Colors.gold} />
          <Text style={styles.scoreText}>{score}</Text>
          {combo > 1 && <Text style={styles.comboText}>{combo}x</Text>}
        </View>
        <View style={styles.livesRow}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Ionicons key={i} name="heart" size={18} color={i < lives ? "#EF4444" : Colors.whiteAlpha20} />
          ))}
        </View>
        <View style={styles.timerBadge}>
          <Text style={[styles.timerText, timeLeft <= 10 && { color: "#EF4444" }]}>{timeLeft}s</Text>
        </View>
      </View>

      <Text style={styles.instruction}>Catch focus items · Avoid distractions</Text>

      <View style={styles.gameArea}>
        {Array.from({ length: LANE_COUNT }).map((_, i) => (
          <View key={i} style={[styles.lane, i === playerLane && styles.activeLane]} />
        ))}
        {items.map((item) => (
          <View
            key={item.id}
            style={[styles.fallingItem, { left: item.lane * LANE_W + LANE_W / 2 - 20, top: item.y }]}
          >
            <MaterialCommunityIcons
              name={item.icon as any}
              size={32}
              color={item.color}
            />
          </View>
        ))}
        <Animated.View
          style={[styles.player, { left: playerLane * LANE_W + LANE_W / 2 - 22, transform: [{ scale: scaleAnim }] }]}
        >
          <MaterialCommunityIcons name="head-dots-horizontal" size={36} color={Colors.gold} />
        </Animated.View>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={() => moveLane(-1)} style={styles.controlBtn}>
          <Ionicons name="chevron-back" size={32} color={Colors.white} />
        </Pressable>
        <Pressable onPress={() => moveLane(1)} style={styles.controlBtn}>
          <Ionicons name="chevron-forward" size={32} color={Colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  scoreText: { color: Colors.gold, fontSize: 20, fontWeight: "700" },
  comboText: { color: Colors.empathyGreen, fontSize: 14, fontWeight: "700" },
  livesRow: { flexDirection: "row", gap: 4 },
  timerBadge: { flexDirection: "row", alignItems: "center" },
  timerText: { color: Colors.gold, fontSize: 16, fontWeight: "700" },
  instruction: { color: Colors.whiteAlpha50, fontSize: 13, textAlign: "center", marginBottom: 12 },
  gameArea: { flex: 1, position: "relative", overflow: "hidden", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.02)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  lane: { position: "absolute", top: 0, bottom: 0, width: LANE_W, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.04)" },
  activeLane: { backgroundColor: "rgba(212,175,55,0.04)" },
  fallingItem: { position: "absolute", width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  player: { position: "absolute", bottom: 40, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  controls: { flexDirection: "row", justifyContent: "center", gap: 60, paddingVertical: 16 },
  controlBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
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
