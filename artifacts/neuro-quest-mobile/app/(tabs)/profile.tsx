import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");
const nd = Platform.OS !== "web";

const ACHIEVEMENTS = [
  { id: "1", title: "First Jackpot", icon: "award", unlocked: true },
  { id: "2", title: "7 Day Streak", icon: "zap", unlocked: true },
  { id: "3", title: "100 Spins", icon: "repeat", unlocked: true },
  { id: "4", title: "Zen Master", icon: "star", unlocked: false },
  { id: "5", title: "Generous Soul", icon: "heart", unlocked: false },
  { id: "6", title: "30 Day Streak", icon: "calendar", unlocked: false },
];

const SETTINGS = [
  { id: "notifications", label: "Daily Reminders", icon: "bell", toggle: true, value: true },
  { id: "haptics", label: "Haptic Feedback", icon: "smartphone", toggle: true, value: true },
  { id: "privacy", label: "Privacy Policy", icon: "shield", toggle: false },
  { id: "terms", label: "Terms of Use", icon: "file-text", toggle: false },
  { id: "support", label: "Contact Support", icon: "message-circle", toggle: false },
];

const EMPATHY_DIMS = [
  { label: "Compassion", value: 0.89, color: Colors.compassionPink },
  { label: "Connection", value: 0.82, color: Colors.empathyGreen },
  { label: "Mindfulness", value: 0.91, color: Colors.mindfulBlue },
  { label: "Listening", value: 0.76, color: Colors.neuralPurple },
  { label: "Emotional Safety", value: 0.84, color: Colors.balanceAmber },
  { label: "Shared Purpose", value: 0.78, color: Colors.gold },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(
    SETTINGS.reduce((acc, s) => ({ ...acc, [s.id]: s.value ?? false }), {} as Record<string, boolean>)
  );
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const starAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: nd }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2500, useNativeDriver: nd }),
      ])
    );
    pulse.start();
    const stars = Animated.loop(
      Animated.sequence([
        Animated.timing(starAnim, { toValue: 1, duration: 3000, useNativeDriver: nd }),
        Animated.timing(starAnim, { toValue: 0, duration: 3000, useNativeDriver: nd }),
      ])
    );
    stars.start();
    return () => { pulse.stop(); stars.stop(); };
  }, []);

  const toggleSetting = useCallback((id: string) => {
    if (nd) Haptics.selectionAsync();
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleShare = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message:
          "My NeuroQuest Profile 🧠✨\n\n" +
          "Zen Rank: 4 • HBHS: 100.0\n" +
          "Empathy Index: 87% (+14% this week)\n" +
          "$247.50 donated to charity\n" +
          "15 trees • 23 meals • 2 students funded\n\n" +
          "Train your mind. Change the world.\n" +
          "neuroquest.app",
        title: "My NeuroQuest Profile",
      });
    } catch {}
  }, []);

  const zenRankProgress = 0.65;
  const starOp = starAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.8] });
  const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.celestialBlue, Colors.black, Colors.black]}
        locations={[0, 0.15, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.starField, { opacity: starOp }]}>
        <View style={[styles.star, { top: 50, left: 25 }]} />
        <View style={[styles.starSm, { top: 80, right: 40 }]} />
        <View style={[styles.star, { top: 130, left: width * 0.5 }]} />
        <View style={[styles.starSm, { top: 30, left: width * 0.7 }]} />
        <View style={[styles.starTn, { top: 100, left: 100 }]} />
      </Animated.View>
      <View style={styles.nebulaGlow} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.profileCard} borderColor={Colors.goldAlpha20} elevated>
          <LinearGradient
            colors={["rgba(90,61,143,0.08)", Colors.goldAlpha05, "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <Animated.View style={[styles.avatarRing, { transform: [{ scale: ringScale }] }]}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarEmoji}>🧘</Text>
            </LinearGradient>
          </Animated.View>
          <Text style={styles.profileName}>Compassion Player</Text>
          <View style={styles.rankBadge}>
            <MaterialCommunityIcons name="crown" size={12} color={Colors.forestDeep} />
            <Text style={styles.rankText}>Zen Rank 4</Text>
          </View>
          <Text style={styles.memberSince}>Member since March 2024</Text>
          <Pressable onPress={handleShare} style={styles.shareProfileBtn}>
            <Feather name="share-2" size={14} color={Colors.neuralPurple} />
            <Text style={styles.shareProfileText}>Share Profile</Text>
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.rankCard} borderColor={Colors.glassBorderLight}>
          <View style={styles.rankHeader}>
            <Text style={styles.cardEyebrow}>ZEN RANK PROGRESS</Text>
            <Text style={styles.rankLevel}>4 → 5</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold]}
              style={[styles.progressFill, { width: `${zenRankProgress * 100}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.progressLabel}>650 / 1,000 Compassion Points</Text>
        </GlassCard>

        <GlassCard style={styles.hbhsCard} borderColor="rgba(244,114,182,0.2)" elevated>
          <LinearGradient
            colors={["rgba(244,114,182,0.06)", "rgba(167,139,250,0.06)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.cardEyebrowPink}>HEART-BRAIN HYBRID SCORE</Text>
          <View style={styles.hbhsRow}>
            <Text style={styles.hbhsValue}>100.0</Text>
            <View style={styles.hbhsTag}>
              <Text style={styles.hbhsTagText}>HBHS</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.hbhsDelta}>
              <Ionicons name="trending-up" size={14} color={Colors.empathyGreen} />
              <Text style={styles.hbhsDeltaText}>+14%</Text>
            </View>
          </View>
          <View style={styles.neuralRow}>
            <View style={[styles.neuralPill, { backgroundColor: Colors.empathyGreenDim }]}>
              <Text style={styles.neuralPillLabel}>EI</Text>
              <Text style={[styles.neuralPillVal, { color: Colors.empathyGreen }]}>75%</Text>
            </View>
            <View style={[styles.neuralPill, { backgroundColor: Colors.mindfulBlueDim }]}>
              <Text style={styles.neuralPillLabel}>MP</Text>
              <Text style={[styles.neuralPillVal, { color: Colors.mindfulBlue }]}>82%</Text>
            </View>
            <View style={[styles.neuralPill, { backgroundColor: Colors.balanceAmberDim }]}>
              <Text style={styles.neuralPillLabel}>NEB</Text>
              <Text style={[styles.neuralPillVal, { color: Colors.balanceAmber }]}>680</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.empathyCard} borderColor="rgba(167,139,250,0.15)" elevated>
          <LinearGradient
            colors={["rgba(90,61,143,0.08)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.empathyHead}>
            <Text style={styles.cardEyebrowPurple}>EMPATHY INDEX</Text>
            <View style={styles.empathyBadge}>
              <Text style={styles.empathyBadgeText}>87%</Text>
            </View>
          </View>
          <View style={styles.empathyBars}>
            {EMPATHY_DIMS.map((d) => (
              <View key={d.label} style={styles.empathyBarRow}>
                <Text style={styles.empathyBarLabel}>{d.label}</Text>
                <View style={styles.empathyBarTrack}>
                  <View style={[styles.empathyBarFill, { width: `${d.value * 100}%`, backgroundColor: d.color }]} />
                </View>
                <Text style={[styles.empathyBarVal, { color: d.color }]}>{Math.round(d.value * 100)}%</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <Text style={styles.sectionEyebrow}>YOUR IMPACT</Text>
        <Text style={styles.sectionTitle}>Making a difference</Text>
        <View style={styles.impactGrid}>
          {[
            { label: "Total Donated", value: "$247.50", icon: "heart" },
            { label: "Jackpots Won", value: "23", icon: "trophy" },
            { label: "Day Streak", value: "7", icon: "flame" },
            { label: "Total Spins", value: "184", icon: "repeat" },
            { label: "Games Played", value: "62", icon: "game-controller" },
            { label: "Tasks Done", value: "41", icon: "checkmark-done" },
          ].map((stat, i) => (
            <GlassCard key={i} style={styles.impactCard} borderColor={Colors.glassBorderLight}>
              <Ionicons name={stat.icon as any} size={20} color={Colors.gold} />
              <Text style={styles.impactValue}>{stat.value}</Text>
              <Text style={styles.impactLabel}>{stat.label}</Text>
            </GlassCard>
          ))}
        </View>

        <Text style={styles.sectionEyebrow}>LIVES IMPACTED</Text>
        <Text style={styles.sectionTitle}>Your real-world footprint</Text>
        <View style={styles.livesRow}>
          {[
            { icon: "🌳", val: "15", label: "Trees", color: Colors.empathyGreen },
            { icon: "🍽️", val: "23", label: "Meals", color: Colors.balanceAmber },
            { icon: "📖", val: "2", label: "Students", color: Colors.mindfulBlue },
            { icon: "🧘", val: "0.5", label: "Sessions", color: Colors.neuralPurple },
          ].map((l, i) => (
            <View key={i} style={styles.livesItem}>
              <Text style={styles.livesIcon}>{l.icon}</Text>
              <Text style={[styles.livesVal, { color: l.color }]}>{l.val}</Text>
              <Text style={styles.livesLabel}>{l.label}</Text>
            </View>
          ))}
        </View>

        <GlassCard style={styles.charityCard} borderColor={Colors.goldAlpha20}>
          <LinearGradient
            colors={[Colors.goldAlpha05, "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.charityHeader}>
            <Ionicons name="heart" size={20} color={Colors.gold} />
            <Text style={styles.charityTitle}>Your Charity Impact</Text>
          </View>
          <View style={styles.charityBreakdown}>
            {[
              { cause: "End Hunger", amount: "$98.50", percent: "40%" },
              { cause: "Clean Water", amount: "$62.00", percent: "25%" },
              { cause: "Climate Action", amount: "$49.50", percent: "20%" },
              { cause: "Education", amount: "$37.50", percent: "15%" },
            ].map((item, i) => (
              <View key={i} style={styles.charityRow}>
                <View style={styles.charityRowLeft}>
                  <View style={styles.charityDot} />
                  <Text style={styles.charityCause}>{item.cause}</Text>
                </View>
                <View style={styles.charityRowRight}>
                  <Text style={styles.charityAmount}>{item.amount}</Text>
                  <Text style={styles.charityPercent}>{item.percent}</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        <Pressable onPress={handleShare} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
          <GlassCard style={styles.shareImpactCard} borderColor="rgba(167,139,250,0.2)">
            <LinearGradient
              colors={["rgba(167,139,250,0.08)", "rgba(244,114,182,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Feather name="share-2" size={22} color={Colors.neuralPurple} />
            <View style={styles.shareImpactText}>
              <Text style={styles.shareImpactTitle}>Share Your Journey</Text>
              <Text style={styles.shareImpactSub}>Let friends see your impact and inspire change</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.whiteAlpha30} />
          </GlassCard>
        </Pressable>

        <Text style={styles.sectionEyebrow}>ACHIEVEMENTS</Text>
        <Text style={styles.sectionTitle}>Milestones</Text>
        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((a) => (
            <GlassCard
              key={a.id}
              style={[styles.achieveCard, !a.unlocked && styles.achieveCardLocked]}
              borderColor={a.unlocked ? Colors.goldAlpha15 : Colors.whiteAlpha05}
            >
              {a.unlocked && (
                <LinearGradient
                  colors={[Colors.goldAlpha08, "transparent"]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Feather
                name={a.icon as any}
                size={22}
                color={a.unlocked ? Colors.gold : Colors.whiteAlpha20}
              />
              <Text style={[styles.achieveTitle, !a.unlocked && styles.achieveTitleLocked]}>
                {a.title}
              </Text>
              {!a.unlocked && (
                <Ionicons name="lock-closed" size={10} color={Colors.whiteAlpha20} />
              )}
            </GlassCard>
          ))}
        </View>

        <Text style={styles.sectionEyebrow}>SETTINGS</Text>
        <GlassCard style={styles.settingsCard} borderColor={Colors.glassBorderLight}>
          {SETTINGS.map((s, i) => (
            <View key={s.id}>
              <Pressable
                onPress={() => (s.toggle ? toggleSetting(s.id) : null)}
                style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
              >
                <Feather name={s.icon as any} size={18} color={Colors.whiteAlpha60} />
                <Text style={styles.settingLabel}>{s.label}</Text>
                {s.toggle ? (
                  <View style={[styles.toggle, settings[s.id] && styles.toggleOn]}>
                    <View style={[styles.toggleKnob, settings[s.id] && styles.toggleKnobOn]} />
                  </View>
                ) : (
                  <Feather name="chevron-right" size={16} color={Colors.whiteAlpha20} />
                )}
              </Pressable>
              {i < SETTINGS.length - 1 && <View style={styles.settingDivider} />}
            </View>
          ))}
        </GlassCard>

        <Text style={styles.version}>NeuroQuest v1.0.0 · Made with purpose</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  starField: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  star: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.starlight,
  },
  starSm: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.champagne,
  },
  starTn: {
    position: "absolute",
    width: 1.5,
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: Colors.whiteAlpha60,
  },
  nebulaGlow: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.cosmicGlow,
  },
  sectionEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  cardEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 2,
  },
  cardEyebrowPink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.compassionPink,
    letterSpacing: 3,
  },
  cardEyebrowPurple: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.neuralPurple,
    letterSpacing: 3,
  },
  profileCard: {
    padding: 32,
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  avatarRing: {
    borderRadius: 50,
    padding: 3,
    borderWidth: 2,
    borderColor: Colors.goldAlpha30,
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 40,
  },
  profileName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: Colors.white,
  },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  rankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.forestDeep,
    letterSpacing: 0.5,
  },
  memberSince: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    marginTop: 2,
  },
  shareProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    backgroundColor: Colors.neuralPurpleDim,
  },
  shareProfileText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.neuralPurple,
  },
  rankCard: {
    padding: 20,
    gap: 12,
  },
  rankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rankLevel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.gold,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 100,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 100,
  },
  progressLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
  },
  hbhsCard: {
    padding: 22,
    gap: 12,
    overflow: "hidden",
  },
  hbhsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  hbhsValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 42,
    color: Colors.white,
  },
  hbhsTag: {
    backgroundColor: Colors.compassionPinkDim,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hbhsTagText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: Colors.compassionPink,
    letterSpacing: 2,
  },
  hbhsDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hbhsDeltaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.empathyGreen,
  },
  neuralRow: {
    flexDirection: "row",
    gap: 8,
  },
  neuralPill: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 2,
  },
  neuralPillLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    letterSpacing: 1,
  },
  neuralPillVal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
  },
  empathyCard: {
    padding: 22,
    gap: 14,
    overflow: "hidden",
  },
  empathyHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  empathyBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.empathyGreenDim,
    alignItems: "center",
    justifyContent: "center",
  },
  empathyBadgeText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: Colors.empathyGreen,
  },
  empathyBars: {
    gap: 8,
  },
  empathyBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  empathyBarLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha50,
    width: 85,
    textAlign: "right",
  },
  empathyBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 100,
    overflow: "hidden",
  },
  empathyBarFill: {
    height: "100%",
    borderRadius: 100,
  },
  empathyBarVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    width: 30,
  },
  impactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  impactCard: {
    width: "47%",
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  impactValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.white,
  },
  impactLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  livesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  livesItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  livesIcon: {
    fontSize: 24,
  },
  livesVal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
  },
  livesLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    letterSpacing: 0.3,
  },
  charityCard: {
    padding: 22,
    gap: 16,
    overflow: "hidden",
  },
  charityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  charityTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  charityBreakdown: {
    gap: 12,
  },
  charityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charityRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  charityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  charityCause: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.whiteAlpha80,
  },
  charityRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  charityAmount: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: Colors.gold,
  },
  charityPercent: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  shareImpactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 14,
    overflow: "hidden",
  },
  shareImpactText: {
    flex: 1,
    gap: 2,
  },
  shareImpactTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  shareImpactSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  achieveCard: {
    width: "30%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 6,
    overflow: "hidden",
  },
  achieveCardLocked: {
    opacity: 0.4,
  },
  achieveTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.white,
    textAlign: "center",
  },
  achieveTitleLocked: {
    color: Colors.whiteAlpha50,
  },
  settingsCard: {
    padding: 4,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
  },
  settingLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.whiteAlpha90,
  },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: 100,
    backgroundColor: Colors.whiteAlpha10,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: Colors.forestLight,
    borderWidth: 1,
    borderColor: Colors.goldAlpha30,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.whiteAlpha30,
  },
  toggleKnobOn: {
    backgroundColor: Colors.gold,
    alignSelf: "flex-end",
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha05,
    marginHorizontal: 18,
  },
  version: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    textAlign: "center",
    marginTop: 8,
  },
});
