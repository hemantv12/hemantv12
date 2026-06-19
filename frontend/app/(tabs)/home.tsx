import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable, TextInput, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip } from "@/src/components/Chip";
import { colors, radii, cardShadow } from "@/src/theme";
import { ME, FEED, DummyUser } from "@/src/dummy";

const CATEGORIES = ["All", "Design", "Finance", "Tech", "Education", "Legal", "Health", "Home"];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const filtered = FEED.filter((u) => {
    if (q && !u.name.toLowerCase().includes(q.toLowerCase()) &&
        !u.offered.some((s) => s.name.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  const perfect = filtered[0];
  const others = filtered.slice(1);

  return (
    <View style={[styles.c, { paddingTop: insets.top }]} testID="home-screen">
      {/* Hero header with greeting */}
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>Namaste,</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
              <Text style={styles.name}>{ME.name.split(" ")[0]}</Text>
              <Text style={{ fontSize: 22 }}>👋</Text>
            </View>
            <View style={styles.hintRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.hint}>
                <Text style={{ color: colors.teal, fontWeight: "600" }}>3 new matches</Text>
                <Text style={{ color: colors.textDim }}> today · AI working in background</Text>
              </Text>
            </View>
          </View>
          <Pressable testID="home-notif" onPress={() => router.push("/notifications")} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            <View style={styles.notifDot}>
              <Text style={styles.notifDotText}>3</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textDim} />
          <TextInput
            testID="home-search"
            value={q}
            onChangeText={setQ}
            placeholder="Skill dhundo..."
            placeholderTextColor={colors.textMute}
            style={styles.search}
          />
          <Pressable style={styles.filterBtn}>
            <Ionicons name="options" size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          renderItem={({ item }) => (
            <Chip
              testID={`cat-${item}`}
              label={item}
              active={cat === item}
              tone="brand"
              onPress={() => setCat(item)}
            />
          )}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Perfect match banner */}
        {perfect && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "spring", damping: 16 }}
          >
            <Pressable onPress={() => router.push({ pathname: "/user/[id]", params: { id: perfect.id } })}>
              <View style={styles.perfectCard}>
                <LinearGradient
                  colors={["rgba(255,107,53,0.22)", "rgba(255,107,53,0.02)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.perfectHead}>
                  <View style={styles.fireBadge}>
                    <Ionicons name="flame" size={11} color="#0A0A0A" />
                    <Text style={styles.fireBadgeText}>{perfect.match_pct}% MATCH MILA</Text>
                  </View>
                  <Text style={styles.perfectTime}>2 min pehle</Text>
                </View>
                <View style={styles.perfectRow}>
                  <View style={styles.perfectAvatarRing}>
                    <Image source={{ uri: perfect.avatar }} style={styles.perfectAvatar} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.perfectName}>{perfect.name}</Text>
                    <Text style={styles.perfectExchange}>
                      <Text style={{ color: colors.teal }}>{perfect.offered[0].name}</Text>
                      <Text style={{ color: colors.textDim }}>  ↔  </Text>
                      <Text style={{ color: colors.brand }}>{perfect.needed[0]?.name || "Logo Design"}</Text>
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={32} color={colors.brand} />
                </View>
              </View>
            </Pressable>
          </MotiView>
        )}

        <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>

        {others.map((u, i) => (
          <FeedCardV2
            key={u.id}
            item={u}
            index={i}
            saved={!!saved[u.id]}
            onSave={() => { Haptics.selectionAsync(); setSaved((s) => ({ ...s, [u.id]: !s[u.id] })); }}
            onPress={() => router.push({ pathname: "/user/[id]", params: { id: u.id } })}
            onSwap={() => router.push("/(tabs)/matches")}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FeedCardV2({
  item, index, saved, onSwap, onSave, onPress,
}: {
  item: DummyUser;
  index: number;
  saved: boolean;
  onSwap: () => void;
  onSave: () => void;
  onPress: () => void;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 30 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: 80 + index * 80, type: "timing", duration: 420 }}
      style={[styles.card, cardShadow]}
    >
      <Pressable onPress={onPress}>
        <View style={styles.cardHead}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.is_pro && (
                <View style={styles.proPill}>
                  <Ionicons name="diamond" size={9} color="#0A0A0A" />
                  <Text style={styles.proPillText}>PRO</Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location" size={10} color={colors.textDim} />
              <Text style={styles.meta}>{item.city}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{item.distance_km}km</Text>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="star" size={10} color={colors.gold} />
              <Text style={[styles.meta, { color: colors.text, fontWeight: "600" }]}>
                {item.swap_score}
              </Text>
            </View>
          </View>
          <Pressable testID={`save-${item.id}`} onPress={onSave} hitSlop={10}>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={20} color={saved ? colors.brand : colors.textDim} />
          </Pressable>
        </View>

        {/* Exchange visualization */}
        <View style={styles.exchangeRow}>
          <View style={[styles.exchangePill, { borderColor: "rgba(0,200,150,0.3)", backgroundColor: "rgba(0,200,150,0.06)" }]}>
            <Text style={styles.exchangeLabel}>DE SAKTA HAI</Text>
            <Text style={[styles.exchangeText, { color: colors.teal }]} numberOfLines={1}>
              {item.offered[0].name}
            </Text>
            {item.offered[0].verified && (
              <View style={styles.verifyTick}>
                <Ionicons name="shield-checkmark" size={10} color={colors.teal} />
                <Text style={styles.verifyText}>verified</Text>
              </View>
            )}
          </View>
          <View style={styles.arrowWrap}>
            <LinearGradient colors={[colors.teal, colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.arrowGrad}>
              <Ionicons name="swap-horizontal" size={14} color="#0A0A0A" />
            </LinearGradient>
          </View>
          <View style={[styles.exchangePill, { borderColor: "rgba(255,107,53,0.3)", backgroundColor: "rgba(255,107,53,0.06)" }]}>
            <Text style={styles.exchangeLabel}>CHAHIYE</Text>
            <Text style={[styles.exchangeText, { color: colors.brand }]} numberOfLines={1}>
              {item.needed[0]?.name || "Logo Design"}
            </Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.stat}>
            <Ionicons name="checkmark-done" size={12} color={colors.teal} />
            <Text style={styles.statText}>{item.swaps_completed} swaps</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Ionicons name="flash" size={12} color={colors.warn} />
            <Text style={styles.statText}>~{item.response_time_mins}min reply</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={[styles.matchPctBox, item.match_pct >= 90 && { backgroundColor: "rgba(255,107,53,0.15)", borderColor: colors.brand }]}>
            <Text style={[styles.matchPctText, item.match_pct >= 90 && { color: colors.brand }]}>{item.match_pct}%</Text>
          </View>
        </View>
      </Pressable>

      <Pressable testID={`swap-${item.id}`} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSwap(); }} style={styles.swapBtn}>
        <LinearGradient colors={["#FF8A57", "#FF6B35"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swapBtnInner}>
          <Text style={styles.swapBtnText}>Swap Request Bhejo</Text>
          <Ionicons name="arrow-forward" size={15} color="#0A0A0A" />
        </LinearGradient>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  greet: { color: colors.textDim, fontSize: 14, fontWeight: "500", letterSpacing: 0.3 },
  name: { color: "#fff", fontSize: 30, fontWeight: "500", letterSpacing: -0.8 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },
  hint: { fontSize: 13 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, position: "relative",
  },
  notifDot: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.bg,
  },
  notifDotText: { color: "#0A0A0A", fontSize: 10, fontWeight: "500" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, height: 52, paddingHorizontal: 16,
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
  },
  search: { flex: 1, color: "#fff", fontSize: 14, height: "100%" },
  filterBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center" },
  chipsRow: { height: 56, justifyContent: "center" },

  // Perfect-match card
  perfectCard: {
    padding: 18, borderRadius: 22, marginBottom: 20, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,107,53,0.45)", backgroundColor: "rgba(255,107,53,0.04)",
  },
  perfectHead: { flexDirection: "row", alignItems: "center" },
  fireBadge: {
    backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  fireBadgeText: { color: "#0A0A0A", fontWeight: "500", fontSize: 11, letterSpacing: 0.8 },
  perfectTime: { color: colors.textDim, fontSize: 11, marginLeft: "auto" },
  perfectRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  perfectAvatarRing: { padding: 2, borderRadius: 32, borderWidth: 2, borderColor: colors.brand },
  perfectAvatar: { width: 56, height: 56, borderRadius: 28 },
  perfectName: { color: "#fff", fontSize: 17, fontWeight: "500" },
  perfectExchange: { fontSize: 13, marginTop: 4, fontWeight: "500" },

  sectionTitle: { color: colors.textDim, fontSize: 10, letterSpacing: 1.6, fontWeight: "500", marginBottom: 12 },

  // Feed card
  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceHi },
  cardName: { color: "#fff", fontSize: 16, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  meta: { color: colors.textDim, fontSize: 12 },
  dot: { color: colors.textMute, fontSize: 12 },
  proPill: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 3 },
  proPillText: { color: "#0A0A0A", fontSize: 9, fontWeight: "500", letterSpacing: 0.8 },

  exchangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exchangePill: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1 },
  exchangeLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1, fontWeight: "500", marginBottom: 4 },
  exchangeText: { fontSize: 14, fontWeight: "500" },
  verifyTick: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  verifyText: { color: colors.teal, fontSize: 10, letterSpacing: 0.5 },
  arrowWrap: { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  arrowGrad: { flex: 1, alignItems: "center", justifyContent: "center" },

  statsStrip: {
    flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border, gap: 10,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statText: { color: colors.textDim, fontSize: 11, fontWeight: "500" },
  statDiv: { width: 1, height: 12, backgroundColor: colors.border },
  matchPctBox: {
    marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border,
  },
  matchPctText: { color: colors.text, fontSize: 12, fontWeight: "500" },

  swapBtn: { marginTop: 14, borderRadius: radii.md, overflow: "hidden" },
  swapBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  swapBtnText: { color: "#0A0A0A", fontWeight: "500", fontSize: 14, letterSpacing: 0.2 },
});
