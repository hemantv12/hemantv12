import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, cardShadow, radii } from "@/src/theme";
import { Button } from "@/src/components/Button";

export default function Matches() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [scanning, setScanning] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setScanning(true);
    try {
      const [u, r] = await Promise.all([api.me(), api.aiMatches()]);
      setMe(u);
      // small delay for AI scan effect
      setTimeout(() => {
        setMatches(r.matches);
        setScanning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 1500);
    } catch {
      setScanning(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sendSwap = async (m: any) => {
    try {
      const r: any = await api.createSwap({
        to_user: m.id,
        my_skill: me?.offered?.[0]?.name || "Service",
        their_skill: m.offered[0]?.name || "Service",
      });
      router.push({ pathname: "/chat/[id]", params: { id: r.swap.id, other: m.name } });
    } catch {}
  };

  return (
    <View style={[styles.c, { paddingTop: insets.top + 8 }]} testID="matches-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Matches</Text>
          <Text style={styles.sub}>
            {scanning ? "AI dhoondh raha hai..." : `${matches.length} perfect matches mile`}
          </Text>
        </View>
        <Pressable testID="match-refresh" onPress={load} style={styles.refresh}>
          <Ionicons name="refresh" size={20} color={colors.text} />
        </Pressable>
      </View>

      {scanning ? (
        <View style={styles.scanWrap}>
          <MotiView
            from={{ scale: 0.8, opacity: 0.4 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{ type: "timing", duration: 1500, loop: true }}
            style={styles.scanRing}
          />
          <MotiView
            from={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ type: "timing", duration: 1800, loop: true, delay: 400 }}
            style={[styles.scanRing, { borderColor: colors.teal }]}
          />
          <View style={styles.scanCore}>
            <Ionicons name="sparkles" size={32} color={colors.brand} />
          </View>
          <Text style={styles.scanText}>AI tumhare skills check kar raha hai...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {matches.map((m, i) => (
            <MotiView
              key={m.id}
              from={{ opacity: 0, translateY: 30 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: i * 100 }}
              style={[styles.matchCard, cardShadow]}
            >
              <View style={styles.matchHead}>
                <Image source={{ uri: m.avatar }} style={styles.avatar} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.matchName}>{m.name}</Text>
                  <Text style={styles.matchCity}>{m.city} · {m.distance_km}km</Text>
                </View>
                <MotiView
                  from={{ rotate: "0deg" }}
                  animate={{ rotate: "360deg" }}
                  transition={{ type: "timing", duration: 1000 }}
                  style={styles.ringWrap}
                >
                  <LinearGradient
                    colors={[colors.brand, colors.teal, colors.brand]}
                    style={styles.ring}
                  >
                    <View style={styles.ringInner}>
                      <Text style={styles.matchPct}>{m.match_pct}</Text>
                      <Text style={styles.matchPctSign}>%</Text>
                    </View>
                  </LinearGradient>
                </MotiView>
              </View>

              <View style={styles.exchangeRow}>
                <View style={styles.exchangePill}>
                  <Text style={styles.exchangeLabel}>TUM DOGE</Text>
                  <Text style={[styles.exchangeText, { color: colors.teal }]} numberOfLines={1}>
                    {me?.offered?.[0]?.name || "Skill"}
                  </Text>
                </View>
                <Ionicons name="swap-horizontal" size={20} color={colors.brand} />
                <View style={styles.exchangePill}>
                  <Text style={styles.exchangeLabel}>WO DENGE</Text>
                  <Text style={[styles.exchangeText, { color: colors.brand }]} numberOfLines={1}>
                    {m.offered[0]?.name || "Skill"}
                  </Text>
                </View>
              </View>

              <Pressable
                testID={`match-why-${m.id}`}
                onPress={() => setExpanded(expanded === m.id ? null : m.id)}
                style={styles.whyBtn}
              >
                <Ionicons name="bulb" size={14} color={colors.gold} />
                <Text style={styles.whyText}>Kyun match hua?</Text>
                <Ionicons name={expanded === m.id ? "chevron-up" : "chevron-down"} size={14} color={colors.textDim} />
              </Pressable>
              {expanded === m.id && (
                <MotiView from={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" as any }} style={styles.whyBody}>
                  <Text style={styles.whyContent}>{m.reason}</Text>
                </MotiView>
              )}

              <View style={{ marginTop: 14 }}>
                <Button testID={`match-swap-${m.id}`} label="Swap Request Bhejo" onPress={() => sendSwap(m)} />
              </View>
            </MotiView>
          ))}
          {matches.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={48} color={colors.textMute} />
              <Text style={{ color: colors.textDim, marginTop: 12, textAlign: "center" }}>
                Profile complete karo — AI behtar matches dhoondhega.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { color: "#fff", fontSize: 28, fontWeight: "500", letterSpacing: -0.6 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  refresh: { marginLeft: "auto", width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scanWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scanRing: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: colors.brand },
  scanCore: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  scanText: { color: colors.textDim, marginTop: 32, fontSize: 14 },
  matchCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  matchHead: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceHi },
  matchName: { color: "#fff", fontSize: 17, fontWeight: "500" },
  matchCity: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  ringWrap: { width: 64, height: 64, borderRadius: 32 },
  ring: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  ringInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  matchPct: { color: colors.brand, fontSize: 18, fontWeight: "500" },
  matchPctSign: { color: colors.brand, fontSize: 10, marginTop: 2 },
  exchangeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  exchangePill: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  exchangeLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1, fontWeight: "500", marginBottom: 4 },
  exchangeText: { fontSize: 14, fontWeight: "500" },
  whyBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.bg2 },
  whyText: { color: colors.text, fontSize: 13, fontWeight: "500", flex: 1 },
  whyBody: { padding: 12, borderRadius: 12, marginTop: 8, backgroundColor: "rgba(255,215,0,0.06)", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  whyContent: { color: colors.text, fontSize: 13, lineHeight: 20 },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
});
