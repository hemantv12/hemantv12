import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { api } from "@/src/api";
import { colors, cardShadow } from "@/src/theme";

const OPTIONS = [
  { hours: 24, price: 29, label: "24 hours", reach: "~250 log" },
  { hours: 48, price: 49, label: "48 hours", reach: "~500 log", popular: true },
  { hours: 168, price: 149, label: "7 days", reach: "~1500 log" },
];

export default function Boost() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sel, setSel] = useState(48);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const buy = async () => {
    setBusy(true);
    try {
      await api.boost(sel);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
      setTimeout(() => router.back(), 2000);
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.c, { paddingTop: insets.top }]} testID="boost-screen">
      <View style={styles.header}>
        <Pressable testID="boost-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerT}>Boost Listing</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} style={[styles.preview, cardShadow]}>
          <View style={styles.boostBadge}>
            <Ionicons name="rocket" size={11} color="#0A0A0A" />
            <Text style={styles.boostBadgeT}>BOOSTED</Text>
          </View>
          <Text style={styles.previewT}>Aapki listing top pe</Text>
          <Text style={styles.previewS}>Logo Design  ↔  GST Filing · Mumbai</Text>
          <Text style={styles.previewMini}>~3x more swap requests</Text>
        </MotiView>

        <Text style={styles.section}>DURATION CHUNO</Text>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.hours}
              testID={`boost-${o.hours}`}
              onPress={() => { Haptics.selectionAsync(); setSel(o.hours); }}
            >
              <View style={[styles.option, sel === o.hours && styles.optionActive]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.optionT}>{o.label}</Text>
                    {o.popular && (
                      <View style={styles.popular}>
                        <Text style={styles.popularT}>MOST POPULAR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.optionR}>Reach: {o.reach}</Text>
                </View>
                <Text style={styles.optionP}>₹{o.price}</Text>
                <View style={[styles.radio, sel === o.hours && styles.radioActive]}>
                  {sel === o.hours && <View style={styles.radioInner} />}
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.payInfo}>
          <Ionicons name="card" size={14} color={colors.textDim} />
          <Text style={styles.payText}>UPI · Cards · Netbanking via Razorpay (mock)</Text>
        </View>

        {done && (
          <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.success}>
            <Ionicons name="checkmark-circle" size={32} color={colors.teal} />
            <Text style={styles.successT}>Boost activated 🚀</Text>
          </MotiView>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          testID="boost-buy"
          label={done ? "Boost Activated ✓" : `Boost Karo · ₹${OPTIONS.find((o) => o.hours === sel)?.price}`}
          onPress={buy}
          loading={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerT: { color: "#fff", fontSize: 18, fontWeight: "500", flex: 1, textAlign: "center" },
  preview: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)" },
  boostBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  boostBadgeT: { color: "#0A0A0A", fontSize: 10, fontWeight: "500", letterSpacing: 0.8 },
  previewT: { color: "#fff", fontSize: 18, fontWeight: "500", marginTop: 10 },
  previewS: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  previewMini: { color: colors.teal, fontSize: 12, fontWeight: "500", marginTop: 8 },
  section: { color: colors.textDim, fontSize: 11, letterSpacing: 1.2, fontWeight: "500", marginTop: 24, marginBottom: 10 },
  option: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 },
  optionActive: { borderColor: colors.brand, backgroundColor: "rgba(255,107,53,0.06)" },
  optionT: { color: "#fff", fontSize: 15, fontWeight: "500" },
  optionR: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  optionP: { color: colors.brand, fontSize: 18, fontWeight: "500" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brand },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  popular: { backgroundColor: colors.teal, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  popularT: { color: "#0A0A0A", fontSize: 8, fontWeight: "500", letterSpacing: 0.6 },
  payInfo: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, padding: 10, justifyContent: "center" },
  payText: { color: colors.textDim, fontSize: 11 },
  success: { alignItems: "center", marginTop: 20, padding: 20, borderRadius: 16, backgroundColor: "rgba(0,200,150,0.1)", borderWidth: 1, borderColor: colors.teal },
  successT: { color: colors.teal, fontSize: 16, fontWeight: "500", marginTop: 8 },
  footer: { padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
