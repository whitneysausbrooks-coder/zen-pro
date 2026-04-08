import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

type Tab = "privacy" | "terms";

interface Props {
  initialTab?: Tab;
  onClose: () => void;
}

export function LegalScreen({ initialTab = "privacy", onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      <LinearGradient
        colors={[Colors.forestDeep, Colors.black]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Legal</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabRow} accessibilityRole="tablist" accessibilityLabel="Legal document tabs">
        <Pressable
          onPress={() => setActiveTab("privacy")}
          style={[styles.tab, activeTab === "privacy" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityLabel="Privacy Policy"
          accessibilityState={{ selected: activeTab === "privacy" }}
        >
          <Text style={[styles.tabText, activeTab === "privacy" && styles.tabTextActive]}>
            Privacy Policy
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("terms")}
          style={[styles.tab, activeTab === "terms" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityLabel="Terms of Use"
          accessibilityState={{ selected: activeTab === "terms" }}
        >
          <Text style={[styles.tabText, activeTab === "terms" && styles.tabTextActive]}>
            Terms of Use
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "privacy" ? <PrivacyPolicy /> : <TermsOfUse />}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Body({ children }: { children: string }) {
  return <Text style={styles.body}>{children}</Text>;
}

function PrivacyPolicy() {
  return (
    <View style={styles.content}>
      <Text style={styles.lastUpdated}>Last Updated: April 2026</Text>

      <SectionTitle>Introduction</SectionTitle>
      <Body>
        NeuroQuest ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the "App").
      </Body>

      <SectionTitle>Information We Collect</SectionTitle>
      <Body>
        We collect information you provide directly to us, such as when you create an account, participate in brain training exercises, make purchases, or contact us for support. This may include your name, email address, and usage data related to your training activities.
      </Body>

      <SectionTitle>Local Data Storage</SectionTitle>
      <Body>
        NeuroQuest stores your training progress, Neural Energy balance, streak data, gratitude entries, and preferences locally on your device using secure on-device storage. This data remains on your device and is not transmitted to external servers unless you explicitly choose to sync or share it.
      </Body>

      <SectionTitle>How We Use Your Information</SectionTitle>
      <Body>
        We use information we collect to: provide and maintain the App and its features; process transactions and send related information; track your brain training progress and wellness metrics; improve and personalize your experience; send you technical notices, updates, and support messages; and comply with legal obligations.
      </Body>

      <SectionTitle>Charitable Donations</SectionTitle>
      <Body>
        When donations are triggered through your activities, we track aggregate donation amounts to verified charity partners. Individual donation records are stored locally on your device. We share aggregate, anonymized impact data with charity partners for reporting purposes only.
      </Body>

      <SectionTitle>In-App Purchases</SectionTitle>
      <Body>
        All purchases within the App are processed through Apple's App Store or Google Play Store payment systems. We do not directly collect, store, or process your payment card information. Please refer to Apple's or Google's privacy policies for information about how they handle payment data.
      </Body>

      <SectionTitle>Data Sharing</SectionTitle>
      <Body>
        We do not sell, trade, or rent your personal information to third parties. We may share anonymized, aggregated data for research purposes or to demonstrate the collective impact of our user community. We may disclose your information if required by law or in response to valid legal processes.
      </Body>

      <SectionTitle>Data Retention</SectionTitle>
      <Body>
        Local data is retained on your device until you choose to delete it through the app settings. You can reset all your data at any time from the Profile screen. Account-related data stored on our servers, if any, is retained for as long as your account is active or as needed to provide services.
      </Body>

      <SectionTitle>Children's Privacy</SectionTitle>
      <Body>
        NeuroQuest is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete that information promptly.
      </Body>

      <SectionTitle>Your Rights</SectionTitle>
      <Body>
        You have the right to: access, correct, or delete your personal data; opt out of data collection for analytics; request a copy of your data; and withdraw consent at any time. For users in the European Economic Area (EEA), you have additional rights under GDPR including the right to data portability and the right to lodge a complaint with a supervisory authority. For California residents, you have rights under the CCPA including the right to know what personal information is collected and the right to request deletion.
      </Body>

      <SectionTitle>Security</SectionTitle>
      <Body>
        We implement industry-standard security measures to protect your information. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.
      </Body>

      <SectionTitle>Changes to This Policy</SectionTitle>
      <Body>
        We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the App and updating the "Last Updated" date. Your continued use of the App after changes constitutes acceptance of the updated policy.
      </Body>

      <SectionTitle>Contact Us</SectionTitle>
      <Body>
        If you have questions about this Privacy Policy, please contact us at privacy@neuroquestapp.com.
      </Body>
    </View>
  );
}

function TermsOfUse() {
  return (
    <View style={styles.content}>
      <Text style={styles.lastUpdated}>Last Updated: April 2026</Text>

      <SectionTitle>Acceptance of Terms</SectionTitle>
      <Body>
        By downloading, installing, or using NeuroQuest ("the App"), you agree to be bound by these Terms of Use. If you do not agree to these terms, do not use the App.
      </Body>

      <SectionTitle>Description of Service</SectionTitle>
      <Body>
        NeuroQuest is a wellness and brain-training application that combines neuroscience-backed cognitive exercises with charitable giving. The App provides brain training games, mindfulness exercises, progress tracking, and a mechanism for triggering micro-donations to verified charity partners.
      </Body>

      <SectionTitle>User Accounts</SectionTitle>
      <Body>
        You may use certain features of the App without creating an account. Your training data and progress are stored locally on your device. You are responsible for maintaining the confidentiality of your device and any account credentials. You agree to accept responsibility for all activities that occur under your account or on your device.
      </Body>

      <SectionTitle>Neural Energy and Virtual Currency</SectionTitle>
      <Body>
        Neural Energy is a virtual metric within the App used to track your engagement and progress. Neural Energy has no monetary value, cannot be exchanged for real currency, and cannot be transferred between users. Neural Energy balances may be adjusted or reset at our discretion.
      </Body>

      <SectionTitle>Charitable Donations</SectionTitle>
      <Body>
        NeuroQuest facilitates micro-donations to verified charity partners. Donation amounts are determined by your in-app activities and subscription tier. We commit to donating 30% of net revenue to verified charity partners. Donation records displayed in the App are for informational purposes. Actual donation processing occurs on a periodic basis through our partner organizations.
      </Body>

      <SectionTitle>In-App Purchases and Subscriptions</SectionTitle>
      <Body>
        The App offers optional in-app purchases and subscriptions processed through Apple's App Store or Google Play Store. All purchases are subject to the respective store's terms and conditions. Subscription prices are displayed before purchase. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period. You can manage or cancel subscriptions through your device's store settings.
      </Body>

      <SectionTitle>Intellectual Property</SectionTitle>
      <Body>
        All content in the App, including text, graphics, logos, icons, images, audio clips, and software, is the property of NeuroQuest or its content suppliers and is protected by copyright, trademark, and other intellectual property laws. "NeuroQuest," "Neural Energy," "Heart-Brain Hybrid Score," and "Empathy Index" are trademarks of NeuroQuest. You may not use these marks without our prior written permission.
      </Body>

      <SectionTitle>Prohibited Conduct</SectionTitle>
      <Body>
        You agree not to: use the App for any unlawful purpose; attempt to reverse engineer, decompile, or disassemble the App; interfere with or disrupt the App or its servers; create multiple accounts to manipulate metrics or leaderboards; use automated systems or bots to interact with the App; or misrepresent your identity or affiliation.
      </Body>

      <SectionTitle>Health Disclaimer</SectionTitle>
      <Body>
        NeuroQuest is designed for general wellness and cognitive training purposes only. The App is not a medical device and is not intended to diagnose, treat, cure, or prevent any disease or health condition. The brain training exercises are based on published neuroscience research but individual results may vary. Consult a healthcare professional before beginning any new wellness program, especially if you have a pre-existing medical condition.
      </Body>

      <SectionTitle>Limitation of Liability</SectionTitle>
      <Body>
        To the maximum extent permitted by law, NeuroQuest shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App. Our total liability shall not exceed the amount you paid for the App in the twelve months preceding the claim.
      </Body>

      <SectionTitle>Termination</SectionTitle>
      <Body>
        We may terminate or suspend your access to the App at any time, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the App will immediately cease.
      </Body>

      <SectionTitle>Governing Law</SectionTitle>
      <Body>
        These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles.
      </Body>

      <SectionTitle>Changes to Terms</SectionTitle>
      <Body>
        We reserve the right to modify these Terms at any time. We will provide notice of significant changes through the App. Your continued use of the App after changes constitutes acceptance of the modified Terms.
      </Body>

      <SectionTitle>Contact</SectionTitle>
      <Body>
        For questions about these Terms, contact us at legal@neuroquestapp.com.
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
  },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.whiteAlpha05,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.goldAlpha15,
  },
  tabText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.whiteAlpha50,
  },
  tabTextActive: {
    color: Colors.gold,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  content: {
    gap: 12,
  },
  lastUpdated: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.whiteAlpha30,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.white,
    marginTop: 8,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.whiteAlpha60,
    lineHeight: 22,
  },
});
