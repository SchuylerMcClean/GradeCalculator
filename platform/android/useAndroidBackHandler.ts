import { useEffect } from "react";
import { Alert, BackHandler } from "react-native";
import { useSegments } from "expo-router";

/**
 * Handles the Android hardware back button.
 * - When the user is on a root tab screen, shows an "Exit app?" confirmation.
 * - Otherwise lets Expo Router handle back navigation as normal.
 */
export function useAndroidBackHandler() {
  const segments = useSegments();

  useEffect(() => {
    const onBackPress = () => {
      const atRoot = segments[0] === "(tabs)";
      if (!atRoot) return false; // let the default back navigation occur

      Alert.alert("Exit App", "Are you sure you want to exit?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => BackHandler.exitApp(),
        },
      ]);
      return true; // consume the event — don't navigate back
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [segments]);
}
