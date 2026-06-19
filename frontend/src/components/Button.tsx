import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { colors, radii, glow } from "../theme";

type Variant = "primary" | "secondary" | "gold" | "ghost";

export function Button({
  label,
  onPress,
  loading,
  variant = "primary",
  testID,
  icon,
  fullWidth = true,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: Variant;
  testID?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}) {
  const handle = () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };
  const grad =
    variant === "gold"
      ? ["#FFD700", "#FFB800"]
      : variant === "secondary"
      ? [colors.surface, colors.surface]
      : variant === "ghost"
      ? ["transparent", "transparent"]
      : ["#FF8A57", "#FF6B35"];
  const textColor = variant === "secondary" || variant === "ghost" ? colors.text : "#0A0A0A";
  return (
    <Pressable testID={testID} onPress={handle} style={{ width: fullWidth ? "100%" : undefined }}>
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed ? 0.96 : 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
          style={[
            styles.wrap,
            variant === "primary" && glow,
            variant === "ghost" && { borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <LinearGradient colors={grad as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
            {loading ? (
              <ActivityIndicator color={textColor} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {icon}
                <Text style={[styles.label, { color: textColor }]}>{label}</Text>
              </View>
            )}
          </LinearGradient>
        </MotiView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radii.md, overflow: "hidden" },
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  label: { fontSize: 16, fontWeight: "500", letterSpacing: 0.2 },
});
