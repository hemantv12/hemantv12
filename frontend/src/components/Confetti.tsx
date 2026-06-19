import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { MotiView } from "moti";
import { colors } from "../theme";

const COLORS = [colors.brand, colors.teal, colors.gold, "#FF8A57", "#FFFFFF"];

/**
 * Lightweight programmatic confetti — 30 pieces fall + rotate.
 * Avoids a Lottie JSON dependency while looking premium.
 */
export function Confetti({ active, count = 30 }: { active: boolean; count?: number }) {
  const { width: W, height: H } = Dimensions.get("window");
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * W,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        delay: Math.random() * 400,
        duration: 1600 + Math.random() * 1400,
        spinTo: (Math.random() * 720 - 360),
        drift: (Math.random() * 80 - 40),
      })),
    [count, W]
  );
  if (!active) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden", pointerEvents: "none" }]} testID="confetti">
      {pieces.map((p) => (
        <MotiView
          key={p.id}
          from={{
            translateY: -40,
            translateX: 0,
            rotate: "0deg",
            opacity: 1,
          }}
          animate={{
            translateY: H + 40,
            translateX: p.drift,
            rotate: `${p.spinTo}deg`,
            opacity: 0,
          }}
          transition={{ type: "timing", duration: p.duration, delay: p.delay }}
          style={[
            styles.piece,
            { left: p.left, width: p.size, height: p.size * 0.4, backgroundColor: p.color },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: "absolute",
    top: 0,
    borderRadius: 2,
  },
});
