import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { AdaptyPaywallProduct } from "react-native-adapty";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";
import {
  getProPlacement,
  isAdaptySupported,
  purchaseProduct,
  restorePurchases,
} from "@/lib/adapty";

const PRODUCT_MAP: Record<string, string> = {
  pro: "pro.neuroquestzen.app.zenpro.monthly",
  annual: "pro.neuroquestzen.app.zenpro.annual",
  founder: "pro.neuroquestzen.app.founder",
  daily: "pro.neuroquestzen.app.daypass",
};

const nd = Platform.OS !== "web";

const PLANS = [
  {
    id: "founder",
    title: "Founder Tier",
    price: "$199.99",
    period: " one-time",
    badge: "LIFETIME",
    oneTime: true,
    donationNote: "1% of net revenue donated to Feeding America · see /impact",
    features: [
      "Lifetime access to all Zen Pro features",
      "Permanent Founder badge",
      "Early access to new features",
      "Direct line to the founder for feedback",
      "Locks in today's price forever",
    ],
    cta: "Become a Founder",
    highlight: true,
  },
  {
    id: "annual",
    title: "Zen Pro · Annual",
    price: "$79.99",
    period: "/year",
    badge: "SAVE 33%",
    oneTime: false,
    donationNote: "1% of net revenue donated to Feeding America · see /impact",
    features: [
      "Everything in Zen Pro Monthly",
      "Save $40 vs. monthly billing",
      "Locked-in price for 12 months",
      "Cancel anytime, no contracts",
    ],
    cta: "Start Annual",
    highlight: false,
  },
  {
    id: "pro",
    title: "Zen Pro",
    price: "$9.99",
    period: "/month",
    badge: null,
    oneTime: false,
    donationNote: "1% of net revenue donated to Feeding America · see /impact",
    features: [
      "Unlimited daily plays",
      "All brain training games unlocked",
      "Priority reward access",
      "Exclusive Zen themes & sounds",
      "Advanced progress analytics",
      "Ad-free experience",
    ],
    cta: "Start Zen Pro",
    highlight: false,
  },
  {
    id: "daily",
    title: "Daily Pass",
    price: "$5.99",
    period: "/24 hours",
    badge: null,
    oneTime: true,
    donationNote: "1% of net revenue donated to Feeding America · see /impact",
    features: [
      "50 plays for 24 hours",
      "All Zen Pro features for the day",
      "No commitment required",
    ],
    cta: "Get Daily Pass",
    highlight: false,
  },
];

const ENTERPRISE_FEATURES = [
  { icon: "people", title: "Team Dashboard", desc: "Real-time wellness metrics across your organization" },
  { icon: "analytics", title: "ROI Analytics", desc: "Measure engagement, retention, and productivity impact" },
  { icon: "shield-checkmark", title: "SSO & SCIM", desc: "Enterprise-grade SSO integration and user provisioning" },
  { icon: "git-branch", title: "Team Challenges", desc: "Custom team exercises designed by organizational psychologists" },
  { icon: "bar-chart", title: "Burnout Risk Signals", desc: "Trend analysis on team HRV, sleep, and engagement — surfaces declines early so you can intervene" },
  { icon: "heart-circle", title: "CSR Impact Reports", desc: "Branded reports showing your company's charitable impact" },
  { icon: "lock-closed", title: "Enterprise Security", desc: "Designed with privacy-first principles and data protection in mind" },
  { icon: "calendar", title: "Dedicated Success", desc: "Named customer success manager and onboarding support" },
];

