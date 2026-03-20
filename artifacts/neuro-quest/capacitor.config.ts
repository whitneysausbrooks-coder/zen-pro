import type { CapacitorConfig } from "@capacitor/cli"

// ──────────────────────────────────────────────────────────────────────────────
// NeuroQuest — Capacitor iOS Configuration
// Replace DEPLOYED_URL below with your published Replit URL.
// Find it in your Replit dashboard → Deployments → the .replit.app link.
// ──────────────────────────────────────────────────────────────────────────────
// Your published Replit URL — update this if you have a custom domain
// To find it: Replit Dashboard → your project → Deployments tab
const DEPLOYED_URL = "https://workspace.whitneysausbroo.replit.app"

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
