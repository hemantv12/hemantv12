import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { colors, radii } from "../theme";

export function Chip({
  label,
  active,
  onPress,
  tone = "neutral",
  testID,
  small,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: "neutral" | "brand" | "teal" | "gold";
  testID?: string;
  small?: boolean;
  icon?: React.ReactNode;
}) {
  const bg =
    active
      ? tone === "brand"
        ? colors.brand
        : tone === "teal"
        ? colors.teal
        : tone === "gold"
        ? colors.gold
        : colors.surfaceHi
      : colors.surface;
  const fg = active && (tone === "brand" || tone === "teal" || tone === "gold") ? "#0A0A0A" : colors.text;
  const border = active ? "transparent" : colors.border;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
    >
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed ? 0.94 : 1 }}
          transition={{ type: "spring", damping: 14 }}
          style={[
            styles.chip,
            small && { paddingVertical: 6, paddingHorizontal: 12, height: 32 },
            { backgroundColor: bg, borderColor: border },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {icon}
            <Text style={[styles.label, { color: fg, fontSize: small ? 12 : 13 }]}>{label}</Text>
          </View>
        </MotiView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  label: { fontWeight: "500", letterSpacing: 0.2 },
});
