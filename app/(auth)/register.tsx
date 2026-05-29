import { auth } from "@/lib/firebase";
import { AppTextInput } from "@/components/app-text-input";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  textMain: "#f8fafc",
  textDim: "#94a3b8",
  inputBg: "rgba(255, 255, 255, 0.08)",
};

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNextStep = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Validation", "Please enter your first and last name.");
      return;
    }
    setStep(2);
  };

  const handleRegister = async () => {
    if (!email.trim() || !password || !confirm) {
      Alert.alert("Validation", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Validation", "Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await updateProfile(credential.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      });
      // Send verification email — navigate to verify screen regardless of
      // whether this succeeds so the user can resend from there.
      try {
        await sendEmailVerification(credential.user);
      } catch (verifyErr: any) {
        console.error(
          "sendEmailVerification error:",
          verifyErr?.code,
          verifyErr?.message,
        );
      }
      router.replace("/(auth)/verify-email" as any);
    } catch (e: any) {
      console.error("Registration error:", e?.code, e?.message);
      const msg =
        e.code === "auth/email-already-in-use"
          ? "An account with this email already exists."
          : e.code === "auth/invalid-email"
            ? "Please enter a valid email address."
            : e.code === "auth/weak-password"
              ? "Password must be at least 6 characters."
              : `Registration failed. (${e.code ?? e.message})`;
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.card}>
          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View
              style={[styles.stepLine, step === 2 && styles.stepLineActive]}
            />
            <View
              style={[styles.stepDot, step === 2 && styles.stepDotActive]}
            />
          </View>
          <Text style={styles.stepLabel}>
            Step {step} of 2 —{" "}
            {step === 1 ? "Personal Info" : "Account Details"}
          </Text>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start tracking your grades</Text>

          {step === 1 ? (
            <>
              <Text style={styles.label}>First Name</Text>
              <AppTextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
                placeholderTextColor={COLORS.textDim}
                autoCapitalize="words"
                autoComplete="given-name"
              />

              <Text style={styles.label}>Last Name</Text>
              <AppTextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Smith"
                placeholderTextColor={COLORS.textDim}
                autoCapitalize="words"
                autoComplete="family-name"
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNextStep}
              >
                <Text style={styles.primaryBtnText}>Continue →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <AppTextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textDim}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />

              <Text style={styles.label}>Password</Text>
              <AppTextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={COLORS.textDim}
                secureTextEntry
                autoComplete="new-password"
              />

              <Text style={styles.label}>Confirm Password</Text>
              <AppTextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter password"
                placeholderTextColor={COLORS.textDim}
                secureTextEntry
                autoComplete="new-password"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => setStep(1)}
              >
                <Text style={styles.linkText}>
                  <Text style={styles.linkAccent}>← Back</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.linkBtn, { marginTop: 12 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>
              Already have an account?{" "}
              <Text style={styles.linkAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  },
  title: {
    color: COLORS.textMain,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
  },
  label: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textMain,
    fontSize: 15,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
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
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.accent,
  },
  stepLine: {
    flex: 1,
    maxWidth: 48,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: COLORS.accent,
  },
  stepLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
});
