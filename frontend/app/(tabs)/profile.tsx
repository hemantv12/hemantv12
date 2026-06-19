import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView, MotiText } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip } from "@/src/components/Chip";
import { pickImageBase64 } from "@/src/utils/image";
import { colors, radii, cardShadow } from "@/src/theme";
import { ME, HISTORY } from "@/src/dummy";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [avatar, setAvatar] = useState(ME.avatar);

  const change = async () => {
    const i = await pickImageBase64({ square: true });
    if (i) setAvatar(i);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      testID="profile-screen"
    >
      <View style={styles.topRow}>
        <Text style={styles.topT}>Profile</Text>
        <Pressable style={styles.iconBtn} testID="profile-share">
          <Ionicons name="share-social-outline" size={18} color={colors.text} />
        </Pressable>
        <Pressable style={styles.iconBtn} testID="profile-settings">
          <Ionicons name="settings-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Hero */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "spring", damping: 16 }}
        style={styles.hero}
      >
        <Pressable testID="profile-avatar" onPress={change}>
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
            <View style={styles.proRibbon}>
              <Ionicons name="diamond" size={11} color="#0A0A0A" />
              <Text style={styles.proText}>PRO</Text>
            </View>
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={12} color="#0A0A0A" />
            </View>
          </View>
        </Pressable>

        <Text style={styles.name}>{ME.name}</Text>
        <View style={styles.metaPills}>
          <View style={styles.metaPill}>
            <Ionicons name="location" size={11} color={colors.textDim} />
            <Text style={styles.metaPillT}>{ME.city}</Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: "rgba(0,200,150,0.1)", borderColor: "rgba(0,200,150,0.3)" }]}>
            <View style={styles.greenDot} />
            <Text style={[styles.metaPillT, { color: colors.teal }]}>Open for Swap</Text>
          </View>
        </View>
      </MotiView>

      {/* Hero SwapScore card */}
      <MotiView
        from={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 120, type: "spring" }}
        style={styles.scoreCardWrap}
      >
        <View style={[styles.scoreCard, cardShadow]}>
          <LinearGradient
            colors={["rgba(255,107,53,0.18)", "transparent"]}
            start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.scoreHead}>
            <Text style={styles.scoreLabel}>SWAPSCORE</Text>
            <View style={styles.deltaPill}>
              <Ionicons name="trending-up" size={11} color={colors.teal} />
              <Text style={styles.deltaText}>+{ME.delta_week} this week</Text>
            </View>
          </View>
          <View style={styles.scoreRow}>
            <MotiText
              from={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 14, delay: 200 }}
              style={styles.scoreBig}
            >
              {ME.swap_score}
            </MotiText>
            <View style={styles.scoreRight}>
              <Text style={styles.scoreTier}>ELITE</Text>
              <View style={styles.tierStars}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Ionicons key={i} name="star" size={10} color={i <= 4 ? colors.gold : colors.textMute} />
                ))}
              </View>
              <Text style={styles.scoreRankT}>Top <Text style={{ color: colors.brand, fontWeight: "600" }}>5%</Text> in Mumbai</Text>
            </View>
          </View>

          {/* Breakdown bars */}
          <View style={styles.bars}>
            <Bar label="Delivery" value={ME.delivery} color={colors.brand} />
            <Bar label="Quality" value={ME.quality} color={colors.teal} />
            <Bar label="Comms" value={ME.comms} color={colors.gold} />
          </View>
        </View>
      </MotiView>

      {/* Stats trio */}
      <View style={styles.statsRow}>
        <StatCell num={ME.swaps_completed} label="Swaps Done" />
        <View style={styles.statDiv} />
        <StatCell num={ME.people_helped} label="Helped" />
        <View style={styles.statDiv} />
        <StatCell num={ME.skills_exchanged} label="Skills" />
      </View>

      {/* Skills offered */}
      <View style={styles.section}>
        <View style={styles.secHead}>
          <Text style={styles.secT}>SKILLS I OFFER</Text>
          <Pressable testID="verify-cta" onPress={() => router.push("/verify")}>
            <Text style={styles.secCta}>Verify all →</Text>
          </Pressable>
        </View>
        <View style={styles.chipsCol}>
          {ME.offered.map((s) => (
            <View key={s.name} style={[styles.skillCard, s.verified && { borderColor: "rgba(255,215,0,0.3)" }]}>
              <View style={[styles.skillIcon, { backgroundColor: s.verified ? "rgba(255,215,0,0.15)" : "rgba(255,107,53,0.12)" }]}>
                <Ionicons name={s.verified ? "ribbon" : "color-palette"} size={16} color={s.verified ? colors.gold : colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.skillName}>{s.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Text style={styles.skillLevel}>{s.level}</Text>
                  {s.verified && (
                    <>
                      <View style={styles.skillDot} />
                      <Ionicons name="shield-checkmark" size={10} color={colors.gold} />
                      <Text style={[styles.skillLevel, { color: colors.gold }]}>Verified</Text>
                    </>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </View>
          ))}
        </View>
      </View>

      {/* Skills needed */}
      <View style={styles.section}>
        <Text style={styles.secT}>MUJHE CHAHIYE</Text>
        <View style={styles.chipsRow}>
          {ME.needed.map((s) => (
            <Chip key={s.name} label={s.name} tone="teal" active small />
          ))}
        </View>
      </View>

      {/* Barter history */}
      <View style={styles.section}>
        <Text style={styles.secT}>BARTER HISTORY</Text>
        <View style={{ gap: 10, marginTop: 4 }}>
          {HISTORY.map((h, i) => (
            <MotiView
              key={h.id}
              from={{ opacity: 0, translateX: -20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ delay: 200 + i * 80 }}
              style={styles.histCard}
            >
              <Image source={{ uri: h.avatar }} style={styles.histAvatar} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.histName}>{h.name}</Text>
                  {h.verified && (
                    <View style={styles.histVerified}>
                      <Ionicons name="shield-checkmark" size={9} color={colors.teal} />
                      <Text style={styles.histVerifiedT}>VERIFIED</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.histSwap}>
                  <Text style={{ color: colors.teal }}>{h.gave}</Text>
                  <Text style={{ color: colors.textDim }}>  ↔  </Text>
                  <Text style={{ color: colors.brand }}>{h.got}</Text>
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <View style={{ flexDirection: "row" }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons key={i} name="star" size={10} color={i <= h.rating ? colors.gold : colors.textMute} />
                    ))}
                  </View>
                  <Text style={styles.histWhen}>{h.when}</Text>
                </View>
              </View>
            </MotiView>
          ))}
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.linksRow}>
        <ActionTile icon="rocket" label="Boost Listing" tint={colors.brand} onPress={() => router.push("/boost")} />
        <ActionTile icon="ribbon" label="Verify Skill" tint={colors.gold} onPress={() => router.push("/verify")} />
      </View>
    </ScrollView>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <MotiView
          from={{ width: "0%" }}
          animate={{ width: `${value}%` }}
          transition={{ type: "timing", duration: 900, delay: 300 }}
          style={[styles.barFill, { backgroundColor: color }]}
        />
      </View>
      <Text style={[styles.barValue, { color }]}>{value}</Text>
    </View>
  );
}

