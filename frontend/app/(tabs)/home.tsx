import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, TextInput, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip } from "@/src/components/Chip";
import { FeedCard, FeedItem } from "@/src/components/FeedCard";
import { api } from "@/src/api";
import { colors } from "@/src/theme";

const CATEGORIES = ["All", "Tech", "Design", "Finance", "Education", "Legal", "Home", "Health"];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Tech: ["development", "react", "coding", "python", "web", "app"],
  Design: ["design", "branding", "logo", "ui", "ux", "photo"],
  Finance: ["tax", "gst", "book", "financial"],
  Education: ["english", "ielts", "maths", "tuition", "music", "lesson"],
  Legal: ["legal", "contract", "compliance"],
  Home: ["plumb", "electric", "paint", "repair"],
  Health: ["yoga", "fitness", "nutrition"],
};

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const [u, f] = await Promise.all([api.me(), api.feed()]);
      setMe(u);
      setItems(f.items);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((it) => {
    if (q) {
      const needle = q.toLowerCase();
      const hay = [it.name, ...it.offered.map((s) => s.name), ...it.needed.map((s) => s.name)].join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (cat !== "All") {
      const keys = CATEGORY_KEYWORDS[cat] || [];
      const hay = it.offered.map((s) => s.name.toLowerCase()).join(" ");
      if (!keys.some((k) => hay.includes(k))) return false;
    }
    return true;
  });

  const perfect = filtered[0];
  const others = filtered.slice(1);

  const sendSwap = async (it: FeedItem) => {
    try {
      const myFirst = me?.offered?.[0]?.name || "Service";
      const theirFirst = it.offered[0]?.name || "Service";
      const r: any = await api.createSwap({
        to_user: it.id,
        my_skill: myFirst,
        their_skill: theirFirst,
      });
      router.push({ pathname: "/chat/[id]", params: { id: r.swap.id, other: it.name } });
    } catch (e) { /* noop */ }
  };

  return (
    <View style={[styles.c, { paddingTop: insets.top }]} testID="home-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>Namaste,</Text>
          <Text style={styles.name}>{me?.name || "Dost"} 👋</Text>
          <Text style={styles.matchHint}>
            <Text style={{ color: colors.teal }}>{items.length} matches</Text> tumhare paas hai
          </Text>
        </View>
        <Pressable testID="home-notif" onPress={() => router.push("/notifications")} style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          <View style={styles.dot} />
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
      </View>

      <View style={styles.chipsWrap}>
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
        contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {perfect && perfect.match_pct >= 80 && (
          <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <View style={styles.perfectBanner}>
              <View style={styles.perfectBadge}>
                <Ionicons name="flame" size={12} color="#0A0A0A" />
                <Text style={styles.perfectText}>{perfect.match_pct}% MATCH MILA</Text>
              </View>
              <Text style={styles.perfectTitle}>
                {perfect.name} ke saath perfect barter
              </Text>
            </View>
          </MotiView>
        )}

        {filtered.length === 0 && !loading && (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={colors.textMute} />
            <Text style={{ color: colors.textDim, marginTop: 12 }}>Koi match nahi mila. Filter change karo.</Text>
          </View>
        )}

        {perfect && perfect.match_pct >= 80 && (
          <FeedCard item={perfect} index={0} onSwap={() => sendSwap(perfect)} perfect onPress={() => router.push({ pathname: "/user/[id]", params: { id: perfect.id } })} />
        )}
        {(perfect && perfect.match_pct >= 80 ? others : filtered).map((it, i) => (
          <FeedCard
            key={it.id}
            item={it}
            index={i + 1}
            onSwap={() => sendSwap(it)}
            onPress={() => router.push({ pathname: "/user/[id]", params: { id: it.id } })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  greet: { color: colors.textDim, fontSize: 14 },
  name: { color: "#fff", fontSize: 28, fontWeight: "500", letterSpacing: -0.6, marginTop: 2 },
  matchHint: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  dot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginTop: 18, height: 50, paddingHorizontal: 16,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  search: { flex: 1, color: "#fff", fontSize: 14 },
  chipsWrap: { marginTop: 14, height: 56, justifyContent: "center" },
  perfectBanner: {
    padding: 16, borderRadius: 20, marginBottom: 14,
    backgroundColor: "rgba(255,107,53,0.06)",
    borderWidth: 1, borderColor: "rgba(255,107,53,0.3)",
  },
  perfectBadge: {
    alignSelf: "flex-start", backgroundColor: colors.brand,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  perfectText: { color: "#0A0A0A", fontWeight: "500", fontSize: 11, letterSpacing: 0.8 },
  perfectTitle: { color: "#fff", fontSize: 16, fontWeight: "500", marginTop: 8 },
  empty: { alignItems: "center", padding: 40 },
});
