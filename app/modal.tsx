import { Link } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const COLORS = {
  bg: "#020617",
  card: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.12)",
  accent: "#a78bfa",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
};

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Modal</Text>
        <Text style={styles.description}>
          This is a modal screen. You can customize it to fit your app's needs.
        </Text>

        <Link href="/" dismissTo asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Close Modal</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    color: COLORS.textMain,
    fontSize: 24,
    fontWeight: "200",
    letterSpacing: 1,
    marginBottom: 12,
  },
  description: {
    color: COLORS.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
  },
});
