import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { StroopGame } from "@/components/StroopGame";
import { MemoryGrid } from "@/components/MemoryGrid";
import { BreathingPacer } from "@/components/BreathingPacer";
import { NeuralSoundscape } from "@/components/NeuralSoundscape";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";
const COMPLETED_KEY = "nq_completed_tasks";

interface MindfulTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconFamily: "Ionicons" | "Feather" | "MaterialCommunity";
  category: "connection" | "focus" | "growth";
  xp: number;
}

const MINDFUL_TASKS: MindfulTask[] = [
  {
    id: "meditation",
    title: "5-Minute Meditation",
    description: "Sit quietly, focus on your breath. Notice thoughts without judgment.",
    icon: "leaf",
    iconFamily: "Ionicons",
    category: "focus",
    xp: 15,
  },
  {
    id: "deep_work",
    title: "Deep Work Sprint",
    description: "45 minutes of distraction-free focused work on your most important task.",
    icon: "target",
    iconFamily: "Feather",
    category: "focus",
    xp: 25,
  },
  {
    id: "help_coworker",
    title: "Help a Coworker",
    description: "Offer genuine help to someone at work without expecting anything in return.",
    icon: "people",
    iconFamily: "Ionicons",
    category: "connection",
    xp: 20,
  },
  {
    id: "outside_group",
    title: "Talk Outside Your Circle",
    description: "Have a real conversation with someone outside your usual social group.",
    icon: "git-branch",
    iconFamily: "Feather",
    category: "growth",
    xp: 30,
  },
  {
    id: "unlikely_person",
    title: "Connect with Someone Unlikely",
    description: "Reach out to someone you don't naturally gravitate toward. Find common ground.",
    icon: "shuffle",
    iconFamily: "Feather",
    category: "growth",
    xp: 35,
  },
  {
    id: "compliment_stranger",
    title: "Compliment a Stranger",
    description: "Give a genuine, specific compliment to someone you don't know.",
    icon: "chatbubble-ellipses",
    iconFamily: "Ionicons",
    category: "connection",
    xp: 20,
  },
  {
    id: "gratitude",
    title: "Gratitude Journaling",
    description: "Write down 3 specific things you're grateful for today and why.",
    icon: "edit-3",
    iconFamily: "Feather",
    category: "focus",
    xp: 15,
  },
  {
    id: "body_scan",
    title: "Body Scan Check-In",
    description: "Slowly scan from head to toe, noticing tension. Release what you find.",
    icon: "body",
    iconFamily: "Ionicons",
    category: "focus",
    xp: 15,
  },
];

interface DopamineBooster {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconFamily: "Ionicons" | "Feather" | "MaterialCommunity";
  science: string;
}

const DOPAMINE_BOOSTERS: DopamineBooster[] = [
  {
    id: "cold_exposure",
    title: "Cold Exposure",
    description: "30-second cold water at the end of your shower",
    icon: "snow",
    iconFamily: "Ionicons",
    science: "Increases dopamine 250% for 2-3 hours (Huberman Lab)",
  },
  {
    id: "exercise",
    title: "Movement Break",
    description: "10 minutes of vigorous exercise — walk, pushups, dancing",
    icon: "barbell",
    iconFamily: "Ionicons",
    science: "Boosts BDNF and dopamine via the VTA pathway",
  },
  {
    id: "sunlight",
    title: "Morning Sunlight",
    description: "10 minutes of outdoor light within 30 min of waking",
    icon: "sunny",
    iconFamily: "Ionicons",
    science: "Sets circadian cortisol pulse, primes dopamine circuits",
  },
  {
    id: "music",
    title: "Music Chills",
    description: "Listen to a song that gives you goosebumps — fully present",
    icon: "musical-notes",
    iconFamily: "Ionicons",
    science: "Triggers dopamine release in nucleus accumbens (Nature, 2011)",
  },
  {
    id: "novel_experience",
    title: "Try Something New",
    description: "Take a different route, try a new food, learn a new word",
    icon: "compass",
    iconFamily: "Feather",
    science: "Novelty activates substantia nigra and VTA dopamine neurons",
  },
  {
    id: "complete_task",
    title: "Finish a Small Task",
    description: "Complete one tiny thing you've been putting off",
    icon: "checkmark-done",
    iconFamily: "Ionicons",
    science: "Task completion triggers reward prediction in the striatum",
  },
];

