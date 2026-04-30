import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  acceptCurrentTos,
  getTosStatus,
} from "@/lib/userAuth";
import { signOutAndReset } from "@/lib/health";

interface Props {
  onAccepted: () => void;
  onDeclined: () => void;
}

type Phase = "checking" | "needs_acceptance" | "submitting" | "ok";

export function TosAcceptanceModal({ onAccepted, onDeclined }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("checking");
  const [versions, setVersions] = useState<{ tos: string; privacy: string }>({
    tos: "",
    privacy: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await getTosStatus();
      if (cancelled) return;
      setVersions({
        tos: status.current_tos_version,
        privacy: status.current_privacy_version,
      });
      if (status.accepted) {
        setPhase("ok");
        onAccepted();
      } else {
        setPhase("needs_acceptance");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onAccepted]);

  const handleAccept = async () => {
    setError(null);
    setPhase("submitting");
    const result = await acceptCurrentTos();
    if (result.success) {
      setPhase("ok");
      onAccepted();
    } else {
      setPhase("needs_acceptance");
      setError("We couldn't record your acceptance. Please check your connection and try again.");
    }
  };

  const handleDecline = () => {
    Alert.alert(
      "Decline updated terms?",
      "You need to accept the latest Terms and Privacy Policy to use NeuroQuest. Declining will sign you out of this device.",
      [
        { text: "Go back", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            // Use the canonical sign-out so we ALSO clear the
            // `nq_login_done` and `nq_health_choice` flags. Otherwise
            // the user re-launches into a half-reset state with stale
            // gate flags but no credentials.
            try {
              await signOutAndReset();
            } catch {}
            onDeclined();
          },
        },
      ],
    );
  };

  if (phase === "checking" || phase === "ok") {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[Colors.celestialPurple, Colors.black]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.celestialPurple, Colors.forestDeep, Colors.black]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Updated</Text>
          </View>

          <Text style={styles.title}>Your privacy, on the record.</Text>

          <Text style={styles.subtitle}>
            We've updated our Terms of Service and Privacy Policy. Please review and accept to continue using NeuroQuest.
          </Text>

          <View style={styles.divider} />

          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Your wearable and biometric data stays attached only to your install, never to your name.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              Aggregated wellness scores are shared with your employer only when k-anonymity is at least 5.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              You can delete every record we hold for you, at any time, from Profile → Delete Account.
            </Text>
          </View>

          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Terms of Service</Text>
            <Text style={styles.versionValue}>v{versions.tos}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Privacy Policy</Text>
            <Text style={styles.versionValue}>v{versions.privacy}</Text>
          </View>

          {error ? (
            <Text
              style={styles.error}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleAccept}
            disabled={phase === "submitting"}
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && styles.acceptBtnPressed,
              phase === "submitting" && styles.btnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              error
                ? "Retry recording your acceptance of the updated terms"
                : "Accept updated terms and privacy policy"
            }
            accessibilityState={{ disabled: phase === "submitting" }}
          >
            {phase === "submitting" ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              // After a failed attempt, the same primary CTA acts as the
              // retry. Relabel it so the user knows tapping again will try
              // the network call once more — the prior label "Accept &
              // Continue" suggested the failure was permanent.
              <Text style={styles.acceptText}>
                {error ? "Try Again" : "Accept & Continue"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleDecline}
            disabled={phase === "submitting"}
            style={({ pressed }) => [styles.declineBtn, pressed && styles.declineBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Decline and sign out"
          >
            <Text style={styles.declineText}>Decline and sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.black,
  },
  scroll: {
    paddingHorizontal: 20,
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: Colors.glass,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 28,
    overflow: "hidden",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.goldAlpha15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.goldAlpha30,
  },
  badgeText: {
    color: Colors.gold,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: Colors.starlight,
    marginBottom: 12,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.whiteAlpha80,
    lineHeight: 22,
    marginBottom: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.glassBorder,
    marginVertical: 6,
    marginBottom: 18,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
    marginTop: 8,
    marginRight: 12,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha80,
    lineHeight: 21,
  },
  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.glassBorderLight,
  },
  versionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.whiteAlpha60,
  },
  versionValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.gold,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.error,
    marginTop: 14,
    textAlign: "center",
  },
  acceptBtn: {
    marginTop: 22,
    backgroundColor: Colors.gold,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: Colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  acceptBtnPressed: {
    backgroundColor: Colors.goldDim,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.7,
  },
  acceptText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.black,
    letterSpacing: 0.3,
  },
  declineBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  declineBtnPressed: {
    opacity: 0.6,
  },
  declineText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    textDecorationLine: "underline",
  },
});
