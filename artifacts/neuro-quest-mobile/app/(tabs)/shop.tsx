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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";

const nd = Platform.OS !== "web";

const PLANS = [
  {
    id: "pro",
    title: "Zen Pro",
    price: "$9.99",
    period: "/month",
    badge: "MOST POPULAR",
    donationNote: "$3.00 of every subscription goes directly to charity",
    features: [
      "Unlimited daily spins",
      "All brain training games unlocked",
      "Priority jackpot access",
      "Exclusive Zen themes & sounds",
      "Monthly cause selection",
      "Advanced progress analytics",
      "Ad-free experience",
    ],
    cta: "Start Zen Pro",
    highlight: true,
  },
  {
    id: "daily",
    title: "Daily Pass",
    price: "$5.00",
    period: "/24 hours",
    badge: null,
    donationNote: "$1.50 donated per pass",
    features: [
      "50 spins for 24 hours",
      "All Zen Pro features for the day",
      "No commitment required",
    ],
    cta: "Get Daily Pass",
    highlight: false,
  },
];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [purchased, setPurchased] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => {
    if (nd) Haptics.selectionAsync();
    setSelectedPlan(id);
  }, []);

  const handlePurchase = useCallback((id: string) => {
    if (nd) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPurchased(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.celestialBlue, Colors.black, Colors.black]}
        locations={[0, 0.12, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.nebulaGlow} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ELEVATE YOUR PRACTICE</Text>
          <Text style={styles.title}>Invest in Your Mind</Text>
          <Text style={styles.subtitle}>
            Every purchase funds real charitable donations to verified partners worldwide
          </Text>
        </View>

        <GlassCard style={styles.impactBanner} borderColor={Colors.goldAlpha20}>
          <LinearGradient
            colors={[Colors.goldAlpha08, Colors.goldAlpha05]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.impactRow}>
            <View style={styles.impactStat}>
              <Text style={styles.impactNum}>$847K</Text>
              <Text style={styles.impactLabel}>Donated from{"\n"}subscriptions</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactStat}>
              <Text style={styles.impactNum}>30%</Text>
              <Text style={styles.impactLabel}>Of revenue to{"\n"}charity</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactStat}>
              <Text style={styles.impactNum}>12</Text>
              <Text style={styles.impactLabel}>Verified{"\n"}partners</Text>
            </View>
          </View>
        </GlassCard>

        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const isPurchased = purchased === plan.id;

          return (
            <Pressable
              key={plan.id}
              onPress={() => handleSelect(plan.id)}
              style={({ pressed }) => [pressed && { opacity: 0.95 }]}
            >
              <GlassCard
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                borderColor={isSelected ? Colors.goldAlpha30 : Colors.glassBorderLight}
                elevated={isSelected}
              >
                {isSelected && (
                  <LinearGradient
                    colors={[Colors.goldAlpha08, Colors.goldAlpha05, "transparent"]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
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
                    <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                      {plan.price}
                    </Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                </View>

                <View style={styles.donationNote}>
                  <View style={styles.donationDot} />
                  <Text style={styles.donationText}>{plan.donationNote}</Text>
                </View>

                <View style={styles.featureDivider} />

                <View style={styles.featuresContainer}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark" size={14} color={Colors.gold} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => handlePurchase(plan.id)}
                  style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                >
                  {isPurchased ? (
                    <View style={styles.activeBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={
                        isSelected
                          ? [Colors.goldLight, Colors.gold, Colors.goldDim]
                          : [Colors.whiteAlpha10, Colors.whiteAlpha05]
                      }
                      style={styles.planButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text
                        style={[
                          styles.planButtonText,
                          !isSelected && styles.planButtonTextAlt,
                        ]}
                      >
                        {plan.cta}
                      </Text>
                    </LinearGradient>
                  )}
                </Pressable>
              </GlassCard>
            </Pressable>
          );
        })}

        <GlassCard style={styles.spinsCard} borderColor={Colors.glassBorderLight}>
          <View style={styles.spinsTop}>
            <View style={styles.spinsIconWrap}>
              <MaterialCommunityIcons name="cards-club" size={24} color={Colors.gold} />
            </View>
            <View style={styles.spinsInfo}>
              <Text style={styles.spinsTitle}>Extra Spins</Text>
              <Text style={styles.spinsDesc}>10 bonus spins · Never expire</Text>
            </View>
            <Pressable
              onPress={() => {
                if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={({ pressed }) => [styles.spinsButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.spinsPrice}>$2.99</Text>
            </Pressable>
          </View>
          <View style={styles.donationNote}>
            <View style={styles.donationDot} />
            <Text style={styles.donationText}>$0.90 donated per purchase</Text>
          </View>
        </GlassCard>

        <Text style={styles.paymentEyebrow}>PAYMENT METHODS</Text>
        <View style={styles.paymentRow}>
          {[
            { icon: "card", label: "Card" },
            { icon: "logo-apple", label: "Apple Pay" },
            { icon: "logo-bitcoin", label: "Bitcoin" },
          ].map((m) => (
            <View key={m.label} style={styles.paymentMethod}>
              <Ionicons name={m.icon as any} size={20} color={Colors.whiteAlpha60} />
              <Text style={styles.paymentLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Subscriptions auto-renew until cancelled. 30% of all revenue is donated
          to verified charity partners. For entertainment & mindfulness only.
          Cancel anytime in App Store settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  nebulaGlow: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.cosmicGlow,
    zIndex: 0,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.goldDim,
    letterSpacing: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: Colors.white,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  impactBanner: {
    padding: 20,
    overflow: "hidden",
  },
  impactRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  impactStat: {
    alignItems: "center",
    gap: 4,
  },
  impactNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.gold,
  },
  impactLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
    textAlign: "center",
    lineHeight: 14,
  },
  impactDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.whiteAlpha10,
  },
  planCard: {
    padding: 24,
    gap: 16,
    overflow: "hidden",
    position: "relative",
  },
  planCardSelected: {},
  badge: {
    position: "absolute",
    top: 18,
    right: 18,
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: Colors.forestDeep,
    letterSpacing: 1,
  },
  planTop: {
    gap: 8,
  },
  planTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.white,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  planPrice: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 40,
    color: Colors.whiteAlpha80,
  },
  planPriceSelected: {
    color: Colors.gold,
  },
  planPeriod: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha30,
    marginBottom: 8,
  },
  donationNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.goldAlpha05,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.goldAlpha10,
  },
  donationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  donationText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.goldRose,
    flex: 1,
  },
  featureDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha05,
  },
  featuresContainer: {
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha80,
    flex: 1,
  },
  planButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 100,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  planButtonText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.forestDeep,
    letterSpacing: 0.5,
  },
  planButtonTextAlt: {
    color: Colors.whiteAlpha60,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.success,
    backgroundColor: "rgba(76, 175, 110, 0.08)",
  },
  activeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.success,
  },
  spinsCard: {
    padding: 20,
    gap: 14,
  },
  spinsTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  spinsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.goldAlpha08,
    borderWidth: 1,
    borderColor: Colors.goldAlpha15,
    alignItems: "center",
    justifyContent: "center",
  },
  spinsInfo: {
    flex: 1,
    gap: 2,
  },
  spinsTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  spinsDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
  },
  spinsButton: {
    backgroundColor: Colors.goldAlpha10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.goldAlpha20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  spinsPrice: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.gold,
  },
  paymentEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.whiteAlpha30,
    letterSpacing: 3,
    textAlign: "center",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
  },
  paymentMethod: {
    alignItems: "center",
    gap: 6,
  },
  paymentLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.whiteAlpha30,
  },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 8,
  },
});
