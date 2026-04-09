import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Colors from "@/constants/colors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderColor?: string;
  intensity?: number;
  elevated?: boolean;
}

export function GlassCard({
  children,
  style,
  borderColor = Colors.glassBorder,
  intensity = 50,
  elevated = false,
}: GlassCardProps) {
  const cardStyles = [
    styles.card,
    elevated ? styles.elevated : undefined,
    { borderColor } as ViewStyle,
    style,
  ];

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={intensity}
        tint="dark"
        style={cardStyles}
      >
        <View style={styles.inner}>{children}</View>
      </BlurView>
    );
  }

  return (
    <View style={[...cardStyles, styles.androidCard]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  inner: {
    flex: 1,
  },
  androidCard: {
    backgroundColor: Colors.glass,
  },
});
