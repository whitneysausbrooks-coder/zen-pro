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
const GRID_SIZE = 4;

function generateSequence(length: number): number[] {
  const seq: number[] = [];
  while (seq.length < length) {
    const cell = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
    if (!seq.includes(cell)) seq.push(cell);
  }
  return seq;
}

type Phase = "showing" | "input" | "success" | "fail" | "gameover";

interface MemoryGridProps {
  onClose: () => void;
}

export function MemoryGrid({ onClose }: MemoryGridProps) {
  const [level, setLevel] = useState(3);
  const [sequence, setSequence] = useState<number[]>([]);
  const [showingIndex, setShowingIndex] = useState(-1);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("showing");
  const [score, setScore] = useState(0);
  const [highestLevel, setHighestLevel] = useState(3);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const startRound = useCallback((lvl: number) => {
    const seq = generateSequence(lvl);
    setSequence(seq);
    setUserInput([]);
    setPhase("showing");
    setShowingIndex(-1);

    let i = 0;
    const show = () => {
      if (i < seq.length) {
        setShowingIndex(seq[i]);
        if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => {
          setShowingIndex(-1);
          i++;
          setTimeout(show, 300);
        }, 600);
      } else {
        setPhase("input");
      }
    };
    setTimeout(show, 500);
  }, []);

  useEffect(() => {
    startRound(level);
  }, []);

  const handleCellPress = useCallback(
    (cellIndex: number) => {
      if (phase !== "input") return;

      const nextInput = [...userInput, cellIndex];
      setUserInput(nextInput);

      const expectedIndex = nextInput.length - 1;
      if (sequence[expectedIndex] !== cellIndex) {
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPhase("fail");
        setTimeout(() => {
          if (level <= 3) {
            startRound(3);
            setLevel(3);
          } else {
            setPhase("gameover");
          }
        }, 1500);
        return;
      }

      if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (nextInput.length === sequence.length) {
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const newLevel = level + 1;
        setScore((s) => s + level);
        setHighestLevel((h) => Math.max(h, newLevel));
        setPhase("success");
        setTimeout(() => {
          setLevel(newLevel);
          startRound(newLevel);
        }, 1200);
      }
    },
    [phase, userInput, sequence, level, startRound]
  );

  const handleRestart = useCallback(() => {
    setLevel(3);
    setScore(0);
    startRound(3);
  }, [startRound]);

  const isHighlighted = (idx: number) => {
    if (phase === "showing") return showingIndex === idx;
    if (phase === "input") return userInput.includes(idx);
    if (phase === "success") return sequence.includes(idx);
    if (phase === "fail") return sequence.includes(idx);
    return false;
  };

  const getCellColor = (idx: number) => {
    if (phase === "showing" && showingIndex === idx) return Colors.gold;
    if (phase === "input" && userInput.includes(idx)) return Colors.goldDim;
    if (phase === "success" && sequence.includes(idx)) return Colors.success;
    if (phase === "fail" && sequence.includes(idx)) return Colors.error;
    return Colors.surfaceLight;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Memory Grid</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lvl {level}</Text>
        </View>
      </View>

      <Text style={styles.instruction}>
        {phase === "showing"
          ? "Watch the sequence..."
          : phase === "input"
          ? "Tap the tiles in order"
          : phase === "success"
          ? "Excellent! Level up!"
          : phase === "fail"
          ? "Wrong order!"
          : ""}
      </Text>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        <Text style={styles.dotSep}> </Text>
        <Text style={styles.scoreText}>Best: Level {highestLevel}</Text>
      </View>

      {phase === "gameover" ? (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>Game Over</Text>
          <Text style={styles.gameOverScore}>
            Score: {score} | Reached Level {highestLevel}
          </Text>
          <Text style={styles.gameOverSub}>
            Working memory training strengthens dorsolateral prefrontal cortex connections, improving focus, emotional regulation, and decision-making.
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
        <View style={styles.grid}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, idx) => (
            <Pressable
              key={idx}
              onPress={() => handleCellPress(idx)}
              disabled={phase !== "input"}
              style={({ pressed }) => [
                styles.cell,
                {
                  backgroundColor: getCellColor(idx),
                  borderColor: isHighlighted(idx) ? Colors.gold : Colors.glassBorder,
                },
                pressed && phase === "input" && { opacity: 0.7 },
              ]}
            >
              {isHighlighted(idx) && (
                <View style={[styles.cellGlow, { backgroundColor: getCellColor(idx) }]} />
              )}
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.progressLabel}>
        {phase === "input" ? `${userInput.length} / ${sequence.length} tiles` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
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
  levelBadge: {
    backgroundColor: Colors.goldAlpha15,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  levelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.gold,
  },
  instruction: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.whiteAlpha80,
    textAlign: "center",
    minHeight: 20,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  scoreText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
  },
  dotSep: {
    color: Colors.whiteAlpha20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  cell: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cellGlow: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    opacity: 0.3,
  },
  progressLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    minHeight: 18,
  },
  gameOverContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  gameOverTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: Colors.gold,
  },
  gameOverScore: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
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
