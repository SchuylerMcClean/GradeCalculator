import { useAuth } from "@/lib/auth-context";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)/calculator" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
  },
});
