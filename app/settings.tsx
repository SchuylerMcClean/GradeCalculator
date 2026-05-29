import { useAuth } from "@/lib/auth-context";
import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  bg: "#020617",
  card: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.12)",
  accent: "#a78bfa",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
  success: "#4ade80",
  danger: "#f87171",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.maxWidthContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Settings</Text>
          </View>

          {/* Account section */}
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.displayName}>
              {user.displayName ?? "No display name"}
            </Text>
            <Text style={styles.emailSubtitle}>{user.email}</Text>
          </View>

          {/* Details section */}
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <View style={styles.detailsCard}>
            <InfoRow label="Email" value={user.email ?? "—"} />
            <View style={styles.divider} />
            <InfoRow label="Name" value={user.displayName ?? "Not set"} />
            <View style={styles.divider} />
            <InfoRow label="User ID" value={user.uid} />
            <View style={styles.divider} />
            <InfoRow
              label="Account Created"
              value={formatDate(user.metadata.creationTime)}
            />
            <View style={styles.divider} />
            <InfoRow
              label="Last Sign In"
              value={formatDate(user.metadata.lastSignInTime)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  maxWidthContent: {
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 8,
  },
  header: {
    paddingTop: 28,
    paddingBottom: 20,
    gap: 8,
  },
  backBtn: {
    alignSelf: "flex-start",
  },
  backBtnText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "500",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textDim,
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: "700",
    color: "#020617",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  emailSubtitle: {
    fontSize: 14,
    color: COLORS.textDim,
  },
  detailsCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textDim,
    fontWeight: "500",
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textMain,
    fontWeight: "400",
    textAlign: "right",
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },
});
