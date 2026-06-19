import React from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { colors } from "@/src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TABS: { name: string; label: string; icon: IconName; testID: string }[] = [
  { name: "home", label: "Barter", icon: "swap-horizontal", testID: "tab-home" },
  { name: "matches", label: "Matches", icon: "sparkles", testID: "tab-matches" },
  { name: "swaps", label: "Swaps", icon: "git-merge", testID: "tab-swaps" },
  { name: "profile", label: "Profile", icon: "person", testID: "tab-profile" },
];

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.barInner}>
        {state.routes.map((r: any, i: number) => {
          const focused = state.index === i;
          const meta = TABS.find((t) => t.name === r.name) || TABS[0];
          return (
            <Pressable
              key={r.key}
              testID={meta.testID}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate(r.name);
              }}
              style={styles.tab}
            >
              <MotiView
                animate={{
                  scale: focused ? 1.15 : 1,
                  translateY: focused ? -2 : 0,
                }}
                transition={{ type: "spring", damping: 12 }}
              >
                <Ionicons
                  name={focused ? meta.icon : (`${meta.icon}-outline` as IconName)}
                  size={24}
                  color={focused ? colors.brand : colors.textDim}
                />
              </MotiView>
              <Text style={[styles.label, { color: focused ? colors.brand : colors.textDim }]}>
                {meta.label}
              </Text>
              {focused && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "rgba(10,10,10,0.7)",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    overflow: "hidden",
  },
  barInner: { flexDirection: "row", paddingTop: 10, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 6, gap: 4 },
  label: { fontSize: 10, fontWeight: "500", letterSpacing: 0.5 },
  activeDot: { position: "absolute", bottom: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brand },
});
