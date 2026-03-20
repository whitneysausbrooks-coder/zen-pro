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

interface Props {
  onClose: () => void;
}

const SHAPES = [
  { icon: "circle", color: "#60A5FA" },
  { icon: "square", color: "#4ADE80" },
  { icon: "triangle", color: "#FBBF24" },
  { icon: "star-four-points", color: "#F472B6" },
  { icon: "hexagon", color: "#A78BFA" },
  { icon: "diamond", color: "#F97316" },
  { icon: "heart", color: "#EF4444" },
  { icon: "lightning-bolt", color: "#E8C84A" },
];

type Phase = "memorize" | "respond" | "feedback" | "result";

function generateSequence(length: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    seq.push(Math.floor(Math.random() * SHAPES.length));
  }
  return seq;
}

function generateOptions(correctSeq: number[]): number[][] {
  const options: number[][] = [correctSeq];
  while (options.length < 4) {
    const wrong = [...correctSeq];
    const changeCount = Math.random() > 0.5 ? 1 : 2;
    for (let c = 0; c < changeCount; c++) {
      const idx = Math.floor(Math.random() * wrong.length);
      let newVal = Math.floor(Math.random() * SHAPES.length);
      while (newVal === wrong[idx]) {
        newVal = Math.floor(Math.random() * SHAPES.length);
      }
      wrong[idx] = newVal;
    }
    const wrongStr = wrong.join(",");
    if (!options.some((o) => o.join(",") === wrongStr)) {
      options.push(wrong);
    }
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export function PatternMatch({ onClose }: Props) {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>("memorize");
  const [sequence, setSequence] = useState<number[]>([]);
  const [options, setOptions] = useState<number[][]>([]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [round, setRound] = useState(1);
  const [totalRounds] = useState(8);
  const [memorizeCountdown, setMemorizeCountdown] = useState(3);
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const seqLength = Math.min(3 + Math.floor(level / 2), 7);

  const startRound = useCallback(() => {
    const seq = generateSequence(seqLength);
    setSequence(seq);
    setPhase("memorize");
    setSelectedIdx(null);
    const countdown = Math.max(2, 4 - Math.floor(level / 3));
    setMemorizeCountdown(countdown);
  }, [seqLength, level]);

  useEffect(() => {
    mountedRef.current = true;
    startRound();
    return () => {
      mountedRef.current = false;
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "memorize") return;
    if (memorizeCountdown <= 0) {
      const opts = generateOptions(sequence);
      setOptions(opts);
      const cIdx = opts.findIndex((o) => o.join(",") === sequence.join(","));
      setCorrectIdx(cIdx);
      setPhase("respond");
      return;
    }
    const t = setTimeout(() => setMemorizeCountdown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [memorizeCountdown, phase, sequence]);

  const handleSelect = useCallback(
    (idx: number) => {
      if (phase !== "respond" || selectedIdx !== null) return;
      if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedIdx(idx);
      const correct = idx === correctIdx;
      setIsCorrect(correct);

      if (correct) {
        const points = 10 * level + streak * 5;
        setScore((p) => p + points);
        setStreak((p) => p + 1);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setStreak(0);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: nd }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: nd }),
        ]).start();
      }

      setPhase("feedback");
      Animated.timing(feedbackAnim, { toValue: 1, duration: 300, useNativeDriver: nd }).start();

      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => {
        if (!mountedRef.current) return;
        feedbackAnim.setValue(0);
        if (round >= totalRounds) {
          setPhase("result");
        } else {
          setRound((p) => p + 1);
          const newLevel = correct ? Math.min(level + 1, 10) : Math.max(1, level - 1);
          setLevel(newLevel);
          const nextSeq = generateSequence(Math.min(3 + Math.floor(newLevel / 2), 7));
          setSequence(nextSeq);
          setPhase("memorize");
          setSelectedIdx(null);
          const cd = Math.max(2, 4 - Math.floor(newLevel / 3));
          setMemorizeCountdown(cd);
        }
        feedbackTimer.current = null;
      }, 1200);
    },
    [phase, selectedIdx, correctIdx, level, streak, round, totalRounds]
  );

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: round / totalRounds,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [round, totalRounds]);

  const renderShape = (shapeIdx: number, size: number = 32) => {
    const shape = SHAPES[shapeIdx];
    return (
      <MaterialCommunityIcons
        name={shape.icon as any}
        size={size}
        color={shape.color}
      />
    );
  };

  if (phase === "result") {
    const maxScore = totalRounds * 10 * 5;
    const pct = Math.round((score / maxScore) * 100);
    const rating = pct >= 80 ? "Exceptional" : pct >= 60 ? "Strong" : pct >= 40 ? "Developing" : "Keep Practicing";
    return (
      <View style={styles.container}>
        <View style={styles.resultContainer}>
          <LinearGradient
            colors={["rgba(90,61,143,0.15)", "rgba(167,139,250,0.08)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.resultEmoji}>🧩</Text>
          <Text style={styles.resultTitle}>Pattern Complete</Text>
          <Text style={styles.resultRating}>{rating}</Text>

          <View style={styles.resultStats}>
            <View style={styles.resultStat}>
              <Text style={styles.resultStatNum}>{score}</Text>
              <Text style={styles.resultStatLabel}>Score</Text>
            </View>
            <View style={styles.resultDivider} />
            <View style={styles.resultStat}>
              <Text style={styles.resultStatNum}>Lvl {level}</Text>
              <Text style={styles.resultStatLabel}>Reached</Text>
            </View>
            <View style={styles.resultDivider} />
            <View style={styles.resultStat}>
              <Text style={styles.resultStatNum}>{streak}</Text>
              <Text style={styles.resultStatLabel}>Best Streak</Text>
            </View>
          </View>

          <View style={styles.scienceBox}>
            <MaterialCommunityIcons name="brain" size={14} color={Colors.neuralPurple} />
            <Text style={styles.scienceText}>
              Visual pattern matching strengthens the ventral visual stream and prefrontal working memory circuits — key regions for executive decision-making.
            </Text>
          </View>

          <View style={styles.resultButtons}>
            <Pressable
              onPress={() => {
                setScore(0);
                setStreak(0);
                setLevel(1);
                setRound(1);
                startRound();
              }}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
                style={styles.playAgainBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="refresh" size={18} color={Colors.forestDeep} />
                <Text style={styles.playAgainText}>Play Again</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>Pattern Match</Text>
          <Text style={styles.topSub}>Round {round}/{totalRounds}</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lvl {level}</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Ionicons name="flash" size={14} color={Colors.gold} />
          <Text style={styles.statText}>{score}</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="flame" size={14} color={Colors.compassionPink} />
          <Text style={styles.statText}>{streak}x</Text>
        </View>
      </View>

      {phase === "memorize" && (
        <View style={styles.memorizeSection}>
          <Text style={styles.phaseTitle}>Memorize the Pattern</Text>
          <Text style={styles.phaseCountdown}>{memorizeCountdown}</Text>
          <View style={styles.patternRow}>
            {sequence.map((shapeIdx, i) => (
              <Animated.View key={i} style={styles.patternCell}>
                <LinearGradient
                  colors={["rgba(90,61,143,0.12)", "rgba(26,39,68,0.08)"]}
                  style={StyleSheet.absoluteFill}
                />
                {renderShape(shapeIdx, 40)}
              </Animated.View>
            ))}
          </View>
          <Text style={styles.memorizeHint}>
            Remember these {sequence.length} shapes in order
          </Text>
        </View>
      )}

      {(phase === "respond" || phase === "feedback") && (
        <Animated.View style={[styles.respondSection, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.phaseTitle}>Which pattern matches?</Text>
          <View style={styles.optionsGrid}>
            {options.map((opt, oi) => {
              const isSelected = selectedIdx === oi;
              const showCorrect = phase === "feedback" && oi === correctIdx;
              const showWrong = phase === "feedback" && isSelected && !isCorrect;

              return (
                <Pressable
                  key={oi}
                  onPress={() => handleSelect(oi)}
                  style={({ pressed }) => [pressed && phase === "respond" && { opacity: 0.85 }]}
                >
                  <View
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionSelected,
                      showCorrect && styles.optionCorrect,
                      showWrong && styles.optionWrong,
                    ]}
                  >
                    <View style={styles.optionShapes}>
                      {opt.map((shapeIdx, si) => (
                        <View key={si} style={styles.optionShape}>
                          {renderShape(shapeIdx, 24)}
                        </View>
                      ))}
                    </View>
                    <View style={styles.optionLabel}>
                      <Text style={styles.optionLetter}>
                        {String.fromCharCode(65 + oi)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {phase === "feedback" && (
            <Animated.View style={[styles.feedbackBanner, { opacity: feedbackAnim }]}>
              <Text style={[styles.feedbackText, { color: isCorrect ? Colors.empathyGreen : Colors.error }]}>
                {isCorrect ? `Correct! +${10 * level + Math.max(0, streak - 1) * 5} pts` : "Not quite — study the pattern"}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha05,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  topCenter: {
    alignItems: "center",
    gap: 2,
  },
  topTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  topSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  levelBadge: {
    backgroundColor: Colors.neuralPurpleDim,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
  },
  levelText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.neuralPurple,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.neuralPurple,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 24,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  statText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  memorizeSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  phaseTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
    textAlign: "center",
  },
  phaseCountdown: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 56,
    color: Colors.neuralPurple,
  },
  patternRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  patternCell: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  memorizeHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha30,
    textAlign: "center",
    marginTop: 8,
  },
  respondSection: {
    flex: 1,
    alignItems: "center",
    gap: 20,
    paddingTop: 8,
  },
  optionsGrid: {
    gap: 12,
    width: "100%",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.whiteAlpha10,
    gap: 12,
  },
  optionSelected: {
    borderColor: Colors.neuralPurple,
    backgroundColor: Colors.neuralPurpleDim,
  },
  optionCorrect: {
    borderColor: Colors.empathyGreen,
    backgroundColor: Colors.empathyGreenDim,
  },
  optionWrong: {
    borderColor: Colors.error,
    backgroundColor: "rgba(217, 79, 79, 0.15)",
  },
  optionShapes: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    flexWrap: "wrap",
  },
  optionShape: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.whiteAlpha10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetter: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.whiteAlpha60,
  },
  feedbackBanner: {
    paddingVertical: 12,
    alignItems: "center",
  },
  feedbackText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  resultContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 8,
    borderRadius: 24,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    padding: 32,
    overflow: "hidden",
  },
  resultEmoji: {
    fontSize: 48,
  },
  resultTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
    textAlign: "center",
  },
  resultRating: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.neuralPurple,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  resultStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 8,
  },
  resultStat: {
    alignItems: "center",
    gap: 4,
  },
  resultStatNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.gold,
  },
  resultStatLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  resultDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.whiteAlpha10,
  },
  scienceBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.neuralPurpleDim,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.15)",
    marginTop: 8,
  },
  scienceText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha60,
    lineHeight: 18,
    flex: 1,
  },
  resultButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  playAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 100,
  },
  playAgainText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: Colors.forestDeep,
  },
  closeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    paddingVertical: 16,
  },
  closeBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.whiteAlpha60,
  },
});
