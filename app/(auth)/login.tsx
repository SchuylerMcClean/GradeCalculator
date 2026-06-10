import { auth } from "@/lib/firebase";
import { lookupEmailByUsername } from "@/lib/firestore";
import { IS_DEV } from "@/lib/env";
import { AppTextInput } from "@/components/app-text-input";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
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
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef<any>(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError("Please enter your email or username and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      let resolvedEmail = identifier.trim();
      if (!resolvedEmail.includes("@")) {
        const found = await lookupEmailByUsername(resolvedEmail);
        if (!found) {
          setError("No account found with that username.");
          setLoading(false);
          return;
        }
        resolvedEmail = found;
      }
      const credential = await signInWithEmailAndPassword(
        auth,
        resolvedEmail,
        password,
      );
      if (!IS_DEV && !credential.user.emailVerified) {
        await signOut(auth);
        setError(
          "Your email address hasn't been verified yet. Please check your inbox for the verification link.",
        );
        return;
      }
      router.replace("/(tabs)/calculator" as any);
    } catch (e: any) {
      console.error("Login error:", e.code, e.message, e);
      const msg =
        e.code === "auth/too-many-requests"
          ? "Too many sign-in attempts. Please wait a few minutes before trying again."
          : e.code === "auth/invalid-credential" ||
              e.code === "auth/user-not-found" ||
              e.code === "auth/wrong-password"
            ? "Incorrect email or password. Please check your details and try again."
            : e.code === "permission-denied" ||
                e.message?.includes("permission")
              ? "Unable to look up account. Check your Firestore security rules allow unauthenticated reads on the 'usernames' collection."
              : "Sign in failed. Please try again.";
      setError(msg);
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

          <Text style={styles.label}>Email or Username</Text>
          <AppTextInput
            style={styles.input}
            value={identifier}
            onChangeText={(v) => {
              setIdentifier(v);
              setError("");
            }}
            placeholder=""
            placeholderTextColor={COLORS.textDim}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            maxLength={100}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError("");
            }}
            maxLength={100}
            placeholderTextColor={COLORS.textDim}
            secureTextEntry
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

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
  errorBanner: {
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: "center",
  },
});
