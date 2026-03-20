import type { CapacitorConfig } from "@capacitor/cli"

// ──────────────────────────────────────────────────────────────────────────────
// NeuroQuest — Capacitor iOS Configuration
// Replace DEPLOYED_URL below with your published Replit URL.
// Find it in your Replit dashboard → Deployments → the .replit.app link.
// ──────────────────────────────────────────────────────────────────────────────
const DEPLOYED_URL = "https://neuroquest.replit.app" // ← replace with your .replit.app URL

const config: CapacitorConfig = {
  appId: "com.whitneyshauntaye.neuroquest",
  appName: "NeuroQuest",
  webDir: "dist/public",
  server: {
    url: DEPLOYED_URL,
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#060f09",
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: "#060f09",
      iosSpinnerStyle: "large",
      spinnerColor: "#D4AF37",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#060f09",
      overlaysWebView: false,
    },
  },
}

export default config
