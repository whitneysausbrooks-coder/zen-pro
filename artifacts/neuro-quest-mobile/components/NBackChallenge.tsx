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
const GRID = 3;
const TOTAL_TRIALS = 25;
const SHOW_MS = 1500;
const PAUSE_MS = 500;

interface Props {
  onClose: () => void;
}

export function NBackChallenge({ onClose }: Props) {
  const [nLevel, setNLevel] = useState(2);
  const [trial, setTrial] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [currentPos, setCurrentPos] = useState<number | null>(null);
  const [showingStimulus, setShowingStimulus] = useState(false);
  const [responded, setResponded] = useState(false);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [falseAlarms, setFalseAlarms] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [feedbackType, setFeedbackType] = useState<"hit" | "miss" | "false" | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const trialTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateSequence = useCallback(() => {
    const seq: number[] = [];
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      if (i >= nLevel && Math.random() < 0.33) {
        seq.push(seq[i - nLevel]);
      } else {
        seq.push(Math.floor(Math.random() * (GRID * GRID)));
      }
    }
    return seq;
  }, [nLevel]);

  const startGame = useCallback(() => {
    const seq = generateSequence();
    setSequence(seq);
    setTrial(0);
    setHits(0);
    setMisses(0);
    setFalseAlarms(0);
    setGameOver(false);
    setPhase("playing");
    setResponded(false);
    setCurrentPos(seq[0]);
    setShowingStimulus(true);
  }, [generateSequence]);

  useEffect(() => {
    if (phase !== "playing" || gameOver) return;

    const showTimer = setTimeout(() => {
      setShowingStimulus(false);

      if (trial >= nLevel) {
        const isMatch = sequence[trial] === sequence[trial - nLevel];
        if (isMatch && !responded) {
          setMisses((m) => m + 1);
          setFeedbackType("miss");
          setTimeout(() => setFeedbackType(null), 600);
        }
      }

      const pauseTimer = setTimeout(() => {
        const next = trial + 1;
        if (next >= TOTAL_TRIALS) {
          setPhase("done");
          setGameOver(true);
          return;
        }
        setTrial(next);
        setCurrentPos(sequence[next]);
        setShowingStimulus(true);
        setResponded(false);
      }, PAUSE_MS);

      trialTimeout.current = pauseTimer;
    }, SHOW_MS);

    return () => {
      clearTimeout(showTimer);
      if (trialTimeout.current) clearTimeout(trialTimeout.current);
    };
  }, [trial, phase, gameOver, sequence, nLevel, responded]);

  const handleMatch = useCallback(() => {
    if (phase !== "playing" || responded || !showingStimulus || trial < nLevel) return;
    setResponded(true);

    const isMatch = sequence[trial] === sequence[trial - nLevel];
    if (isMatch) {
      setHits((h) => h + 1);
      setFeedbackType("hit");
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.08, duration: 80, useNativeDriver: nd }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: nd }),
      ]).start();
    } else {
      setFalseAlarms((f) => f + 1);
      setFeedbackType("false");
      if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => setFeedbackType(null), 600);
  }, [phase, responded, showingStimulus, trial, nLevel, sequence, scaleAnim]);

  const accuracy = hits + misses + falseAlarms > 0
    ? Math.round((hits / Math.max(1, hits + misses + falseAlarms)) * 100)
    : 0;
  const neuralReward = hits * 5 + (accuracy >= 80 ? 25 : 0);

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

  if (phase === "ready") {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.forestDeep, Colors.black]} style={StyleSheet.absoluteFill} />
        <Pressable onPress={onClose} style={styles.closeBtnAbs}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </Pressable>
        <View style={styles.readyCard}>
          <Text style={styles.readyEmoji}>🧠</Text>
          <Text style={styles.readyTitle}>{nLevel}-Back Challenge</Text>
          <Text style={styles.readySub}>
            A position will flash on the grid. Press "Match" when the current position
            matches the one from {nLevel} steps ago.
          </Text>
          <View style={styles.levelPicker}>
            {[1, 2, 3].map((n) => (
              <Pressable key={n} onPress={() => setNLevel(n)} style={[styles.levelBtn, nLevel === n && styles.levelBtnActive]}>
                <Text style={[styles.levelBtnText, nLevel === n && styles.levelBtnTextActive]}>{n}-Back</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={startGame} style={styles.startBtn}>
            <LinearGradient colors={[Colors.goldLight, Colors.gold]} style={styles.startGrad}>
              <Text style={styles.startText}>Start</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  if (gameOver) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.forestDeep, Colors.black]} style={StyleSheet.absoluteFill} />
        <View style={styles.resultCard}>
          <Text style={styles.resultEmoji}>{accuracy >= 80 ? "🎯" : "🧠"}</Text>
          <Text style={styles.resultTitle}>{accuracy >= 80 ? "Excellent!" : "Keep Training!"}</Text>
          <View style={styles.resultStats}>
            <View style={styles.resultStatItem}>
              <Text style={styles.resultStatVal}>{hits}</Text>
              <Text style={styles.resultStatLabel}>Hits</Text>
            </View>
            <View style={styles.resultStatItem}>
              <Text style={styles.resultStatVal}>{misses}</Text>
              <Text style={styles.resultStatLabel}>Misses</Text>
            </View>
            <View style={styles.resultStatItem}>
              <Text style={styles.resultStatVal}>{falseAlarms}</Text>
              <Text style={styles.resultStatLabel}>False</Text>
            </View>
            <View style={styles.resultStatItem}>
              <Text style={[styles.resultStatVal, { color: accuracy >= 80 ? Colors.empathyGreen : Colors.balanceAmber }]}>{accuracy}%</Text>
              <Text style={styles.resultStatLabel}>Accuracy</Text>
            </View>
          </View>
          <View style={styles.rewardRow}>
            <Ionicons name="flash" size={20} color={Colors.gold} />
            <Text style={styles.rewardText}>+{neuralReward} Neural Energy</Text>
          </View>
          <Pressable onPress={() => setPhase("ready")} style={styles.restartBtn}>
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
        <Text style={styles.trialText}>{trial + 1}/{TOTAL_TRIALS}</Text>
        <Text style={styles.hitsText}>Hits: {hits}</Text>
      </View>

      {feedbackType && (
        <View style={[styles.feedbackBadge, feedbackType === "hit" ? styles.feedbackHit : styles.feedbackBad]}>
          <Text style={styles.feedbackText}>
            {feedbackType === "hit" ? "Correct!" : feedbackType === "miss" ? "Missed!" : "Wrong!"}
          </Text>
        </View>
      )}

      <Animated.View style={[styles.gridContainer, { transform: [{ scale: scaleAnim }] }]}>
        {Array.from({ length: GRID * GRID }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.gridCell,
              showingStimulus && currentPos === i && styles.gridCellActive,
            ]}
          />
        ))}
      </Animated.View>

      <View style={styles.matchArea}>
        <Text style={styles.matchHint}>
          {trial < nLevel ? `Watch ${nLevel - trial} more...` : "Same position as " + nLevel + " steps ago?"}
        </Text>
        <Pressable
          onPress={handleMatch}
          disabled={trial < nLevel || responded}
          style={[styles.matchBtn, (trial < nLevel || responded) && styles.matchBtnDisabled]}
        >
          <LinearGradient
            colors={trial < nLevel || responded ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.03)"] : [Colors.goldLight, Colors.gold]}
            style={styles.matchGrad}
          >
            <Text style={[styles.matchText, trial < nLevel || responded ? { color: Colors.whiteAlpha30 } : { color: Colors.forestDeep }]}>
              Match!
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  closeBtnAbs: { position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  trialText: { color: Colors.whiteAlpha50, fontSize: 15, fontWeight: "600" },
  hitsText: { color: Colors.empathyGreen, fontSize: 15, fontWeight: "600" },
  feedbackBadge: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, marginBottom: 8 },
  feedbackHit: { backgroundColor: "rgba(74,222,128,0.15)" },
  feedbackBad: { backgroundColor: "rgba(239,68,68,0.15)" },
  feedbackText: { color: Colors.white, fontSize: 14, fontWeight: "600" },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginVertical: 24, alignSelf: "center" },
  gridCell: { width: 80, height: 80, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  gridCellActive: { backgroundColor: "rgba(167,139,250,0.5)", borderColor: Colors.neuralPurple },
  matchArea: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  matchHint: { color: Colors.whiteAlpha50, fontSize: 15, textAlign: "center" },
  matchBtn: { borderRadius: 20, overflow: "hidden", width: "70%" },
  matchBtnDisabled: { opacity: 0.5 },
  matchGrad: { paddingVertical: 18, alignItems: "center", borderRadius: 20 },
  matchText: { fontSize: 20, fontWeight: "700" },
  readyCard: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  readyEmoji: { fontSize: 56, marginBottom: 16 },
  readyTitle: { color: Colors.white, fontSize: 28, fontWeight: "700", marginBottom: 12 },
  readySub: { color: Colors.whiteAlpha50, fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  levelPicker: { flexDirection: "row", gap: 12, marginBottom: 32 },
  levelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: Colors.whiteAlpha20 },
  levelBtnActive: { backgroundColor: "rgba(167,139,250,0.15)", borderColor: Colors.neuralPurple },
  levelBtnText: { color: Colors.whiteAlpha50, fontSize: 15, fontWeight: "600" },
  levelBtnTextActive: { color: Colors.neuralPurple },
  startBtn: { borderRadius: 18, overflow: "hidden", width: "80%" },
  startGrad: { paddingVertical: 16, alignItems: "center", borderRadius: 18 },
  startText: { color: Colors.forestDeep, fontSize: 18, fontWeight: "700" },
  resultCard: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  resultEmoji: { fontSize: 56, marginBottom: 16 },
  resultTitle: { color: Colors.white, fontSize: 28, fontWeight: "700", marginBottom: 16 },
  resultStats: { flexDirection: "row", gap: 20, marginBottom: 24 },
  resultStatItem: { alignItems: "center" },
  resultStatVal: { color: Colors.white, fontSize: 24, fontWeight: "700" },
  resultStatLabel: { color: Colors.whiteAlpha50, fontSize: 12, marginTop: 4 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28 },
  rewardText: { color: Colors.gold, fontSize: 20, fontWeight: "700" },
  restartBtn: { paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha20, alignItems: "center", width: "100%", marginBottom: 12 },
  restartText: { color: Colors.white, fontSize: 16, fontWeight: "600" },
  closeResultBtn: { paddingVertical: 12, alignItems: "center" },
  closeResultText: { color: Colors.whiteAlpha50, fontSize: 15 },
});
