import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation dialog.
 * On web, uses window.confirm() directly because React Native Web's
 * Alert.alert() does not reliably invoke button callbacks.
 * On native, uses Alert.alert() with Cancel / Confirm buttons.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = "Delete",
): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      // window.confirm is synchronous; resolve immediately with the result
      resolve(window.confirm(`${title}\n\n${message}`));
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: "destructive",
          onPress: () => resolve(true),
        },
      ]);
    }
  });
}
