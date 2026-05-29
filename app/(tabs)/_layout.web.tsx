import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="calculator" options={{ title: "Calculator" }} />
      <Tabs.Screen name="courses" options={{ title: "My Courses" }} />
    </Tabs>
  );
}
