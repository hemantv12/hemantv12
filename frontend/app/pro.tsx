import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { Confetti } from "@/src/components/Confetti";
import { api } from "@/src/api";
import { colors, cardShadow } from "@/src/theme";

const FEATURES = [
  { f: "Unlimited matches", free: false, pro: true },
  { f: "Priority listing — top of feed", free: false, pro: true },
  { f: "Pro Verified gold badge", free: false, pro: true },
  { f: "SwapBot AI in every chat", free: false, pro: true },
  { f: "Advanced match filters", free: false, pro: true },
  { f: "Barter agreement templates", free: false, pro: true },
  { f: "Basic profile & 3 matches/mo", free: true, pro: true },
];

export default function Pro() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [busy, setBusy] = useState(false);
  const [justUpgraded, setJustUpgraded] = useState(false);

  useEffect(() => { (async () => setMe(await api.me()))(); }, []);

  const upgrade = async () => {
    setBusy(true);
    try {
      await api.upgradePro();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const u = await api.me();
      setMe(u);
      setJustUpgraded(true);
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")), 2400);
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.c, { paddingTop: insets.top }]} testID="pro-screen">
      <Confetti active={justUpgraded} count={50} />
      <View style={styles.header}>
        <Pressable testID="pro-close" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.back}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerT}>SwapKaro Pro</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <MotiView from={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} style={[styles.hero, cardShadow]}>
          <LinearGradient
            colors={["#3a2a00", "#1a1300", "#0A0A0A"]}
            style={StyleSheet.absoluteFill}
          />
          {/* shimmer sweep */}
          <MotiView
            from={{ translateX: -400 }}
            animate={{ translateX: 400 }}
            transition={{ type: "timing", duration: 2400, loop: true, repeatReverse: false }}
            style={styles.shimmer}
          >
            <LinearGradient
              colors={["transparent", "rgba(255,215,0,0.25)", "transparent"]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </MotiView>
          <View style={styles.crown}>
            <Ionicons name="diamond" size={28} color={colors.gold} />
          </View>
          <Text style={styles.hT}>{me?.is_pro ? "You're Pro 👑" : "Unlock Pro"}</Text>
          <Text style={styles.hS}>Unlimited matches · Gold badge · SwapBot in every chat</Text>
        </MotiView>

        <View style={styles.compare}>
          <View style={styles.compareHead}>
            <Text style={styles.cHColEmpty}> </Text>
            <Text style={styles.cHCol}>Free</Text>
            <Text style={[styles.cHCol, { color: colors.gold }]}>Pro</Text>
          </View>
          {FEATURES.map((row, i) => (
            <View key={i} style={[styles.cRow, i % 2 && { backgroundColor: colors.bg2 }]}>
              <Text style={styles.cFeat}>{row.f}</Text>
              <View style={styles.cCol}>
                <Ionicons name={row.free ? "checkmark" : "close"} size={16} color={row.free ? colors.teal : colors.textMute} />
              </View>
              <View style={styles.cCol}>
                <Ionicons name={row.pro ? "checkmark" : "close"} size={16} color={row.pro ? colors.gold : colors.textMute} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          <Pressable testID="plan-monthly" onPress={() => setPlan("monthly")} style={[styles.plan, plan === "monthly" && styles.planActive]}>
            <Text style={styles.planL}>Monthly</Text>
            <Text style={styles.planP}>₹99</Text>
            <Text style={styles.planU}>per month</Text>
          </Pressable>
          <Pressable testID="plan-yearly" onPress={() => setPlan("yearly")} style={[styles.plan, plan === "yearly" && styles.planActive]}>
            <View style={styles.savePill}><Text style={styles.savePillT}>SAVE 33%</Text></View>
            <Text style={styles.planL}>Yearly</Text>
            <Text style={styles.planP}>₹799</Text>
            <Text style={styles.planU}>= ₹67/month</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 20 }}>
          <Button
            testID="pro-start-trial"
            label={me?.is_pro ? "You're already Pro" : `Start 7-Day Free Trial · ${plan === "yearly" ? "₹799/yr" : "₹99/mo"}`}
            variant="gold"
            onPress={upgrade}
            loading={busy}
          />
        </View>
        <Text style={styles.foot}>Cancel anytime · No questions asked</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerT: { color: "#fff", fontSize: 18, fontWeight: "500", flex: 1, textAlign: "center" },
  hero: { padding: 28, borderRadius: 24, overflow: "hidden", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", marginBottom: 20 },
  shimmer: { position: "absolute", top: 0, bottom: 0, width: 80 },
  crown: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,215,0,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  hT: { color: colors.gold, fontSize: 28, fontWeight: "500", letterSpacing: -0.6 },
  hS: { color: colors.textDim, fontSize: 13, marginTop: 6, textAlign: "center" },
  compare: { backgroundColor: colors.surface, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  compareHead: { flexDirection: "row", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg2 },
  cHColEmpty: { flex: 2 },
  cHCol: { flex: 1, textAlign: "center", color: colors.text, fontSize: 12, fontWeight: "500", letterSpacing: 1 },
  cRow: { flexDirection: "row", padding: 14, alignItems: "center" },
  cFeat: { flex: 2, color: "#fff", fontSize: 13 },
  cCol: { flex: 1, alignItems: "center" },
  plans: { flexDirection: "row", gap: 10, marginTop: 20 },
  plan: { flex: 1, padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, position: "relative" },
  planActive: { borderColor: colors.gold, backgroundColor: "rgba(255,215,0,0.06)" },
  planL: { color: colors.textDim, fontSize: 11, letterSpacing: 1, fontWeight: "500" },
  planP: { color: "#fff", fontSize: 28, fontWeight: "500", letterSpacing: -0.6, marginTop: 6 },
  planU: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  savePill: { position: "absolute", top: -10, right: 12, backgroundColor: colors.teal, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  savePillT: { color: "#0A0A0A", fontSize: 9, fontWeight: "500", letterSpacing: 0.8 },
  foot: { color: colors.textDim, fontSize: 11, textAlign: "center", marginTop: 12 },
});