const ENTERPRISE_BENEFITS = [
  { name: "Engagement", count: "Higher" },
  { name: "Team Cohesion", count: "Stronger" },
  { name: "Burnout Awareness", count: "Better" },
  { name: "Retention", count: "Improved" },
];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState("founder");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  // Products fetched from the Adapty remote paywall, keyed by vendor product id
  // so we can match them to the locally-defined plan cards.
  const [adaptyProducts, setAdaptyProducts] = useState<
    Record<string, AdaptyPaywallProduct>
  >({});

  const handleGoHome = useCallback(() => {
    if (nd) Haptics.selectionAsync();
    router.replace("/");
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    getProPlacement()
      .then((placement) => {
        if (cancelled || !placement) return;
        const byVendorId: Record<string, AdaptyPaywallProduct> = {};
        for (const product of placement.products) {
          byVendorId[product.vendorProductId] = product;
        }
        setAdaptyProducts(byVendorId);
      })
      .catch((e) => console.warn("Adapty paywall setup:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = useCallback((id: string) => {
    if (nd) Haptics.selectionAsync();
    setSelectedPlan(id);
  }, []);

  const runPurchase = useCallback(
    async (planKey: string) => {
      const productId = PRODUCT_MAP[planKey];
      if (!productId) return;

      if (!isAdaptySupported()) {
        Alert.alert(
          "Not available here",
          "In-app purchases require the full iOS app. They are not available on the web or in Expo Go.",
        );
        return;
      }

      const product = adaptyProducts[productId];
      if (!product) {
        Alert.alert(
          "Unavailable",
          "This plan isn't available right now. Please try again in a moment.",
        );
        return;
      }

      try {
        setPurchasing(planKey);
        const result = await purchaseProduct(product);
        if (nd)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Purchase Successful",
          result.proActive
            ? "Your purchase has been confirmed. Thank you for being a member."
            : "Your purchase is being processed and will activate shortly.",
          [{ text: "OK" }],
        );
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (
          msg.includes("cancel") ||
          msg.toLowerCase().includes("cancelled") ||
          msg.includes("E_USER_CANCELLED")
        )
          return;
        if (nd)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Purchase Failed",
          msg || "Something went wrong. Please try again.",
        );
      } finally {
        setPurchasing(null);
      }
    },
    [adaptyProducts],
  );

  const handlePurchase = useCallback((id: string) => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const plan = PLANS.find((p) => p.id === id);
    if (!plan) return;

    const billingNote = plan.oneTime
      ? "Payment will be processed securely through the App Store. This is a one-time purchase — no auto-renewal."
      : "Payment will be processed securely through the App Store. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.";

    const ctaLabel = plan.oneTime ? "Buy" : "Subscribe";

    Alert.alert(
      `${ctaLabel === "Buy" ? "Purchase" : "Subscribe to"} ${plan.title}`,
      `${plan.price}${plan.period}\n\n${plan.donationNote}\n\nThis ${plan.oneTime ? "purchase" : "subscription"} includes:\n${plan.features.slice(0, 4).map((f) => `• ${f}`).join("\n")}\n\n${billingNote}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `${ctaLabel} ${plan.price}${plan.period}`,
          style: "default",
          onPress: () => runPurchase(id),
        },
      ]
    );
  }, [runPurchase]);

  const handleRestore = useCallback(async () => {
    if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isAdaptySupported()) {
      Alert.alert(
        "Not available here",
        "Restore Purchases requires the full iOS app.",
      );
      return;
    }
    try {
      setRestoring(true);
      const result = await restorePurchases();
      Alert.alert(
        "Restore Complete",
        result.proActive
          ? "Your Pro access has been restored."
          : "No active purchases found on this Apple ID.",
        [{ text: "OK" }],
      );
    } catch (e: any) {
      Alert.alert("Restore Failed", String(e?.message || e));
    } finally {
      setRestoring(false);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.celestialBlue, Colors.black, Colors.black]}
        locations={[0, 0.12, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.nebulaGlow} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={handleGoHome}
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
          style={({ pressed }) => [styles.homeButton, pressed && { opacity: 0.7 }]}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.gold} />
          <Text style={styles.homeButtonText}>Home</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>ELEVATE YOUR PRACTICE</Text>
          <Text style={styles.title}>Invest in Your Mind</Text>
          <Text style={styles.subtitle}>
            A portion of every subscription supports verified charity partners
          </Text>
        </View>

        <GlassCard style={styles.impactBanner} borderColor={Colors.goldAlpha20}>
          <LinearGradient
            colors={[Colors.goldAlpha08, Colors.goldAlpha05]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.impactRow}>
            <View style={styles.impactStat}>
              <Text style={styles.impactNum}>30%</Text>
              <Text style={styles.impactLabel}>Of revenue to{"\n"}charity</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactStat}>
              <Text style={styles.impactNum}>6</Text>
              <Text style={styles.impactLabel}>Verified{"\n"}partners</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactStat}>
              <Text style={styles.impactNum}>6</Text>
              <Text style={styles.impactLabel}>Global{"\n"}causes</Text>
            </View>
          </View>
        </GlassCard>

        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;

          return (
            <Pressable
              key={plan.id}
              onPress={() => handleSelect(plan.id)}
              style={({ pressed }) => [pressed && { opacity: 0.95 }]}
              accessibilityRole="button"
              accessibilityLabel={`Select ${plan.title} plan, ${plan.price} ${plan.period}`}
              accessibilityState={{ selected: isSelected }}
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
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.cta} for ${plan.title}`}
                >
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
                </Pressable>
              </GlassCard>
            </Pressable>
          );
        })}

        <GlassCard style={styles.enterpriseCard} borderColor="rgba(96,165,250,0.2)" elevated>
          <LinearGradient
            colors={["rgba(96,165,250,0.08)", "rgba(167,139,250,0.06)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.enterpriseBadge}>
            <Text style={styles.enterpriseBadgeText}>ENTERPRISE</Text>
          </View>

          <Text style={styles.enterpriseTitle}>Corporate Wellness</Text>
          <View style={styles.enterprisePriceRow}>
            <Text style={styles.enterprisePrice}>$50</Text>
            <Text style={styles.enterprisePeriod}>/seat/year</Text>
          </View>

          <View style={styles.enterpriseNote}>
            <View style={styles.donationDot} />
            <Text style={styles.donationText}>$15 per seat donated to charity annually</Text>
          </View>

          <View style={styles.enterpriseMetrics}>
            {ENTERPRISE_BENEFITS.map((c) => (
              <View key={c.name} style={styles.entMetric}>
                <Text style={styles.entMetricVal}>{c.count}</Text>
                <Text style={styles.entMetricLabel}>{c.name}</Text>
              </View>
            ))}
          </View>

          <View style={styles.entFeatures}>
            {ENTERPRISE_FEATURES.map((f) => (
              <View key={f.title} style={styles.entFeatureRow}>
                <View style={styles.entFeatureIcon}>
                  <Ionicons name={f.icon as any} size={16} color={Colors.mindfulBlue} />
                </View>
                <View style={styles.entFeatureInfo}>
                  <Text style={styles.entFeatureTitle}>{f.title}</Text>
                  <Text style={styles.entFeatureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => {
              if (nd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert("Enterprise Wellness", "Contact our team at admin@neuroquestllc.info to schedule a demo and learn about volume pricing.", [{ text: "Got it" }]);
            }}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Request enterprise demo"
          >
            <LinearGradient
              colors={[Colors.mindfulBlue, "#4A8FE0", "#3A7BD5"]}
              style={styles.entButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="business" size={18} color={Colors.white} />
              <Text style={styles.entButtonText}>Request Enterprise Demo</Text>
            </LinearGradient>
          </Pressable>

          <Text style={styles.entMinSeats}>Minimum 25 seats · Volume discounts available</Text>
        </GlassCard>

        <GlassCard style={styles.sponsoredCard} borderColor={Colors.goldAlpha20}>
          <LinearGradient
            colors={[Colors.goldAlpha08, Colors.goldAlpha05, "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sponsoredTop}>
            <MaterialCommunityIcons name="star-face" size={28} color={Colors.gold} />
            <View style={styles.sponsoredInfo}>
              <Text style={styles.sponsoredTitle}>Sponsored Rewards</Text>
              <Text style={styles.sponsoredSub}>Your brand. Real donations. Maximum visibility.</Text>
            </View>
          </View>
          <View style={styles.sponsoredTiers}>
            {[
              { name: "Bronze", price: "$500/mo", reach: "10K impressions" },
              { name: "Silver", price: "$2,500/mo", reach: "50K impressions" },
              { name: "Gold", price: "$10,000/mo", reach: "250K impressions" },
            ].map((tier) => (
              <View key={tier.name} style={styles.sponsoredTier}>
                <Text style={styles.sponsoredTierName}>{tier.name}</Text>
                <Text style={styles.sponsoredTierPrice}>{tier.price}</Text>
                <Text style={styles.sponsoredTierReach}>{tier.reach}</Text>
              </View>
            ))}
          </View>
          <View style={styles.enterpriseNote}>
            <View style={styles.donationDot} />
            <Text style={styles.donationText}>30% of sponsorship goes directly to the cause</Text>
          </View>
        </GlassCard>

        <Pressable
          onPress={handleRestore}
          disabled={restoring}
          style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Restore previous purchases"
        >
          {restoring ? (
            <ActivityIndicator color={Colors.whiteAlpha60} size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          Subscriptions auto-renew until cancelled. Manage or cancel anytime in your
          device's App Store or Play Store settings. 30% of all revenue is donated
          to verified charity partners. Prices may vary by region.
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
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.18)",
    marginBottom: 4,
  },
  homeButtonText: {
    color: Colors.gold,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
    marginLeft: 4,
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
  restoreBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  restoreText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.whiteAlpha30,
    textDecorationLine: "underline",
  },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 8,
  },
  enterpriseCard: {
    padding: 24,
    gap: 16,
    overflow: "hidden",
    position: "relative",
  },
  enterpriseBadge: {
    position: "absolute",
    top: 18,
    right: 18,
    backgroundColor: Colors.mindfulBlue,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  enterpriseBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 1,
  },
  enterpriseTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.white,
  },
  enterprisePriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  enterprisePrice: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 40,
    color: Colors.mindfulBlue,
  },
  enterprisePeriod: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha30,
    marginBottom: 8,
  },
  enterpriseNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(96,165,250,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.15)",
  },
  enterpriseMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  entMetric: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  entMetricVal: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.mindfulBlue,
  },
  entMetricLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.whiteAlpha30,
  },
  entFeatures: {
    gap: 12,
  },
  entFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  entFeatureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(96,165,250,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.15)",
  },
  entFeatureInfo: {
    flex: 1,
    gap: 2,
  },
  entFeatureTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  entFeatureDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    lineHeight: 17,
  },
  entButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 100,
    shadowColor: Colors.mindfulBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  entButtonText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.white,
  },
  entMinSeats: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.whiteAlpha20,
    textAlign: "center",
  },
  sponsoredCard: {
    padding: 24,
    gap: 16,
    overflow: "hidden",
  },
  sponsoredTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sponsoredInfo: {
    flex: 1,
    gap: 2,
  },
  sponsoredTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: Colors.white,
  },
  sponsoredSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.whiteAlpha30,
  },
  sponsoredTiers: {
    flexDirection: "row",
    gap: 8,
  },
  sponsoredTier: {
    flex: 1,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  sponsoredTierName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.gold,
  },
  sponsoredTierPrice: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 14,
    color: Colors.white,
  },
  sponsoredTierReach: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.whiteAlpha30,
    textAlign: "center",
  },
});
