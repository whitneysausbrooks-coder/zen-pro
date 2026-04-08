import { LinearGradient } from "expo-linear-gradient";
import { Link, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found", headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.celestialPurple, Colors.forestDeep, Colors.black]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.icon}>🧭</Text>
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.body}>
          This path doesn't lead anywhere.{"\n"}Let's get you back on track.
        </Text>
        <Link href="/" asChild>
          <Pressable style={styles.btn} accessibilityRole="button" accessibilityLabel="Return to home screen">
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold, Colors.goldDim]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.btnText}>Return Home</Text>
            </LinearGradient>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 20,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.whiteAlpha50,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  btn: {
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 50,
    alignItems: "center",
  },
  btnText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: Colors.forestDeep,
    letterSpacing: 1,
  },
});
