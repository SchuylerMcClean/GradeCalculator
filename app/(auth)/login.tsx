import { auth } from "@/lib/firebase";
import { AppTextInput } from "@/components/app-text-input";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  bg: "#020617",
  card: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.12)",
  accent: "#a78bfa",
  danger: "#f87171",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
  inputBg: "rgba(255, 255, 255, 0.08)",
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordPlaceholderVisible, setPasswordPlaceholderVisible] =
    useState(true);
  const passwordRef = useRef<any>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Validation", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      if (!credential.user.emailVerified) {
        await signOut(auth);
        Alert.alert(
          "Email Not Verified",
          "Please verify your email address before signing in. Check your inbox for the verification link.",
        );
        return;
      }
      router.replace("/(tabs)/calculator" as any);
    } catch (e: any) {
      const msg =
        e.code === "auth/invalid-credential" ||
        e.code === "auth/user-not-found" ||
        e.code === "auth/wrong-password"
          ? "Invalid email or password."
          : "Sign in failed. Please try again.";
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
          <Text style={styles.title}>Grade Calculator</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

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
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={passwordPlaceholderVisible ? "••••••••" : ""}
            placeholderTextColor={COLORS.textDim}
            secureTextEntry
            autoComplete="password"
            returnKeyType="go"
            onFocus={() => setPasswordPlaceholderVisible(false)}
            onBlur={() => setPasswordPlaceholderVisible(true)}
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push("/(auth)/register" as any)}
          >
            <Text style={styles.linkText}>
              Don't have an account?{" "}
              <Text style={styles.linkAccent}>Register</Text>
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
});
