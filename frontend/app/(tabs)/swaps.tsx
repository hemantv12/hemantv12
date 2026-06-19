import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radii, cardShadow } from "@/src/theme";

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: "PENDING", color: colors.warn },
  accepted: { text: "ACTIVE", color: colors.teal },
  completed: { text: "DONE", color: colors.textDim },
  declined: { text: "DECLINED", color: colors.error },
};

const MILESTONE_LABEL = ["Draft", "Started", "Mid-way", "Delivered", "Complete"];

export default function Swaps() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    setRefresh(true);
    try {
      const [u, r] = await Promise.all([api.me(), api.listSwaps()]);
      setMe(u);
      setItems(r.items);
    } finally { setRefresh(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.c, { paddingTop: insets.top + 8 }]} testID="swaps-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Active Swaps</Text>
        <Text style={styles.sub}>{items.filter((i) => i.status === "accepted").length} ongoing · {items.filter((i) => i.status === "completed").length} done</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={load} tintColor={colors.brand} />}
      >
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="git-merge-outline" size={56} color={colors.textMute} />
            <Text style={styles.emptyT}>Koi swap nahi hai abhi</Text>
            <Text style={styles.emptyS}>Home pe ja ke pehla swap request bhejo.</Text>
            <Pressable testID="swap-go-home" onPress={() => router.replace("/(tabs)/home")} style={styles.emptyBtn}>
              <Text style={{ color: colors.brand, fontWeight: "500" }}>Barter Board pe jao</Text>
            </Pressable>
          </View>
        )}
        {items.map((s, i) => {
          const isOutgoing = s.from_user === me?.id;
          const other = s.other_user || {};
          const stat = STATUS_LABEL[s.status] || STATUS_LABEL.pending;
          return (
            <Pressable
              key={s.id}
              testID={`swap-${s.id}`}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: s.id, other: other.name } })}
            >
              <MotiView
                from={{ opacity: 0, translateY: 24 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: i * 80 }}
                style={[styles.card, cardShadow]}
              >
                <View style={styles.row}>
                  <Image source={{ uri: other.avatar }} style={styles.avatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{other.name}</Text>
                    <Text style={styles.skills}>
                      {isOutgoing ? s.my_skill : s.their_skill}
                      <Text style={{ color: colors.textDim }}>  ↔  </Text>
                      {isOutgoing ? s.their_skill : s.my_skill}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${stat.color}22`, borderColor: stat.color }]}>
                    <Text style={[styles.statusText, { color: stat.color }]}>{stat.text}</Text>
                  </View>
                </View>
                <View style={styles.timeline}>
                  {MILESTONE_LABEL.map((lbl, mi) => {
                    const active = mi <= (s.milestone || 0);
                    return (
                      <View key={lbl} style={{ flex: 1, alignItems: "center" }}>
                        <View style={[styles.dot, { backgroundColor: active ? colors.brand : colors.surfaceHi }]} />
                        <Text style={[styles.dotLabel, { color: active ? colors.text : colors.textMute }]}>{lbl}</Text>
                        {mi < MILESTONE_LABEL.length - 1 && (
                          <View style={[styles.line, { backgroundColor: mi < (s.milestone || 0) ? colors.brand : colors.surface, right: -50 }]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </MotiView>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { color: "#fff", fontSize: 28, fontWeight: "500", letterSpacing: -0.6 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceHi },
  name: { color: "#fff", fontSize: 16, fontWeight: "500" },
  skills: { color: colors.text, fontSize: 13, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "500", letterSpacing: 0.8 },
  timeline: { flexDirection: "row", marginTop: 18, paddingHorizontal: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, zIndex: 2 },
  dotLabel: { fontSize: 10, marginTop: 6, fontWeight: "500" },
  line: { position: "absolute", top: 5, height: 2, left: "50%", width: "100%" },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
  emptyT: { color: "#fff", fontSize: 18, fontWeight: "500", marginTop: 16 },
  emptyS: { color: colors.textDim, fontSize: 13, marginTop: 6, textAlign: "center" },
  emptyBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand },
});
