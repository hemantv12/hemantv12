import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { formatDistanceToNow } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors } from "@/src/theme";

const ICON: Record<string, any> = {
  match: { i: "sparkles", c: colors.brand },
  request: { i: "git-pull-request", c: colors.teal },
  milestone: { i: "checkmark-done", c: colors.teal },
  score: { i: "trending-up", c: colors.gold },
  boost: { i: "rocket", c: colors.brand },
  pro: { i: "diamond", c: colors.gold },
};

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    setRefresh(true);
    try {
      const r: any = await api.notifs();
      setItems(r.items || []);
    } finally { setRefresh(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.c, { paddingTop: insets.top }]} testID="notifications-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerT}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={load} tintColor={colors.brand} />}
      >
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={48} color={colors.textMute} />
            <Text style={{ color: colors.textDim, marginTop: 12 }}>Koi notification nahi. Sab clear.</Text>
          </View>
        )}
        {items.map((n, i) => {
          const meta = ICON[n.type] || ICON.match;
          return (
            <MotiView
              key={n.id}
              from={{ opacity: 0, translateX: -20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ delay: i * 60 }}
              style={styles.notif}
            >
              <View style={[styles.iconBox, { backgroundColor: `${meta.c}22` }]}>
                <Ionicons name={meta.i} size={20} color={meta.c} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
                <Text style={styles.time}>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</Text>
              </View>
              {!n.read && <View style={styles.unread} />}
            </MotiView>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerT: { color: "#fff", fontSize: 18, fontWeight: "500", flex: 1, textAlign: "center" },
  notif: { flexDirection: "row", padding: 14, gap: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start" },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 14, fontWeight: "500" },
  body: { color: colors.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  time: { color: colors.textMute, fontSize: 11, marginTop: 6 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
  empty: { alignItems: "center", paddingTop: 80 },
});
