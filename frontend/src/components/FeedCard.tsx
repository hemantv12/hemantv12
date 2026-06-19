import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radii, cardShadow } from "@/src/theme";

export type FeedItem = {
  id: string;
  name: string;
  city: string;
  avatar: string;
  offered: { name: string; level: string; verified?: boolean }[];
  needed: { name: string; level: string }[];
  swap_score: number;
  swaps_completed: number;
  is_pro: boolean;
  match_pct: number;
  distance_km: number;
  response_time_mins?: number;
};

export function FeedCard({
  item,
  index,
  onSwap,
  onPress,
  perfect,
}: {
  item: FeedItem;
  index: number;
  onSwap: () => void;
  onPress?: () => void;
  perfect?: boolean;
}) {
  const give = item.offered[0]?.name || "Skill";
  const want = item.needed[0]?.name || "—";
  return (
    <MotiView
      from={{ opacity: 0, translateY: 40 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 80, type: "timing", duration: 420 }}
      style={[styles.card, cardShadow, perfect && styles.perfectGlow]}
    >
      {perfect && (
        <LinearGradient
          colors={["rgba(255,107,53,0.15)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Pressable onPress={onPress}>
        <View style={styles.head}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.is_pro && (
                <View style={styles.proPill}>
                  <Ionicons name="diamond" size={10} color="#0A0A0A" />
                  <Text style={styles.proText}>PRO</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Ionicons name="location" size={11} color={colors.textDim} />
              <Text style={styles.meta}>{item.city} · {item.distance_km}km</Text>
              <View style={styles.star} />
              <Ionicons name="star" size={11} color={colors.gold} />
              <Text style={styles.meta}>{item.swap_score}</Text>
            </View>
          </View>
          <View style={[styles.matchBadge, perfect && { backgroundColor: colors.brand }]}>
            <Text style={[styles.matchText, perfect && { color: "#0A0A0A" }]}>{item.match_pct}%</Text>
          </View>
        </View>

        <View style={styles.pillsRow}>
          <View style={[styles.pill, { backgroundColor: "rgba(0,200,150,0.12)", borderColor: "rgba(0,200,150,0.3)" }]}>
            <Text style={styles.pillLabel}>DE SAKTA HAI</Text>
            <Text style={[styles.pillSkill, { color: colors.teal }]} numberOfLines={1}>{give}</Text>
          </View>
          <View style={styles.swapIconWrap}>
            <Ionicons name="swap-horizontal" size={18} color={colors.brand} />
          </View>
          <View style={[styles.pill, { backgroundColor: "rgba(255,107,53,0.12)", borderColor: "rgba(255,107,53,0.3)" }]}>
            <Text style={styles.pillLabel}>CHAHIYE</Text>
            <Text style={[styles.pillSkill, { color: colors.brand }]} numberOfLines={1}>{want}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="checkmark-done" size={12} color={colors.textDim} />
            <Text style={styles.statText}>{item.swaps_completed} swaps</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="flash" size={12} color={colors.textDim} />
            <Text style={styles.statText}>~{item.response_time_mins || 30}min</Text>
          </View>
          {item.offered[0]?.verified && (
            <View style={styles.stat}>
              <Ionicons name="shield-checkmark" size={12} color={colors.teal} />
              <Text style={[styles.statText, { color: colors.teal }]}>Verified</Text>
            </View>
          )}
        </View>
      </Pressable>

      <Pressable
        testID={`feed-swap-${item.id}`}
        onPress={onSwap}
        style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.8 : 1 }]}
      >
        <LinearGradient colors={["#FF8A57", "#FF6B35"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaInner}>
          <Text style={styles.ctaText}>Swap Request Bhejo</Text>
          <Ionicons name="arrow-forward" size={16} color="#0A0A0A" />
        </LinearGradient>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  perfectGlow: { borderColor: colors.brand, shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 24 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceHi },
  name: { color: "#fff", fontSize: 16, fontWeight: "500" },
  meta: { color: colors.textDim, fontSize: 12 },
  star: { width: 6 },
  proPill: {
    backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 3,
  },
  proText: { color: "#0A0A0A", fontSize: 9, fontWeight: "500", letterSpacing: 0.8 },
  matchBadge: {
    backgroundColor: colors.surfaceHi, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  matchText: { color: colors.brand, fontWeight: "500", fontSize: 15, letterSpacing: 0.3 },
  pillsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1 },
  pillLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1, fontWeight: "500", marginBottom: 4 },
  pillSkill: { fontSize: 14, fontWeight: "500" },
  swapIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg2 },
  statsRow: { flexDirection: "row", gap: 16, marginTop: 14, marginBottom: 4 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: colors.textDim, fontSize: 11 },
  cta: { marginTop: 14, borderRadius: radii.md, overflow: "hidden" },
  ctaInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  ctaText: { color: "#0A0A0A", fontWeight: "500", fontSize: 15 },
});