function StatCell({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statN}>{num}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

function ActionTile({ icon, label, tint, onPress }: any) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Ionicons name="arrow-forward" size={14} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 6, gap: 10 },
  topT: { color: "#fff", fontSize: 22, fontWeight: "500", flex: 1, letterSpacing: -0.4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },

  hero: { alignItems: "center", paddingTop: 18, paddingHorizontal: 20 },
  avatarRing: { width: 116, height: 116, borderRadius: 58, padding: 4, borderWidth: 2, borderColor: colors.brand, position: "relative" },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  proRibbon: {
    position: "absolute", bottom: -6, alignSelf: "center", left: "50%", marginLeft: -28,
    backgroundColor: colors.gold, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  proText: { color: "#0A0A0A", fontSize: 10, fontWeight: "500", letterSpacing: 1 },
  editBadge: { position: "absolute", bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.text, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  name: { color: "#fff", fontSize: 26, fontWeight: "500", letterSpacing: -0.5, marginTop: 16 },
  metaPills: { flexDirection: "row", gap: 8, marginTop: 10 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  metaPillT: { color: colors.textDim, fontSize: 11, fontWeight: "500" },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },

  // Score card
  scoreCardWrap: { paddingHorizontal: 20, marginTop: 22 },
  scoreCard: { padding: 22, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  scoreHead: { flexDirection: "row", alignItems: "center" },
  scoreLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1.6, fontWeight: "500", flex: 1 },
  deltaPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: "rgba(0,200,150,0.12)", borderWidth: 1, borderColor: "rgba(0,200,150,0.3)" },
  deltaText: { color: colors.teal, fontSize: 10, fontWeight: "500" },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 10 },
  scoreBig: { color: colors.brand, fontSize: 72, fontWeight: "500", letterSpacing: -3, lineHeight: 76 },
  scoreRight: { marginLeft: 18, marginBottom: 8 },
  scoreTier: { color: colors.gold, fontSize: 12, fontWeight: "500", letterSpacing: 1.4 },
  tierStars: { flexDirection: "row", marginTop: 4, gap: 2 },
  scoreRankT: { color: colors.textDim, fontSize: 11, marginTop: 8 },
  bars: { marginTop: 18, gap: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { color: colors.textDim, fontSize: 11, width: 60, fontWeight: "500" },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  barValue: { fontSize: 12, fontWeight: "500", width: 26, textAlign: "right" },

  statsRow: { flexDirection: "row", marginHorizontal: 20, marginTop: 14, padding: 16, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  statCell: { flex: 1, alignItems: "center" },
  statN: { color: "#fff", fontSize: 22, fontWeight: "500", letterSpacing: -0.4 },
  statL: { color: colors.textDim, fontSize: 10, letterSpacing: 0.8, marginTop: 2, fontWeight: "500" },
  statDiv: { width: 1, backgroundColor: colors.border },

  section: { marginHorizontal: 20, marginTop: 26 },
  secHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  secT: { color: colors.textDim, fontSize: 10, letterSpacing: 1.6, fontWeight: "500", flex: 1 },
  secCta: { color: colors.brand, fontSize: 12, fontWeight: "500" },

  chipsCol: { gap: 8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillCard: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  skillIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  skillName: { color: "#fff", fontSize: 14, fontWeight: "500" },
  skillLevel: { color: colors.textDim, fontSize: 11 },
  skillDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMute },

  histCard: { flexDirection: "row", padding: 12, gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  histAvatar: { width: 40, height: 40, borderRadius: 20 },
  histName: { color: "#fff", fontSize: 14, fontWeight: "500" },
  histVerified: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(0,200,150,0.12)" },
  histVerifiedT: { color: colors.teal, fontSize: 8, fontWeight: "500", letterSpacing: 0.6 },
  histSwap: { fontSize: 12, marginTop: 4, fontWeight: "500" },
  histWhen: { color: colors.textDim, fontSize: 10 },

  linksRow: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 22 },
  tile: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tileLabel: { color: "#fff", fontSize: 13, fontWeight: "500", flex: 1 },
});
