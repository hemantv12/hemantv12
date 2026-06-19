import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { api } from "@/src/api";
import { colors, cardShadow } from "@/src/theme";

export default function UserDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [u, setU] = useState<any>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([api.user(id), api.me()]);
      setU(a); setMe(b);
    })();
  }, [id]);

  if (!u) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const sendSwap = async () => {
    const r: any = await api.createSwap({
      to_user: u.id,
      my_skill: me?.offered?.[0]?.name || "Service",
      their_skill: u.offered[0]?.name || "Service",
    });
    router.replace({ pathname: "/chat/[id]", params: { id: r.swap.id, other: u.name } });
  };

  return (
    <View style={[styles.c, { paddingTop: insets.top }]} testID="user-detail-screen">
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerT}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={[styles.hero, cardShadow]}>
          <View style={styles.avatarRing}>
            <Image source={{ uri: u.avatar }} style={styles.avatar} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}>
            <Text style={styles.name}>{u.name}</Text>
            {u.is_pro && (
              <View style={styles.proBadge}>
                <Ionicons name="diamond" size={10} color="#0A0A0A" />
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={styles.city}>{u.city}</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCell}>
              <Text style={styles.scoreN}>{u.swap_score}</Text>
              <Text style={styles.scoreL}>SwapScore</Text>
            </View>
            <View style={styles.div} />
            <View style={styles.scoreCell}>
              <Text style={styles.scoreN}>{u.swaps_completed}</Text>
              <Text style={styles.scoreL}>Swaps</Text>
            </View>
            <View style={styles.div} />
            <View style={styles.scoreCell}>
              <Text style={styles.scoreN}>{u.people_helped}</Text>
              <Text style={styles.scoreL}>Helped</Text>
            </View>
          </View>
        </MotiView>

        <Text style={styles.section}>OFFERS</Text>
        <View style={styles.row}>
          {u.offered.map((s: any) => (
            <Chip key={s.name} label={`${s.name}${s.verified ? "  ✓" : ""}`} tone={s.verified ? "gold" : "brand"} active small />
          ))}
        </View>

        <Text style={styles.section}>NEEDS</Text>
        <View style={styles.row}>
          {u.needed.map((s: any) => (
            <Chip key={s.name} label={s.name} tone="teal" active small />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button testID="user-send-swap" label={`Swap with ${u.name.split(" ")[0]}`} onPress={sendSwap} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerT: { color: "#fff", fontSize: 18, fontWeight: "500", flex: 1, textAlign: "center" },
  hero: { alignItems: "center", padding: 24, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatarRing: { padding: 4, borderRadius: 60, borderWidth: 2, borderColor: colors.brand },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  name: { color: "#fff", fontSize: 22, fontWeight: "500", letterSpacing: -0.4 },
  proBadge: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 3 },
  proText: { color: "#0A0A0A", fontSize: 9, fontWeight: "500", letterSpacing: 0.8 },
  city: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  scoreRow: { flexDirection: "row", marginTop: 20, alignSelf: "stretch" },
  scoreCell: { flex: 1, alignItems: "center" },
  scoreN: { color: colors.brand, fontSize: 22, fontWeight: "500" },
  scoreL: { color: colors.textDim, fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
  div: { width: 1, backgroundColor: colors.border },
  section: { color: colors.textDim, fontSize: 11, letterSpacing: 1.2, fontWeight: "500", marginTop: 24, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
});
