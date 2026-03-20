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

const PLANS = [
  {
    id: "pro",
    title: "Zen Pro",
    price: "$9.99",
    period: "/month",
    badge: "Most Popular",
    color: Colors.gold,
    features: [
      "Unlimited daily spins",
      "Priority jackpot access",
      "Exclusive Zen themes",
      "Monthly cause selection",
      "Progress analytics",
      "Ad-free experience",
    ],
    cta: "Start Zen Pro",
  },
  {
    id: "daily",
    title: "Daily Pass",
    price: "$5.00",
    period: "/24 hours",
    badge: null,
    color: Colors.whiteAlpha80,
    features: [
      "50 spins for 24 hours",
      "All Zen Pro features",
      "Perfect for daily sessions",
    ],
    cta: "Get Daily Pass",
  },
];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [purchased, setPurchased] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedPlan(id);
  }, []);

  const handlePurchase = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPurchased(id);
    },
    []
  );

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
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="crown" size={36} color={Colors.gold} />
          <Text style={styles.title}>Upgrade Your Practice</Text>
          <Text style={styles.subtitle}>
            Every purchase funds real charitable donations
          </Text>
        </View>

        {/* Plans */}
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const isPurchased = purchased === plan.id;

          return (
            <Pressable
              key={plan.id}
              onPress={() => handleSelect(plan.id)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <GlassCard
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                borderColor={isSelected ? Colors.gold : Colors.glassBorder}
              >
                {isSelected && (
                  <LinearGradient
                    colors={[Colors.goldAlpha08, Colors.goldAlpha15, Colors.goldAlpha08]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                {plan.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                )}

                <View style={styles.planTop}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.planPrice, { color: plan.color }]}>
                      {plan.price}
                    </Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.featuresContainer}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.gold} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => handlePurchase(plan.id)}
                  style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient
                    colors={
                      isPurchased
                        ? [Colors.success, "#3A8A55"]
                        : [Colors.goldLight, Colors.gold, Colors.goldDim]
                    }
                    style={styles.planButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {isPurchased ? (
                      <>
                        <Ionicons name="checkmark" size={18} color={Colors.forestDeep} />
                        <Text style={styles.planButtonText}>Active</Text>
                      </>
                    ) : (
                      <Text style={styles.planButtonText}>{plan.cta}</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </GlassCard>
            </Pressable>
          );
        })}

        {/* Extra Spins */}
        <GlassCard style={styles.spinsCard}>
          <View style={styles.spinsLeft}>
            <MaterialCommunityIcons name="cards-club" size={28} color={Colors.gold} />
            <View>
              <Text style={styles.spinsTitle}>Extra Spins</Text>
              <Text style={styles.spinsDesc}>10 bonus spins, no expiry</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={({ pressed }) => [styles.spinsButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.spinsPrice}>$2.99</Text>
          </Pressable>
        </GlassCard>

        {/* Payment Methods */}
        <GlassCard style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment Methods</Text>
          <View style={styles.paymentMethods}>
            {[
              { icon: "card", label: "Card" },
              { icon: "logo-apple", label: "Apple Pay" },
              { icon: "logo-bitcoin", label: "Bitcoin" },
            ].map((method) => (
              <View key={method.label} style={styles.paymentMethod}>
                <Ionicons name={method.icon as any} size={22} color={Colors.whiteAlpha80} />
                <Text style={styles.paymentLabel}>{method.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Subscriptions auto-renew until cancelled. Purchases fund charitable
          donations. For entertainment only. Cancel anytime in App Store settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    textAlign: "center",
  },
  planCard: {
    padding: 22,
    gap: 14,
    overflow: "hidden",
    position: "relative",
  },
  planCardSelected: {
    borderColor: Colors.gold,
  },
  badge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: Colors.forestDeep,
    letterSpacing: 0.5,
  },
  planTop: {
    gap: 4,
  },
  planTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  planPrice: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
  },
  planPeriod: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
  },
  featuresContainer: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha80,
    flex: 1,
  },
  planButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 100,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  planButtonText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.forestDeep,
  },
  spinsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  spinsLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  spinsTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  spinsDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha50,
  },
  spinsButton: {
    backgroundColor: Colors.goldAlpha15,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  spinsPrice: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.gold,
  },
  paymentCard: {
    padding: 18,
    gap: 14,
  },
  paymentTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    letterSpacing: 1,
  },
  paymentMethods: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  paymentMethod: {
    alignItems: "center",
    gap: 6,
  },
  paymentLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.whiteAlpha80,
  },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    textAlign: "center",
    lineHeight: 16,
  },
});
