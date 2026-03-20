import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
import Colors from "@/constants/colors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  borderColor?: string;
  intensity?: number;
}

export function GlassCard({
  children,
  style,
  borderColor = Colors.glassBorder,
  intensity = 40,
}: GlassCardProps) {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.card, { borderColor }, style]}
      >
        <View style={styles.inner}>{children}</View>
      </BlurView>
    );
  }

  return (
    <View
      style={[
        styles.card,
        styles.androidCard,
        { borderColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  inner: {
    flex: 1,
  },
  androidCard: {
    backgroundColor: Colors.glass,
  },
});
