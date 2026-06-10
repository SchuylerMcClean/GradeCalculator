import { StyleSheet, Text, View } from "react-native";

const COLORS = {
  tabBar: "#0f172a",
  border: "rgba(255, 255, 255, 0.12)",
  textDim: "#94a3b8",
};

export function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        © {new Date().getFullYear()} Schuyler McClean
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
