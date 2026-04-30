import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

// NOTE (Build #8): unstable-native-tabs overflows >5 tabs into a hidden "More"
// stack on iOS UITabBar, which made Profile appear missing and broke
// router.replace("/") for Home on iOS 26 testers. We always render
// ClassicTabLayout to keep all 6 tabs visible and routable. NativeTabLayout
// is retained as dead code for future re-enable when expo-router's native
// tabs supports >5 entries reliably.

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="train">
        <Icon sf={{ default: "brain.head.profile", selected: "brain.head.profile" }} />
        <Label>Train</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="play">
        <Icon sf={{ default: "gamecontroller", selected: "gamecontroller.fill" }} />
        <Label>Play</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resilience">
        <Icon sf={{ default: "heart.text.square", selected: "heart.text.square.fill" }} />
        <Label>Resilience</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shop">
        <Icon sf={{ default: "crown", selected: "crown.fill" }} />
        <Label>Zen Pro</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={90}
            tint="dark"
            style={[StyleSheet.absoluteFill, {
              backgroundColor: "rgba(6, 11, 7, 0.88)",
              borderTopWidth: 1,
              borderTopColor: Colors.glassBorderLight,
            }]}
          />
        ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          letterSpacing: 0.3,
          marginBottom: isIOS ? 0 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="train"
        options={{
          title: "Train",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="brain" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: "Play",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="resilience"
        options={{
          title: "Resilience",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="heart-pulse" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Zen Pro",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="crown" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  // Always use ClassicTabLayout — see top-of-file note re: iOS 26 6-tab overflow.
  // NativeTabLayout retained for future use; reference it to keep TS happy.
  void NativeTabLayout;
  return <ClassicTabLayout />;
}
