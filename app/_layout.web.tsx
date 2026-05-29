import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { signOut } from "firebase/auth";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";

const COLORS = {
  bg: "#020617",
  tabBar: "#0f172a",
  tabActive: "#1e293b",
  tabHover: "rgba(255,255,255,0.04)",
  border: "rgba(255, 255, 255, 0.12)",
  accentUnderline: "#a78bfa",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
};

const TABS = [
  { name: "calculator", label: "Calculator" },
  { name: "courses", label: "My Courses" },
];

export const unstable_settings = {
  anchor: "(tabs)",
};

function BrowserTabBar() {
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Hide on auth screens or when not logged in
  if (!user || segments[0] === "(auth)") return null;

  // Determine which tab should appear active:
  // - On course/[id] pages, highlight "courses"
  // - On settings, no tab is highlighted
  // - Otherwise use the last segment to match tab names
  let activeTab: string;
  if (segments[0] === "course") {
    activeTab = "courses";
  } else if (segments[0] === "settings") {
    activeTab = "";
  } else {
    activeTab = segments[segments.length - 1] ?? "calculator";
  }

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/(auth)/login" as any);
  };

  return (
    <View style={styles.tabBar}>
      <View style={styles.tabStrip}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
            <Pressable
              key={tab.name}
              onPress={() => router.push(`/(tabs)/${tab.name}` as any)}
              style={({ hovered }: any) => [
                styles.tab,
                isActive && styles.tabActive,
                !isActive && hovered && styles.tabHovered,
              ]}
            >
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeUnderline} />}
            </Pressable>
          );
        })}
        <View style={styles.tabStripSpacer} />
        <Pressable
          onPress={() => router.push("/settings" as any)}
          style={({ hovered }: any) => [
            styles.navActionBtn,
            hovered && styles.navActionBtnHovered,
            segments[0] === "settings" && styles.navActionBtnActive,
          ]}
        >
          <Text
            style={[
              styles.navActionLabel,
              segments[0] === "settings" && styles.navActionLabelActive,
            ]}
          >
            Settings
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSignOut}
          style={({ hovered }: any) => [
            styles.signOutBtn,
            hovered && styles.signOutBtnHovered,
          ]}
        >
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </View>
      <View style={styles.tabBarDivider} />
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        © {new Date().getFullYear()} Schuyler McClean
      </Text>
    </View>
  );
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={styles.root}>
        <BrowserTabBar />
        <View style={styles.content}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="course/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
        </View>
        <Footer />
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: COLORS.tabBar,
  },
  tabStrip: {
    flexDirection: "row",
    paddingTop: 12,
    paddingHorizontal: 8,
    gap: 2,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    position: "relative",
    minWidth: 110,
    alignItems: "center",
  } as any,
  tabActive: {
    backgroundColor: COLORS.tabActive,
  },
  tabHovered: {
    backgroundColor: COLORS.tabHover,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textDim,
    userSelect: "none",
  } as any,
  tabLabelActive: {
    color: COLORS.textMain,
    fontWeight: "600",
  },
  activeUnderline: {
    position: "absolute",
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: COLORS.accentUnderline,
    borderRadius: 2,
  },
  tabBarDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  tabStripSpacer: {
    flex: 1,
  },
  signOutBtn: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    marginBottom: 8,
  } as any,
  navActionBtn: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 4,
    marginBottom: 8,
  } as any,
  navActionBtnHovered: {
    backgroundColor: COLORS.tabHover,
    borderColor: "rgba(255,255,255,0.25)",
  },
  navActionBtnActive: {
    backgroundColor: COLORS.tabActive,
    borderColor: COLORS.accentUnderline,
  },
  navActionLabel: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "500",
    userSelect: "none",
  } as any,
  navActionLabelActive: {
    color: COLORS.textMain,
    fontWeight: "600",
  },
  signOutBtnHovered: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderColor: "#f87171",
  },
  signOutLabel: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "500",
    userSelect: "none",
  } as any,
  footer: {
    height: 36,
    backgroundColor: COLORS.tabBar,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  footerText: {
    color: COLORS.textDim,
    fontSize: 12,
    userSelect: "none",
  } as any,
});
