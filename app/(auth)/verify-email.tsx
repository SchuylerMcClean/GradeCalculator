import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { useRouter } from "expo-router";
import { reload, sendEmailVerification, signOut } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
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
  success: "#4ade80",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
};

export default function VerifyEmailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  const handleCheckVerification = async () => {
    if (!auth.currentUser) {
      router.replace("/(auth)/login" as any);
      return;
    }
    setChecking(true);
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        // Auth state will update and index.tsx will redirect to tabs
        router.replace("/");
      } else {
        Alert.alert(
          "Not Verified Yet",
          "Your email has not been verified yet. Please check your inbox and click the verification link.",
        );
      }
    } catch (err: any) {
      console.error(
        "reload/emailVerified check error:",
        err?.code,
        err?.message,
      );
      Alert.alert(
        "Error",
        "Could not check verification status. Please try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser || resendCooldown) return;
    setResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setResendCooldown(true);
      // Prevent resend spam — re-enable after 60 seconds
      setTimeout(() => setResendCooldown(false), 60_000);
      Alert.alert("Email Sent", "A new verification email has been sent.");
    } catch (err: any) {
      console.error("sendEmailVerification error:", err?.code, err?.message);
      Alert.alert(
        "Error",
        `Could not resend the email. (${err?.code ?? err?.message})`,
      );
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = async () => {
    await signOut(auth);
    router.replace("/(auth)/login" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>✉️</Text>
          </View>

          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>We sent a verification link to:</Text>
          <Text style={styles.email}>
            {user?.email ?? auth.currentUser?.email ?? "your email address"}
          </Text>
          <Text style={styles.body}>
            Click the link in that email, then come back and tap the button
            below to continue.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, checking && styles.btnDisabled]}
            onPress={handleCheckVerification}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                I've Verified My Email ✓
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              (resending || resendCooldown) && styles.btnDisabled,
            ]}
            onPress={handleResend}
            disabled={resending || resendCooldown}
          >
            {resending ? (
              <ActivityIndicator color={COLORS.accent} />
            ) : (
              <Text style={styles.secondaryBtnText}>
                {resendCooldown ? "Email Sent ✓" : "Resend Verification Email"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={handleBackToLogin}>
            <Text style={styles.linkText}>
              <Text style={styles.linkAccent}>← Back to Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconText: {
    fontSize: 34,
  },
  title: {
    color: COLORS.textMain,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: "center",
  },
  email: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  body: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryBtn: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  secondaryBtnText: {
    color: COLORS.accent,
    fontWeight: "600",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  linkBtn: {
    alignItems: "center",
  },
  linkText: {
    color: COLORS.textDim,
    fontSize: 14,
  },
  linkAccent: {
    color: COLORS.accent,
    fontWeight: "600",
  },
});
