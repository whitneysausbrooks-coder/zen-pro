"use no memo";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import Colors from "@/constants/colors";
import {
  isHealthKitAvailable,
  getStoredEmail,
  setStoredEmail,
  getStoredInviteCode,
  setStoredInviteCode,
  clearStoredCredentials,
  getLastSyncAt,
  requestHealthPermissions,
  readLatestMetrics,
  syncToServer,
  syncManualMetrics,
  getLoginMode,
  openAppSettings,
  type WearableMetrics,
  type LoginMode,
} from "@/lib/health";

function fmtSync(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return d.toLocaleDateString();
}

export default function WearableScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [credsSaved, setCredsSaved] = useState(false);
  const [healthRequested, setHealthRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<WearableMetrics | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [classification, setClassification] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualHrv, setManualHrv] = useState("");
  const [manualSleep, setManualSleep] = useState("");
  const [manualSteps, setManualSteps] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [loginMode, setLoginModeState] = useState<LoginMode | null>(null);

  useEffect(() => {
    (async () => {
      const [storedEmail, storedCode, mode] = await Promise.all([
        getStoredEmail(),
        getStoredInviteCode(),
        getLoginMode(),
      ]);
      setLoginModeState(mode);
      // Only treat creds as "saved" when the user is in enterprise mode AND
      // both pieces are present. Prevents stale creds on a shared device
      // from auto-syncing under a previous identity.
      if (mode === "enterprise" && storedEmail) setEmail(storedEmail);
      if (mode === "enterprise" && storedCode) setInviteCode(storedCode);
      if (mode === "enterprise" && storedEmail && storedCode) setCredsSaved(true);
      setLastSync(await getLastSyncAt());
    })();
  }, []);

  const blockedIfNotEnterprise = useCallback((): boolean => {
    if (loginMode === "enterprise") return false;
    Alert.alert(
      "Sign in required",
      "Sign in as a pilot member from your Profile to sync to your team baseline. Manual entry without sign-in stays on this device only.",
    );
    return true;
  }, [loginMode]);

  const onSaveCreds = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      Alert.alert("Invalid email", "Please enter a valid work email.");
      return;
    }
    if (trimmedCode.length < 4) {
      Alert.alert("Invalid invite code", "Enter the company invite code your admin shared with you.");
      return;
    }
    await Promise.all([setStoredEmail(trimmedEmail), setStoredInviteCode(trimmedCode)]);
    setCredsSaved(true);
    if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [email, inviteCode]);

  const onChangeCreds = useCallback(async () => {
    await clearStoredCredentials();
    setEmail("");
    setInviteCode("");
    setCredsSaved(false);
  }, []);

  const onConnect = useCallback(async () => {
    if (!isHealthKitAvailable) {
      Alert.alert(
        "iPhone required",
        "Apple Health connection is only available on iOS. Open NeuroQuest on your iPhone to connect."
      );
      return;
    }
    setBusy(true);
    const ok = await requestHealthPermissions();
    setHealthRequested(ok);
    if (ok) {
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert(
        "Couldn't open Apple Health",
        "Apple Health didn't respond. You can grant access manually in Settings.",
        [
          { text: "Open Settings", onPress: () => openAppSettings() },
          { text: "OK", style: "cancel" },
        ],
      );
    }
    setBusy(false);
  }, []);

  const onSubmitManual = useCallback(async () => {
    // Manual entry is allowed for everyone — the lib gracefully saves
    // locally for non-enterprise users (no server sync) and pushes to the
    // pilot baseline for enterprise users with valid creds.
    const hrvNum = manualHrv.trim() ? Number(manualHrv.trim()) : null;
    const sleepNum = manualSleep.trim() ? Number(manualSleep.trim()) : null;
    const stepsNum = manualSteps.trim() ? Number(manualSteps.trim()) : null;
    if (hrvNum == null && sleepNum == null && stepsNum == null) {
      Alert.alert("Nothing to save", "Enter at least one of HRV, sleep, or steps.");
      return;
    }
    if (
      (hrvNum != null && (!Number.isFinite(hrvNum) || hrvNum < 0 || hrvNum > 300)) ||
      (sleepNum != null && (!Number.isFinite(sleepNum) || sleepNum < 0 || sleepNum > 24)) ||
      (stepsNum != null && (!Number.isFinite(stepsNum) || stepsNum < 0 || stepsNum > 200000))
    ) {
      Alert.alert(
        "Check your numbers",
        "HRV must be 0-300 ms, sleep 0-24 h, steps 0-200,000.",
      );
      return;
    }
    setManualBusy(true);
    try {
      const result = await syncManualMetrics(email, inviteCode, {
        hrv: hrvNum,
        sleep_hours: sleepNum,
        steps: stepsNum != null ? Math.round(stepsNum) : null,
      });
      if (!result.success) {
        Alert.alert("Couldn't save", result.message || "Unknown error");
        return;
      }
      setScore(result.neuro_resilience_score ?? null);
      setClassification(result.classification ?? null);
      setLastSync(new Date().toISOString());
      setManualHrv("");
      setManualSleep("");
      setManualSteps("");
      setManualOpen(false);
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setManualBusy(false);
    }
  }, [email, inviteCode, manualHrv, manualSleep, manualSteps]);

  const onSync = useCallback(async () => {
    if (blockedIfNotEnterprise()) return;
    if (!credsSaved) {
      Alert.alert(
        "Confirm your email and code first",
        "Save your work email and your company invite code so we can securely match your data."
      );
      return;
    }
    setBusy(true);
    try {
      const m = await readLatestMetrics();
      setMetrics(m);
      const result = await syncToServer(email, inviteCode, m);
      if (!result.success) {
        const noData =
          m.hrv == null && m.sleep_duration_minutes == null && m.steps == null;
        Alert.alert(
          noData ? "No health data found" : "Sync failed",
          result.message || "Unknown error",
          noData
            ? [
                { text: "Open Settings", onPress: () => openAppSettings() },
                { text: "OK", style: "cancel" },
              ]
            : [{ text: "OK" }],
        );
      } else {
        setScore(result.neuro_resilience_score ?? null);
        setClassification(result.classification ?? null);
        setLastSync(new Date().toISOString());
        if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setBusy(false);
    }
  }, [credsSaved, email, inviteCode]);

  const showWebNote = Platform.OS === "web";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={["rgba(108,99,255,0.15)", "transparent"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={Colors.white} />
        </Pressable>
        <Text style={styles.title}>Wearable</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.card}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="heart-pulse" size={28} color="#A78BFA" />
            <Text style={styles.cardTitle}>Apple Health</Text>
          </View>
          <Text style={styles.cardSub}>
            Read your HRV, sleep, and step data from Apple Health to power your personal Neuro-Resilience Score.
            Your individual data is never shown to your employer.
          </Text>

          {showWebNote ? (
            <View style={styles.note}>
              <Feather name="info" size={14} color="#A78BFA" />
              <Text style={styles.noteText}>
                Apple Health is iPhone-only. Open NeuroQuest on your iPhone to connect.
              </Text>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionLabel}>Step 1 — Verify you're a pilot member</Text>
          <Text style={styles.cardSub}>
            Enter the work email your admin used to add you, plus your company invite code.
            We use both together to make sure no one else can submit data as you.
          </Text>
          {credsSaved ? (
            <View style={styles.savedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedEmail}>{email}</Text>
                <Text style={styles.savedHint}>Code: {inviteCode} · Saved on this device</Text>
              </View>
              <Pressable onPress={onChangeCreds} style={styles.linkBtn}>
                <Text style={styles.linkText}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="you@yourcompany.com"
                placeholderTextColor="#7280A0"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Company invite code (e.g. SJK3M67C)"
                placeholderTextColor="#7280A0"
                autoCapitalize="characters"
                autoCorrect={false}
                value={inviteCode}
                onChangeText={setInviteCode}
              />
              <Pressable
                onPress={onSaveCreds}
                style={[styles.primaryBtn, (!email || !inviteCode) && styles.btnDisabled]}
                disabled={!email || !inviteCode}
              >
                <Text style={styles.primaryBtnText}>Save & verify</Text>
              </Pressable>
            </>
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionLabel}>Step 2 — Grant Health permissions</Text>
          <Text style={styles.cardSub}>
            We request read-only access to: Heart Rate Variability, Sleep, and Step Count.
          </Text>
          <Pressable
            onPress={onConnect}
            disabled={busy || !isHealthKitAvailable}
            style={[styles.primaryBtn, (!isHealthKitAvailable || busy) && styles.btnDisabled]}
          >
            <Feather name="heart" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {healthRequested ? "Apple Health requested ✓ — tap Sync below" : "Connect Apple Health"}
            </Text>
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionLabel}>Step 3 — Sync your data</Text>
          <View style={styles.syncRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncLabel}>Last sync</Text>
              <Text style={styles.syncValue}>{fmtSync(lastSync)}</Text>
            </View>
            <Pressable
              onPress={onSync}
              disabled={busy || !credsSaved}
              style={[styles.primaryBtn, styles.syncBtn, (!credsSaved || busy) && styles.btnDisabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>Sync now</Text>
                </>
              )}
            </Pressable>
          </View>

          {metrics ? (
            <View style={styles.metricsBlock}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>HRV</Text>
                <Text style={styles.metricValue}>{metrics.hrv != null ? `${metrics.hrv} ms` : "—"}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Sleep</Text>
                <Text style={styles.metricValue}>
                  {metrics.sleep_duration_minutes != null
                    ? `${(metrics.sleep_duration_minutes / 60).toFixed(1)} h`
                    : "—"}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Steps</Text>
                <Text style={styles.metricValue}>
                  {metrics.steps != null ? metrics.steps.toLocaleString() : "—"}
                </Text>
              </View>
            </View>
          ) : null}

          {score != null ? (
            <View style={styles.scoreBlock}>
              <Text style={styles.scoreLabel}>Your Neuro-Resilience Score</Text>
              <Text style={styles.scoreValue}>{score}</Text>
              {classification ? <Text style={styles.scoreClass}>{classification.toUpperCase()}</Text> : null}
              <View style={styles.aiBadge}>
                <Feather name="cpu" size={13} color="#FFCD63" />
                <Text style={styles.aiBadgeText}>AI baseline learning from your data</Text>
              </View>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Pressable
            onPress={() => setManualOpen((v) => !v)}
            style={styles.manualToggleRow}
            accessibilityRole="button"
            accessibilityLabel={manualOpen ? "Hide manual entry" : "Show manual entry"}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Or enter manually</Text>
              <Text style={styles.cardSub}>
                No wearable? Type in your numbers — works on every device.
              </Text>
            </View>
            <Feather
              name={manualOpen ? "chevron-up" : "chevron-down"}
              size={22}
              color={Colors.white}
            />
          </Pressable>

          {manualOpen ? (
            <>
              <View style={{ height: 8 }} />
              <Text style={styles.manualLabel}>HRV (ms)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 45"
                placeholderTextColor="#7280A0"
                keyboardType="decimal-pad"
                value={manualHrv}
                onChangeText={setManualHrv}
                accessibilityLabel="HRV in milliseconds"
              />
              <Text style={[styles.manualLabel, { marginTop: 10 }]}>Sleep (hours)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 7.5"
                placeholderTextColor="#7280A0"
                keyboardType="decimal-pad"
                value={manualSleep}
                onChangeText={setManualSleep}
                accessibilityLabel="Sleep duration in hours"
              />
              <Text style={[styles.manualLabel, { marginTop: 10 }]}>Steps today</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 8200"
                placeholderTextColor="#7280A0"
                keyboardType="number-pad"
                value={manualSteps}
                onChangeText={setManualSteps}
                accessibilityLabel="Steps today"
              />
              <Pressable
                onPress={onSubmitManual}
                disabled={manualBusy}
                style={[
                  styles.primaryBtn,
                  { marginTop: 12 },
                  manualBusy && styles.btnDisabled,
                ]}
              >
                {manualBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="save" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>Save manual entry</Text>
                  </>
                )}
              </Pressable>
            </>
          ) : null}
        </GlassCard>

        <GlassCard style={[styles.card, styles.privacyCard]}>
          <View style={styles.row}>
            <Feather name="shield" size={20} color="#34D399" />
            <Text style={styles.privacyTitle}>Your privacy</Text>
          </View>
          <Text style={styles.cardSub}>
            • Your individual scores are visible only to you{"\n"}
            • HR sees aggregate trends only when 5+ teammates participate{"\n"}
            • You can disconnect anytime in iOS Settings → Privacy → Health{"\n"}
            • We never read location, messages, or workouts
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  title: { color: Colors.white, fontSize: 18, fontWeight: "700" },
  scroll: { padding: 16, paddingBottom: 60, gap: 14 },
  card: { padding: 18, gap: 12 },
  privacyCard: { borderColor: "rgba(52,211,153,0.25)" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { color: Colors.white, fontSize: 18, fontWeight: "700" },
  cardSub: { color: "#9AA8C4", fontSize: 13, lineHeight: 19 },
  sectionLabel: { color: "#A78BFA", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  privacyTitle: { color: "#34D399", fontSize: 15, fontWeight: "700" },
  input: {
    color: Colors.white,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6C63FF",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  syncBtn: { paddingVertical: 11, paddingHorizontal: 14 },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  savedEmail: { color: Colors.white, fontSize: 15, fontWeight: "600" },
  savedHint: { color: "#7280A0", fontSize: 12, marginTop: 2 },
  linkBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  linkText: { color: "#A78BFA", fontSize: 13, fontWeight: "600" },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  syncLabel: { color: "#7280A0", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  syncValue: { color: Colors.white, fontSize: 15, fontWeight: "600", marginTop: 2 },
  metricsBlock: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  metric: { flex: 1, alignItems: "center" },
  metricLabel: { color: "#7280A0", fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  metricValue: { color: Colors.white, fontSize: 16, fontWeight: "700", marginTop: 4 },
  scoreBlock: {
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  scoreLabel: { color: "#7280A0", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  scoreValue: { color: "#A78BFA", fontSize: 42, fontWeight: "800" },
  scoreClass: { color: "#9AA8C4", fontSize: 12, fontWeight: "600", letterSpacing: 1.5 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,205,99,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    marginTop: 10,
  },
  aiBadgeText: { color: "#FFCD63", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  manualToggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  manualLabel: { color: "#7280A0", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(167,139,250,0.08)",
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  noteText: { color: "#A78BFA", fontSize: 12, flex: 1, lineHeight: 17 },
});
