import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";

const ACHIEVEMENTS = [
  { id: "1", title: "First Jackpot", icon: "trophy", unlocked: true },
  { id: "2", title: "7 Day Streak", icon: "zap", unlocked: true },
  { id: "3", title: "100 Spins", icon: "repeat", unlocked: true },
  { id: "4", title: "Zen Master", icon: "star", unlocked: false },
  { id: "5", title: "Generous Soul", icon: "heart", unlocked: false },
  { id: "6", title: "30 Day Streak", icon: "calendar", unlocked: false },
];

const SETTINGS = [
  { id: "notifications", label: "Daily Reminders", icon: "bell", toggle: true, value: true },
  { id: "haptics", label: "Haptic Feedback", icon: "phone-vibrate", toggle: true, value: true },
  { id: "privacy", label: "Privacy Policy", icon: "shield", toggle: false },
  { id: "terms", label: "Terms of Use", icon: "file-text", toggle: false },
  { id: "support", label: "Contact Support", icon: "message-circle", toggle: false },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(
    SETTINGS.reduce((acc, s) => ({ ...acc, [s.id]: s.value ?? false }), {} as Record<string, boolean>)
  );

  const toggleSetting = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const zenRankProgress = 0.65;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.forestDeep, Colors.black, Colors.black]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <GlassCard style={styles.profileCard} borderColor={Colors.goldAlpha30}>
          <LinearGradient
            colors={[Colors.goldAlpha08, Colors.goldAlpha15]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.avatarRing}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.goldDim]}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarEmoji}>🧘</Text>
            </LinearGradient>
          </View>
          <Text style={styles.profileName}>Compassion Player</Text>
          <View style={styles.rankBadge}>
            <Ionicons name="crown" size={14} color={Colors.forestDeep} />
            <Text style={styles.rankText}>Zen Rank 4</Text>
          </View>
          <Text style={styles.memberSince}>Member since March 2024</Text>
        </GlassCard>

        {/* Zen Rank Progress */}
        <GlassCard style={styles.rankCard}>
          <View style={styles.rankHeader}>
            <Text style={styles.sectionTitle}>Zen Rank Progress</Text>
            <Text style={styles.rankLevel}>Rank 4 → 5</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold]}
              style={[styles.progressFill, { width: `${zenRankProgress * 100}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.progressLabel}>650 / 1000 Compassion Points</Text>
        </GlassCard>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Your Impact</Text>
        <View style={styles.impactGrid}>
          {[
            { label: "Total Donated", value: "$247.50", icon: "heart", iconLib: "Ionicons" },
            { label: "Jackpots Won", value: "23", icon: "trophy", iconLib: "Ionicons" },
            { label: "Day Streak", value: "7", icon: "flame", iconLib: "Ionicons" },
            { label: "Total Spins", value: "184", icon: "repeat", iconLib: "Ionicons" },
          ].map((stat, i) => (
            <GlassCard key={i} style={styles.impactCard}>
              <Ionicons name={stat.icon as any} size={22} color={Colors.gold} />
              <Text style={styles.impactValue}>{stat.value}</Text>
              <Text style={styles.impactLabel}>{stat.label}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Achievements */}
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((a) => (
            <GlassCard
              key={a.id}
              style={[styles.achieveCard, !a.unlocked && styles.achieveCardLocked]}
              borderColor={a.unlocked ? Colors.glassBorder : "rgba(255,255,255,0.05)"}
            >
              <Feather
                name={a.icon as any}
                size={22}
                color={a.unlocked ? Colors.gold : Colors.whiteAlpha20}
              />
              <Text
                style={[styles.achieveTitle, !a.unlocked && styles.achieveTitleLocked]}
              >
                {a.title}
              </Text>
              {!a.unlocked && (
                <Ionicons name="lock-closed" size={12} color={Colors.whiteAlpha20} />
              )}
            </GlassCard>
          ))}
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <GlassCard style={styles.settingsCard}>
          {SETTINGS.map((s, i) => (
            <View key={s.id}>
              <Pressable
                onPress={() => s.toggle ? toggleSetting(s.id) : null}
                style={({ pressed }) => [
                  styles.settingRow,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name={s.icon as any} size={18} color={Colors.whiteAlpha80} />
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

        {/* Version */}
        <Text style={styles.version}>NeuroQuest v1.0.0 · For entertainment only</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  profileCard: {
    padding: 28,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  avatarRing: {
    borderRadius: 50,
    padding: 3,
    borderWidth: 2,
    borderColor: Colors.gold,
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
    fontSize: 24,
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
    fontSize: 13,
    color: Colors.forestDeep,
  },
  memberSince: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha50,
    marginTop: 2,
  },
  rankCard: {
    padding: 18,
    gap: 10,
  },
  rankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rankLevel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.gold,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.whiteAlpha10,
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
    color: Colors.whiteAlpha50,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
  },
  impactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  impactCard: {
    width: "47%",
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  impactValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  impactLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha50,
    textAlign: "center",
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
  },
  achieveCardLocked: {
    opacity: 0.5,
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
    padding: 16,
  },
  settingLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.white,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 100,
    backgroundColor: Colors.whiteAlpha20,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: Colors.forest,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha50,
  },
  toggleKnobOn: {
    backgroundColor: Colors.gold,
    alignSelf: "flex-end",
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
    marginHorizontal: 16,
  },
  version: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    textAlign: "center",
  },
});