interface BrainGame {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconFamily: "Ionicons" | "Feather" | "MaterialCommunity";
  science: string;
}

const BRAIN_GAMES: BrainGame[] = [
  {
    id: "stroop",
    title: "Stroop Test",
    description: "Name the ink color, not the word. Tests inhibitory control.",
    icon: "color-palette",
    iconFamily: "Ionicons",
    science: "Strengthens anterior cingulate cortex — conflict monitoring and error detection",
  },
  {
    id: "memory",
    title: "Memory Grid",
    description: "Remember and repeat tile sequences. Progressive difficulty.",
    icon: "grid",
    iconFamily: "Feather",
    science: "Trains dorsolateral PFC working memory, linked to emotional regulation",
  },
  {
    id: "breathing",
    title: "4-7-8 Breathing Pacer",
    description: "Guided breathing cycle: 4s inhale, 7s hold, 8s exhale.",
    icon: "fitness",
    iconFamily: "Ionicons",
    science: "Vagus nerve stimulation activates parasympathetic response, reducing amygdala reactivity",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  connection: "#5C8AE0",
  focus: Colors.gold,
  growth: Colors.success,
};

const CATEGORY_LABELS: Record<string, string> = {
  connection: "Connection",
  focus: "Focus",
  growth: "Growth",
};

function TaskIcon({ item }: { item: { icon: string; iconFamily: string } }) {
  const size = 20;
  const color = Colors.gold;
  if (item.iconFamily === "Feather") return <Feather name={item.icon as any} size={size} color={color} />;
  if (item.iconFamily === "MaterialCommunity") return <MaterialCommunityIcons name={item.icon as any} size={size} color={color} />;
  return <Ionicons name={item.icon as any} size={size} color={color} />;
}

type ActiveGame = "stroop" | "memory" | "breathing" | "soundscape" | null;

export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set());
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("tasks");

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const data = await AsyncStorage.getItem(`${COMPLETED_KEY}_${today}`);
        if (data) setCompletedToday(new Set(JSON.parse(data)));
      } catch {}
    };
    load();
  }, []);

  const toggleTask = useCallback(
    async (id: string) => {
      if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const today = new Date().toISOString().split("T")[0];
      const next = new Set(completedToday);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCompletedToday(next);
      await AsyncStorage.setItem(`${COMPLETED_KEY}_${today}`, JSON.stringify([...next]));
    },
    [completedToday]
  );

  const toggleSection = useCallback((section: string) => {
    if (nd) Haptics.selectionAsync();
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);

  const openGame = useCallback((game: ActiveGame) => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveGame(game);
  }, []);

  const totalXP = MINDFUL_TASKS.filter((t) => completedToday.has(t.id)).reduce((sum, t) => sum + t.xp, 0);
  const completedCount = completedToday.size;

  if (activeGame) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.black }}>
        <LinearGradient
          colors={[Colors.forestDeep, Colors.forestMid, Colors.black, Colors.black]}
          locations={[0, 0.25, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.gameContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
          {activeGame === "stroop" && <StroopGame onClose={() => setActiveGame(null)} />}
          {activeGame === "memory" && <MemoryGrid onClose={() => setActiveGame(null)} />}
          {activeGame === "breathing" && <BreathingPacer onClose={() => setActiveGame(null)} />}
          {activeGame === "soundscape" && <NeuralSoundscape onClose={() => setActiveGame(null)} />}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialBlue, Colors.forestDeep, Colors.celestialPurple, Colors.black, Colors.black]}
        locations={[0, 0.15, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.nebulaGlow} />
      <View style={styles.starA} />
      <View style={styles.starB} />
      <View style={styles.starC} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NEUROSCIENCE-BACKED TRAINING</Text>
          <Text style={styles.title}>Train Your Mind</Text>
          <Text style={styles.subtitle}>
            Exercises proven to strengthen the prefrontal cortex
          </Text>
        </View>

        <GlassCard style={styles.nebCard} borderColor="rgba(167,139,250,0.15)">
          <LinearGradient
            colors={["rgba(90,61,143,0.08)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.nebRow}>
            <View style={styles.nebItem}>
              <Text style={styles.nebLabel}>Neural Energy</Text>
              <Text style={[styles.nebValue, { color: Colors.empathyGreen }]}>+12%</Text>
            </View>
            <View style={styles.nebDivider} />
            <View style={styles.nebItem}>
              <Text style={styles.nebLabel}>Focus Score</Text>
              <Text style={[styles.nebValue, { color: Colors.mindfulBlue }]}>82%</Text>
            </View>
            <View style={styles.nebDivider} />
            <View style={styles.nebItem}>
              <Text style={styles.nebLabel}>Streak</Text>
              <Text style={[styles.nebValue, { color: Colors.balanceAmber }]}>7d</Text>
            </View>
          </View>
        </GlassCard>

        {/* Daily Progress */}
        <GlassCard style={styles.progressCard} borderColor={Colors.goldAlpha30}>
          <LinearGradient
            colors={[Colors.goldAlpha08, Colors.goldAlpha15]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.progressRow}>
            <View style={styles.progressStat}>
              <Text style={styles.progressNum}>{completedCount}</Text>
              <Text style={styles.progressLabel}>Completed</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressStat}>
              <Text style={styles.progressNum}>{totalXP}</Text>
              <Text style={styles.progressLabel}>XP Earned</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressStat}>
              <Text style={styles.progressNum}>{MINDFUL_TASKS.length + DOPAMINE_BOOSTERS.length}</Text>
              <Text style={styles.progressLabel}>Available</Text>
            </View>
          </View>
        </GlassCard>

        {/* ── MINDFUL TASKS ── */}
        <Pressable onPress={() => toggleSection("tasks")} style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="heart" size={20} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Mindful Tasks</Text>
          </View>
          <Ionicons
            name={expandedSection === "tasks" ? "chevron-up" : "chevron-down"}
            size={20}
            color={Colors.whiteAlpha50}
          />
        </Pressable>

        {expandedSection === "tasks" && (
          <View style={styles.tasksList}>
            {MINDFUL_TASKS.map((task) => {
              const done = completedToday.has(task.id);
              return (
                <Pressable
                  key={task.id}
                  onPress={() => toggleTask(task.id)}
                  style={({ pressed }) => [pressed && { opacity: 0.8 }]}
                >
                  <GlassCard
                    style={[styles.taskCard, done && styles.taskCardDone]}
                    borderColor={done ? Colors.gold : Colors.glassBorder}
                  >
                    {done && (
                      <LinearGradient
                        colors={[Colors.goldAlpha08, "transparent"]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={styles.taskTop}>
                      <View style={[styles.taskIconWrap, done && styles.taskIconDone]}>
                        <TaskIcon item={task} />
                      </View>
                      <View style={styles.taskInfo}>
                        <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>
                          {task.title}
                        </Text>
                        <Text style={styles.taskDesc}>{task.description}</Text>
                      </View>
                      <View style={styles.taskRight}>
                        <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[task.category] + "20" }]}>
                          <Text style={[styles.categoryText, { color: CATEGORY_COLORS[task.category] }]}>
                            {CATEGORY_LABELS[task.category]}
                          </Text>
                        </View>
                        <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                          {done && <Ionicons name="checkmark" size={14} color={Colors.forestDeep} />}
                        </View>
                      </View>
                    </View>
                    <View style={styles.xpRow}>
                      <Ionicons name="flash" size={12} color={Colors.goldDim} />
                      <Text style={styles.xpText}>+{task.xp} XP</Text>
                    </View>
                  </GlassCard>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── DOPAMINE BOOSTERS ── */}
        <Pressable onPress={() => toggleSection("dopamine")} style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="flash" size={20} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Dopamine Boosters</Text>
          </View>
          <Ionicons
            name={expandedSection === "dopamine" ? "chevron-up" : "chevron-down"}
            size={20}
            color={Colors.whiteAlpha50}
          />
        </Pressable>

        {expandedSection === "dopamine" && (
          <View style={styles.tasksList}>
            {DOPAMINE_BOOSTERS.map((booster) => {
              const done = completedToday.has(booster.id);
              return (
                <Pressable
                  key={booster.id}
                  onPress={() => toggleTask(booster.id)}
                  style={({ pressed }) => [pressed && { opacity: 0.8 }]}
                >
                  <GlassCard
                    style={[styles.taskCard, done && styles.taskCardDone]}
                    borderColor={done ? Colors.gold : Colors.glassBorder}
                  >
                    {done && (
                      <LinearGradient
                        colors={[Colors.goldAlpha08, "transparent"]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={styles.taskTop}>
                      <View style={[styles.taskIconWrap, done && styles.taskIconDone]}>
                        <TaskIcon item={booster} />
                      </View>
                      <View style={styles.taskInfo}>
                        <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>
                          {booster.title}
                        </Text>
                        <Text style={styles.taskDesc}>{booster.description}</Text>
                      </View>
                      <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                        {done && <Ionicons name="checkmark" size={14} color={Colors.forestDeep} />}
                      </View>
                    </View>
                    <View style={styles.scienceRow}>
                      <Ionicons name="flask" size={12} color={Colors.whiteAlpha20} />
                      <Text style={styles.scienceText}>{booster.science}</Text>
                    </View>
                  </GlassCard>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── BRAIN GAMES ── */}
        <Pressable onPress={() => toggleSection("games")} style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons name="brain" size={20} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Brain Games</Text>
          </View>
          <Ionicons
            name={expandedSection === "games" ? "chevron-up" : "chevron-down"}
            size={20}
            color={Colors.whiteAlpha50}
          />
        </Pressable>

        {expandedSection === "games" && (
          <View style={styles.tasksList}>
            {BRAIN_GAMES.map((game) => (
              <Pressable
                key={game.id}
                onPress={() => openGame(game.id as ActiveGame)}
                style={({ pressed }) => [pressed && { opacity: 0.8 }]}
              >
                <GlassCard style={styles.gameCard} borderColor={Colors.glassBorder}>
                  <View style={styles.taskTop}>
                    <View style={styles.gameIconWrap}>
                      <TaskIcon item={game} />
                    </View>
                    <View style={styles.taskInfo}>
                      <Text style={styles.taskTitle}>{game.title}</Text>
                      <Text style={styles.taskDesc}>{game.description}</Text>
                    </View>
                    <Ionicons name="play-circle" size={28} color={Colors.gold} />
                  </View>
                  <View style={styles.scienceRow}>
                    <MaterialCommunityIcons name="brain" size={12} color={Colors.whiteAlpha20} />
                    <Text style={styles.scienceText}>{game.science}</Text>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => openGame("soundscape")}
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
        >
          <GlassCard style={styles.audioCard} borderColor="rgba(167,139,250,0.2)" elevated>
            <LinearGradient
              colors={["rgba(90,61,143,0.12)", "rgba(244,114,182,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.audioCardTop}>
              <View style={styles.audioIconWrap}>
                <Text style={{ fontSize: 28 }}>🎧</Text>
              </View>
              <View style={styles.audioCardInfo}>
                <Text style={styles.audioCardEyebrow}>NEURAL AUDIO ENGINE</Text>
                <Text style={styles.audioCardTitle}>Soundscapes</Text>
                <Text style={styles.audioCardSub}>
                  Binaural beats, solfeggio frequencies, and neural noise — calibrated to boost dopamine, focus, and calm
                </Text>
              </View>
              <Ionicons name="play-circle" size={36} color={Colors.neuralPurple} />
            </View>
            <View style={styles.audioTagsRow}>
              {["Alpha 10Hz", "40Hz Gamma", "528Hz", "Brown Noise"].map((tag) => (
                <View key={tag} style={styles.audioTag}>
                  <Text style={styles.audioTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </Pressable>

        <GlassCard style={styles.noteCard}>
          <Feather name="info" size={16} color={Colors.whiteAlpha50} />
          <Text style={styles.noteText}>
            Consistent practice rewires neural pathways through neuroplasticity.
            Even 5 minutes daily strengthens prefrontal cortex connections tied
            to emotional regulation, discipline, and decision-making.
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  nebulaGlow: {
    position: "absolute",
    top: -60,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.cosmicGlow,
    zIndex: 0,
  },
  starA: { position: "absolute", top: 70, left: 40, width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.starlight, opacity: 0.5 },
  starB: { position: "absolute", top: 120, right: 60, width: 2, height: 2, borderRadius: 1, backgroundColor: Colors.champagne, opacity: 0.4 },
  starC: { position: "absolute", top: 200, left: 150, width: 2, height: 2, borderRadius: 1, backgroundColor: Colors.whiteAlpha60, opacity: 0.3 },
  nebCard: {
    padding: 18,
    marginBottom: 12,
    overflow: "hidden",
  },
  nebRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nebItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  nebLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
    letterSpacing: 0.5,
  },
  nebValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
  },
  nebDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.whiteAlpha10,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  gameContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    color: Colors.white,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha30,
    textAlign: "center",
  },
  progressCard: {
    padding: 22,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  progressStat: {
    alignItems: "center",
    gap: 2,
  },
  progressNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.gold,
  },
  progressLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha50,
  },
  progressDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.whiteAlpha10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
  },
  tasksList: {
    gap: 10,
    marginBottom: 8,
  },
  taskCard: {
    padding: 14,
    gap: 8,
    overflow: "hidden",
  },
  taskCardDone: {
    borderColor: Colors.gold,
  },
  taskTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  taskIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.goldAlpha08,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.goldAlpha15,
  },
  taskIconDone: {
    backgroundColor: Colors.goldAlpha30,
    borderColor: Colors.gold,
  },
  taskInfo: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  taskTitleDone: {
    color: Colors.gold,
  },
  taskDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    lineHeight: 17,
  },
  taskRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.whiteAlpha20,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleDone: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 52,
  },
  xpText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.goldDim,
  },
  scienceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginLeft: 52,
  },
  scienceText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    lineHeight: 15,
    fontStyle: "italic",
  },
  gameCard: {
    padding: 14,
    gap: 8,
  },
  gameIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.forestLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.goldAlpha15,
  },
  audioCard: {
    padding: 20,
    gap: 14,
    marginTop: 20,
    overflow: "hidden",
  },
  audioCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  audioIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.neuralPurpleDim,
    alignItems: "center",
    justifyContent: "center",
  },
  audioCardInfo: {
    flex: 1,
    gap: 3,
  },
  audioCardEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.neuralPurple,
    letterSpacing: 2,
  },
  audioCardTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  audioCardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    lineHeight: 16,
  },
  audioTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  audioTag: {
    backgroundColor: Colors.neuralPurpleDim,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  audioTagText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.neuralPurple,
    letterSpacing: 0.5,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 18,
    gap: 12,
    marginTop: 20,
  },
  noteText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    lineHeight: 18,
  },
});
