import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Confetti } from "@/src/components/Confetti";
import { colors, radii, cardShadow } from "@/src/theme";
import { FEED, ME, DummyUser } from "@/src/dummy";

const TOP3: DummyUser[] = FEED.slice(0, 3);

export default function Matches() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [scanning, setScanning] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("u1");

  const run = () => {
    setScanning(true);
    setCelebrate(false);
    setTimeout(() => {
      setScanning(false);
      setCelebrate(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setCelebrate(false), 2400);
    }, 1700);
  };

  useEffect(() => { run(); }, []);

  return (
    <View style={[styles.c, { paddingTop: insets.top + 8 }]} testID="matches-screen">
      <Confetti active={celebrate} count={50} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI Matches</Text>
          <Text style={styles.sub}>
            {scanning
              ? "Hamara AI scan kar raha hai..."
              : `${TOP3.length} perfect matches mile`}
          </Text>
        </View>
        <Pressable testID="match-refresh" onPress={run} style={styles.refresh}>
          <MotiView animate={{ rotate: scanning ? "360deg" : "0deg" }} transition={{ loop: scanning, duration: 1000, type: "timing" }}>
            <Ionicons name="refresh" size={20} color={colors.text} />
          </MotiView>
        </Pressable>
      </View>

      {scanning ? <Scanner /> : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          {TOP3.map((m, i) => (
            <MatchCard
              key={m.id}
              match={m}
              index={i}
              expanded={expanded === m.id}
              onToggle={() => { Haptics.selectionAsync(); setExpanded(expanded === m.id ? null : m.id); }}
              onSwap={() => router.push({ pathname: "/user/[id]", params: { id: m.id } })}
              mySkill={ME.offered[0].name}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Scanner() {
  return (
    <View style={styles.scanWrap}>
      {[0, 1, 2].map((i) => (
        <MotiView
          key={i}
          from={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ type: "timing", duration: 2200, loop: true, delay: i * 600 }}
          style={[styles.scanRing, i === 1 && { borderColor: colors.teal }, i === 2 && { borderColor: colors.gold }]}
        />
      ))}
      <MotiView
        from={{ rotate: "0deg" }}
        animate={{ rotate: "360deg" }}
        transition={{ type: "timing", duration: 2400, loop: true, repeatReverse: false }}
        style={styles.scanArc}
      >
        <LinearGradient
          colors={["transparent", colors.brand, "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 100 }}
        />
      </MotiView>
      <View style={styles.scanCore}>
        <Ionicons name="sparkles" size={36} color={colors.brand} />
      </View>
      <MotiView
        from={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 600, loop: true, repeatReverse: true }}
        style={{ marginTop: 36 }}
      >
        <Text style={styles.scanText}>AI tumhare skills check kar raha hai</Text>
        <Text style={styles.scanSub}>Hinglish patterns · Location · SwapScore</Text>
      </MotiView>
    </View>
  );
}

function MatchCard({
  match, index, expanded, onToggle, onSwap, mySkill,
}: any) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 30 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: 80 + index * 120 }}
      style={[styles.card, cardShadow]}
    >
      <View style={styles.matchHead}>
        <View style={styles.matchAvatarRing}>
          <Image source={{ uri: match.avatar }} style={styles.matchAvatar} />
          {match.is_pro && (
            <View style={styles.matchProDot}>
              <Ionicons name="diamond" size={9} color="#0A0A0A" />
            </View>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.matchName}>{match.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Ionicons name="location" size={10} color={colors.textDim} />
            <Text style={styles.matchMeta}>{match.city} · {match.distance_km}km</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
            <Ionicons name="star" size={10} color={colors.gold} />
            <Text style={[styles.matchMeta, { color: colors.text, fontWeight: "600" }]}>{match.swap_score} SwapScore</Text>
          </View>
        </View>
        {/* Big match % donut */}
        <View style={styles.donut}>
          <MotiView
            from={{ rotate: "0deg" }}
            animate={{ rotate: "360deg" }}
            transition={{ type: "timing", duration: 1400, delay: index * 120 }}
            style={StyleSheet.absoluteFill}
          >
            <LinearGradient
              colors={[colors.brand, colors.gold, colors.brand]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderRadius: 36 }}
            />
          </MotiView>
          <View style={styles.donutInner}>
            <Text style={styles.donutNum}>{match.match_pct}</Text>
            <Text style={styles.donutPct}>%</Text>
          </View>
        </View>
      </View>

      {/* Exchange visual */}
      <View style={styles.swapRow}>
        <View style={styles.swapHalf}>
          <Text style={styles.swapLbl}>TUM DOGE</Text>
          <Text style={[styles.swapVal, { color: colors.teal }]} numberOfLines={1}>{mySkill}</Text>
        </View>
        <LinearGradient colors={[colors.teal, colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.swapIcon}>
          <Ionicons name="swap-horizontal" size={16} color="#0A0A0A" />
        </LinearGradient>
        <View style={styles.swapHalf}>
          <Text style={styles.swapLbl}>WO DENGE</Text>
          <Text style={[styles.swapVal, { color: colors.brand }]} numberOfLines={1}>{match.offered[0].name}</Text>
        </View>
      </View>

      {/* Why match — AI reason */}
      <Pressable onPress={onToggle} style={styles.whyBtn}>
        <Ionicons name="bulb" size={14} color={colors.gold} />
        <Text style={styles.whyText}>Kyun match hua?</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.textDim} />
      </Pressable>
      {expanded && (
        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.whyBody}
        >
          <Text style={styles.whyContent}>{match.reason}</Text>
        </MotiView>
      )}

      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSwap(); }}
        style={styles.cta}
      >
        <LinearGradient colors={["#FF8A57", "#FF6B35"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaInner}>
          <Text style={styles.ctaText}>Swap Request Bhejo</Text>
          <Ionicons name="arrow-forward" size={15} color="#0A0A0A" />
        </LinearGradient>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  title: { color: "#fff", fontSize: 30, fontWeight: "500", letterSpacing: -0.8 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  refresh: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },

  // Scanner
  scanWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scanRing: { position: "absolute", width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: colors.brand },
  scanArc: { position: "absolute", width: 200, height: 200, borderRadius: 100, opacity: 0.5 },
  scanCore: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  scanText: { color: colors.text, fontSize: 15, fontWeight: "500", textAlign: "center" },
  scanSub: { color: colors.textDim, fontSize: 11, marginTop: 6, textAlign: "center", letterSpacing: 0.5 },

  // Match card
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  matchHead: { flexDirection: "row", alignItems: "center" },
  matchAvatarRing: { padding: 3, borderRadius: 33, borderWidth: 2, borderColor: colors.brand, position: "relative" },
  matchAvatar: { width: 58, height: 58, borderRadius: 29 },
  matchProDot: { position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  matchName: { color: "#fff", fontSize: 17, fontWeight: "500" },
  matchMeta: { color: colors.textDim, fontSize: 11 },
  donut: { width: 72, height: 72, borderRadius: 36, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  donutInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  donutNum: { color: colors.brand, fontSize: 22, fontWeight: "500", letterSpacing: -0.5 },
  donutPct: { color: colors.brand, fontSize: 10, marginTop: 5, marginLeft: 1 },

  swapRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 },
  swapHalf: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  swapLbl: { color: colors.textDim, fontSize: 9, letterSpacing: 1, fontWeight: "500", marginBottom: 4 },
  swapVal: { fontSize: 14, fontWeight: "500" },
  swapIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  whyBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.bg2 },
  whyText: { color: colors.text, fontSize: 13, fontWeight: "500", flex: 1 },
  whyBody: {
    padding: 14, borderRadius: 12, marginTop: 8,
    backgroundColor: "rgba(255,215,0,0.06)", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)",
  },
  whyContent: { color: colors.text, fontSize: 13, lineHeight: 20 },

  cta: { marginTop: 14, borderRadius: radii.md, overflow: "hidden" },
  ctaInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  ctaText: { color: "#0A0A0A", fontWeight: "500", fontSize: 14 },
});
