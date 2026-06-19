import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView, MotiText } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, clearToken } from "@/src/api";
import { pickImageBase64 } from "@/src/utils/image";
import { colors, radii, cardShadow } from "@/src/theme";
import { Chip } from "@/src/components/Chip";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    setRefresh(true);
    try { setMe(await api.me()); } finally { setRefresh(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const logout = async () => {
    await clearToken();
    router.replace("/(auth)/login");
  };

  const changeAvatar = async () => {
    const img = await pickImageBase64({ square: true });
    if (img) {
      setMe({ ...me, avatar: img });
      try { await api.updateMe({ avatar: img }); } catch {}
    }
  };

  if (!me) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={load} tintColor={colors.brand} />}
      testID="profile-screen"
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerT}>Profile</Text>
        <Pressable testID="profile-logout" onPress={logout} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Pressable testID="profile-avatar" onPress={changeAvatar} style={[styles.avatarRing, me.is_open && { borderColor: colors.brand }]}>
          <Image
            source={{ uri: me.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80" }}
            style={styles.avatar}
          />
          <View style={styles.avatarEdit}>
            <Ionicons name="camera" size={12} color="#0A0A0A" />
          </View>
          {me.is_pro && (
            <View style={styles.proRibbon}>
              <Ionicons name="diamond" size={11} color="#0A0A0A" />
              <Text style={styles.proText}>PRO</Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.name}>{me.name || "User"}</Text>
        <Text style={styles.city}>{me.city} · Member since 2026</Text>

        <View style={styles.scoreWrap}>
          <Text style={styles.scoreLabel}>SWAPSCORE</Text>
          <MotiText
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring" }}
            style={styles.score}
          >
            {me.swap_score}
          </MotiText>
          <View style={styles.scoreBars}>
            <View style={styles.scoreBar}><Text style={styles.bL}>Delivery</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: "92%" }]} /></View></View>
            <View style={styles.scoreBar}><Text style={styles.bL}>Quality</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: "88%", backgroundColor: colors.teal }]} /></View></View>
            <View style={styles.scoreBar}><Text style={styles.bL}>Comms</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: "85%", backgroundColor: colors.gold }]} /></View></View>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statN}>{me.swaps_completed}</Text><Text style={styles.statL}>Swaps</Text></View>
        <View style={styles.statDiv} />
        <View style={styles.stat}><Text style={styles.statN}>{me.people_helped}</Text><Text style={styles.statL}>Helped</Text></View>
        <View style={styles.statDiv} />
        <View style={styles.stat}><Text style={styles.statN}>{(me.offered || []).length}</Text><Text style={styles.statL}>Skills</Text></View>
      </View>

      {!me.is_pro && (
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.proCardWrap}
        >
          <Pressable testID="upgrade-pro-card" onPress={() => router.push("/pro")}>
            <LinearGradient
              colors={["#FFD700", "#FFB800", "#FF6B35"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.proCard}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.proT}>Upgrade to Pro 👑</Text>
                <Text style={styles.proS}>Unlimited matches · Gold badge · SwapBot AI</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={28} color="#0A0A0A" />
            </LinearGradient>
          </Pressable>
        </MotiView>
      )}

      <View style={styles.section}>
        <View style={styles.secHeader}>
          <Text style={styles.secT}>Skills I Offer</Text>
          <Pressable testID="verify-skills-btn" onPress={() => router.push("/verify")}>
            <Text style={styles.secCta}>Verify →</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          {(me.offered || []).map((s: any) => (
            <Chip
              key={s.name}
              label={`${s.name}${s.verified ? "  ✓" : ""}`}
              tone={s.verified ? "gold" : "brand"}
              active
              small
            />
          ))}
          {(me.offered || []).length === 0 && <Text style={{ color: colors.textDim }}>Setup mein skills add karo.</Text>}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secT}>Mujhe Chahiye</Text>
        <View style={styles.chipRow}>
          {(me.needed || []).map((s: any) => (
            <Chip key={s.name} label={s.name} tone="teal" active small />
          ))}
        </View>
      </View>

      <View style={styles.linksWrap}>
        <ProfileLink icon="rocket" label="Boost My Listing" onPress={() => router.push("/boost")} testID="link-boost" tint={colors.brand} />
        <ProfileLink icon="shield-checkmark" label="Skill Verification" onPress={() => router.push("/verify")} testID="link-verify" tint={colors.gold} />
        <ProfileLink icon="notifications" label="Notifications" onPress={() => router.push("/notifications")} testID="link-notifs" />
        <ProfileLink icon="diamond" label={me.is_pro ? "SwapKaro Pro ✓" : "SwapKaro Pro"} onPress={() => router.push("/pro")} testID="link-pro" tint={colors.gold} />
      </View>
    </ScrollView>
  );
}

function ProfileLink({ icon, label, onPress, testID, tint }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
      <View style={[styles.linkIcon, { backgroundColor: tint ? `${tint}22` : colors.bg2 }]}>
        <Ionicons name={icon} size={18} color={tint || colors.text} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  headerT: { color: "#fff", fontSize: 24, fontWeight: "500", flex: 1, letterSpacing: -0.4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", paddingHorizontal: 20, paddingTop: 12 },
  avatarRing: { width: 108, height: 108, borderRadius: 54, padding: 4, borderWidth: 2, borderColor: colors.border, position: "relative" },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarEdit: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  proRibbon: {
    position: "absolute", bottom: -2, alignSelf: "center", left: 30,
    backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 100, flexDirection: "row", alignItems: "center", gap: 3,
  },
  proText: { color: "#0A0A0A", fontSize: 10, fontWeight: "500", letterSpacing: 1 },
  name: { color: "#fff", fontSize: 24, fontWeight: "500", marginTop: 16, letterSpacing: -0.4 },
  city: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  scoreWrap: { marginTop: 24, width: "100%", alignItems: "center", padding: 20, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, ...cardShadow },
  scoreLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1.2, fontWeight: "500" },
  score: { color: colors.brand, fontSize: 64, fontWeight: "500", letterSpacing: -2, marginTop: 4 },
  scoreBars: { width: "100%", marginTop: 12, gap: 8 },
  scoreBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  bL: { color: colors.textDim, fontSize: 11, width: 60 },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.bg2, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  statsRow: { flexDirection: "row", marginHorizontal: 20, marginTop: 16, padding: 16, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: "center" },
  statDiv: { width: 1, backgroundColor: colors.border },
  statN: { color: "#fff", fontSize: 22, fontWeight: "500" },
  statL: { color: colors.textDim, fontSize: 11, letterSpacing: 0.8, marginTop: 2 },
  proCardWrap: { marginHorizontal: 20, marginTop: 16 },
  proCard: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: 20, gap: 12 },
  proT: { color: "#0A0A0A", fontSize: 17, fontWeight: "500" },
  proS: { color: "rgba(10,10,10,0.7)", fontSize: 12, marginTop: 2 },
  section: { marginHorizontal: 20, marginTop: 24 },
  secHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  secT: { color: colors.textDim, fontSize: 11, letterSpacing: 1.2, fontWeight: "500", flex: 1 },
  secCta: { color: colors.brand, fontSize: 13, fontWeight: "500" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linksWrap: { marginHorizontal: 20, marginTop: 24, gap: 4 },
  link: { flexDirection: "row", alignItems: "center", padding: 14, gap: 14, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  linkIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  linkLabel: { color: "#fff", fontSize: 15, flex: 1, fontWeight: "500" },
});
