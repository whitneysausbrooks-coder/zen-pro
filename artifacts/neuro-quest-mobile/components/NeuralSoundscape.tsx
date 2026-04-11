import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";
import {
  useNeuralAudio,
  NEURAL_PRESETS,
  type NeuralPreset,
} from "@/hooks/useNeuralAudio";
import * as Haptics from "expo-haptics";

const nd = Platform.OS !== "web";

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  binaural: {
    label: "BINAURAL BEATS",
    icon: "headphones",
    desc: "Two frequencies create a perceived beat that entrains brainwaves",
  },
  gamma: {
    label: "GAMMA ENTRAINMENT",
    icon: "zap",
    desc: "MIT-researched 40Hz stimulation for cognitive enhancement",
  },
  solfeggio: {
    label: "SOLFEGGIO FREQUENCIES",
    icon: "music",
    desc: "Ancient healing tones mapped to specific cellular responses",
  },
  ambient: {
    label: "NEURAL NOISE",
    icon: "cloud",
    desc: "Spectral noise patterns that optimize neural oscillations",
  },
};

interface Props {
  onClose: () => void;
}

export function NeuralSoundscape({ onClose }: Props) {
  const audio = useNeuralAudio();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: nd }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, useNativeDriver: nd }),
      ])
    );
    pulse.start();

    const wave = Animated.loop(
      Animated.timing(waveAnim, { toValue: 1, duration: 4000, useNativeDriver: nd })
    );
    wave.start();

    return () => {
      pulse.stop();
      wave.stop();
      audio.stop();
    };
  }, []);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const pulseOp = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const handleToggle = useCallback(
    (presetId: string) => {
      if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      audio.toggle(presetId);
    },
    [audio]
  );

  const handleExpand = useCallback((id: string) => {
    if (nd) Haptics.selectionAsync();
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const categories = ["binaural", "gamma", "solfeggio", "ambient"] as const;
  const activePresetData = audio.activePreset
    ? NEURAL_PRESETS.find((p) => p.id === audio.activePreset)
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topEyebrow}>NEURAL AUDIO ENGINE</Text>
          <Text style={styles.topTitle}>Soundscapes</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {audio.isPlaying && activePresetData && (
        <GlassCard style={styles.nowPlaying} borderColor={activePresetData.color + "40"} elevated>
          <LinearGradient
            colors={[activePresetData.color + "15", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.npLeft}>
            <Animated.View
              style={[
                styles.npPulse,
                {
                  backgroundColor: activePresetData.color + "30",
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOp,
                },
              ]}
            />
            <View style={[styles.npDot, { backgroundColor: activePresetData.color }]} />
          </View>
          <View style={styles.npInfo}>
            <Text style={styles.npName}>{activePresetData.name}</Text>
            <Text style={styles.npDesc}>{activePresetData.description}</Text>
          </View>
          <Pressable onPress={() => audio.stop()} style={styles.npStop}>
            <Ionicons name="stop-circle" size={32} color={activePresetData.color} />
          </Pressable>
        </GlassCard>
      )}

      {audio.isPlaying && (
        <View style={styles.volumeRow}>
          <Feather name="volume-1" size={16} color={Colors.whiteAlpha30} />
          <View style={styles.volumeTrack}>
            <View
              style={[styles.volumeFill, { width: `${audio.volume * 100}%` }]}
            />
            <Pressable
              style={[styles.volumeKnob, { left: `${audio.volume * 100}%` }]}
              onPress={() => {}}
            />
          </View>
          <Feather name="volume-2" size={16} color={Colors.whiteAlpha30} />
          <View style={styles.volumeButtons}>
            <Pressable
              onPress={() => audio.updateVolume(Math.max(0, audio.volume - 0.1))}
              style={styles.volBtn}
            >
              <Feather name="minus" size={14} color={Colors.whiteAlpha50} />
            </Pressable>
            <Text style={styles.volText}>{Math.round(audio.volume * 100)}%</Text>
            <Pressable
              onPress={() => audio.updateVolume(Math.min(1, audio.volume + 0.1))}
              style={styles.volBtn}
            >
              <Feather name="plus" size={14} color={Colors.whiteAlpha50} />
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <GlassCard style={styles.scienceCard} borderColor="rgba(167,139,250,0.15)">
          <LinearGradient
            colors={["rgba(90,61,143,0.08)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <MaterialCommunityIcons name="brain" size={20} color={Colors.neuralPurple} />
          <Text style={styles.scienceTitle}>Neuroscience-Backed Audio</Text>
          <Text style={styles.scienceBody}>
            Each frequency is calibrated to specific neural pathways. Binaural beats
            require headphones — two slightly different frequencies in each ear create
            a perceived beat that entrains your brainwaves to the target frequency.
          </Text>
          <View style={styles.scienceTip}>
            <Ionicons name="headset" size={14} color={Colors.gold} />
            <Text style={styles.scienceTipText}>
              Use headphones for binaural beats & gamma
            </Text>
          </View>
        </GlassCard>

        {categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const presets = NEURAL_PRESETS.filter((p) => p.category === cat);
          return (
            <View key={cat} style={styles.categorySection}>
              <View style={styles.catHeader}>
                <Feather name={meta.icon as any} size={16} color={Colors.goldDim} />
                <Text style={styles.catLabel}>{meta.label}</Text>
              </View>
              <Text style={styles.catDesc}>{meta.desc}</Text>
              {presets.map((preset) => {
                const isActive = audio.activePreset === preset.id;
                const isExpanded = expandedId === preset.id;
                return (
                  <View key={preset.id}>
                    <Pressable
                      onPress={() => handleToggle(preset.id)}
                      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                    >
                      <GlassCard
                        style={[styles.presetCard, isActive && styles.presetCardActive]}
                        borderColor={isActive ? preset.color + "40" : Colors.glassBorderLight}
                      >
                        {isActive && (
                          <LinearGradient
                            colors={[preset.color + "12", "transparent"]}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        <View style={styles.presetRow}>
                          <View style={styles.presetLeft}>
                            <View style={[styles.presetIconWrap, { backgroundColor: preset.color + "20" }]}>
                              <Text style={styles.presetIcon}>{preset.icon}</Text>
                            </View>
                            <View style={styles.presetInfo}>
                              <Text style={styles.presetName}>{preset.name}</Text>
                              <Text style={styles.presetDesc}>{preset.description}</Text>
                            </View>
                          </View>
                          <View style={styles.presetRight}>
                            {isActive ? (
                              <View style={[styles.playBtn, { backgroundColor: preset.color + "25", borderColor: preset.color + "40" }]}>
                                <Animated.View
                                  style={[
                                    styles.playingPulse,
                                    {
                                      backgroundColor: preset.color + "40",
                                      transform: [{ scale: pulseScale }],
                                    },
                                  ]}
                                />
                                <View style={styles.playingBars}>
                                  <View style={[styles.bar, styles.bar1, { backgroundColor: preset.color }]} />
                                  <View style={[styles.bar, styles.bar2, { backgroundColor: preset.color }]} />
                                  <View style={[styles.bar, styles.bar3, { backgroundColor: preset.color }]} />
                                  <View style={[styles.bar, styles.bar4, { backgroundColor: preset.color }]} />
                                </View>
                              </View>
                            ) : (
                              <View style={styles.playBtn}>
                                <Ionicons name="play" size={18} color={Colors.whiteAlpha60} />
                              </View>
                            )}
                          </View>
                        </View>
                        {preset.baseFreq > 0 && (
                          <View style={styles.freqRow}>
                            <View style={[styles.freqTag, { backgroundColor: preset.color + "15" }]}>
                              <Text style={[styles.freqText, { color: preset.color }]}>
                                {preset.baseFreq}Hz
                                {preset.beatFreq ? ` + ${preset.beatFreq}Hz beat` : ""}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => handleExpand(preset.id)}
                              hitSlop={8}
                            >
                              <Text style={styles.scienceLink}>
                                {isExpanded ? "Hide science" : "See science"}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                        {!preset.baseFreq && (
                          <View style={styles.freqRow}>
                            <View style={[styles.freqTag, { backgroundColor: preset.color + "15" }]}>
                              <Text style={[styles.freqText, { color: preset.color }]}>
                                {preset.id === "brown_noise" ? "1/f² spectrum" : "1/f spectrum"}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => handleExpand(preset.id)}
                              hitSlop={8}
                            >
                              <Text style={styles.scienceLink}>
                                {isExpanded ? "Hide science" : "See science"}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </GlassCard>
                    </Pressable>
                    {isExpanded && (
                      <GlassCard style={styles.scienceExpandCard} borderColor={preset.color + "20"}>
                        <LinearGradient
                          colors={[preset.color + "08", "transparent"]}
                          style={StyleSheet.absoluteFill}
                        />
                        <Ionicons name="flask" size={14} color={preset.color} />
                        <Text style={styles.scienceExpandText}>{preset.science}</Text>
                      </GlassCard>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        <GlassCard style={styles.tipCard} borderColor={Colors.goldAlpha15}>
          <LinearGradient
            colors={[Colors.goldAlpha05, "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.tipEyebrow}>PRO TIPS</Text>
          {[
            "Use binaural beats during deep work or meditation for 20-30 min",
            "Stack with brain games: play Alpha Flow during Pattern Match",
            "Try 528Hz after cold exposure for amplified neurogenesis",
            "Pink noise before sleep enhances memory consolidation",
            "40Hz Gamma during learning sessions boosts retention",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha05,
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    alignItems: "center",
  },
  topEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: Colors.neuralPurple,
    letterSpacing: 3,
  },
  topTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  nowPlaying: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 14,
    overflow: "hidden",
  },
  npLeft: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  npPulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  npDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  npInfo: {
    flex: 1,
    gap: 2,
  },
  npName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  npDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  npStop: {
    padding: 4,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 12,
    gap: 10,
  },
  volumeTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.whiteAlpha10,
    borderRadius: 100,
    position: "relative",
  },
  volumeFill: {
    height: "100%",
    backgroundColor: Colors.gold,
    borderRadius: 100,
  },
  volumeKnob: {
    position: "absolute",
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    marginLeft: -8,
  },
  volumeButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  volBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: "center",
    justifyContent: "center",
  },
  volText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.whiteAlpha50,
    width: 30,
    textAlign: "center",
  },
  scienceCard: {
    padding: 20,
    gap: 10,
    overflow: "hidden",
  },
  scienceTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.white,
  },
  scienceBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    lineHeight: 20,
  },
  scienceTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.goldAlpha08,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scienceTipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.goldRose,
  },
  categorySection: {
    gap: 8,
    marginTop: 8,
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  catLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
  },
  catDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    marginBottom: 4,
  },
  presetCard: {
    padding: 16,
    gap: 10,
    overflow: "hidden",
  },
  presetCardActive: {},
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  presetLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  presetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  presetIcon: {
    fontSize: 22,
  },
  presetInfo: {
    flex: 1,
    gap: 2,
  },
  presetName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  presetDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  presetRight: {},
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  playingPulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  playingBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 16,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
  bar1: { height: 8 },
  bar2: { height: 14 },
  bar3: { height: 10 },
  bar4: { height: 6 },
  freqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  freqTag: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  freqText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  scienceLink: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.whiteAlpha30,
    textDecorationLine: "underline",
  },
  scienceExpandCard: {
    padding: 16,
    gap: 8,
    marginTop: -4,
    overflow: "hidden",
  },
  scienceExpandText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha60,
    lineHeight: 19,
  },
  tipCard: {
    padding: 22,
    gap: 12,
    marginTop: 8,
    overflow: "hidden",
  },
  tipEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 3,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.gold,
    marginTop: 5,
  },
  tipText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha50,
    lineHeight: 19,
  },
});
