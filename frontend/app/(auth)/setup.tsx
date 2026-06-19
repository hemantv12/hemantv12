import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { Chip } from "@/src/components/Chip";
import { Button } from "@/src/components/Button";
import { api } from "@/src/api";
import { colors } from "@/src/theme";

const POPULAR = [
  "Logo Design", "Web Design", "React Development", "Content Writing", "SEO",
  "Tax Consulting", "GST Filing", "Yoga Coaching", "Photography",
  "Video Editing", "Legal Advice", "Bookkeeping", "Spoken English", "Music Lessons",
];

const LEVELS = ["Beginner", "Good", "Expert"];

export default function Setup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [offered, setOffered] = useState<{ name: string; level: string }[]>([]);
  const [needed, setNeeded] = useState<{ name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [suggest, setSuggest] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (query.length < 1) { setSuggest([]); return; }
    (async () => {
      try {
        const r: any = await api.autocomplete(query);
        if (!cancelled) setSuggest(r.items || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [query]);

  const addOffered = (n: string) => {
    if (offered.find((o) => o.name === n) || offered.length >= 6) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOffered([...offered, { name: n, level: "Good" }]);
    setQuery("");
  };
  const addNeeded = (n: string) => {
    if (needed.find((o) => o.name === n) || needed.length >= 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNeeded([...needed, { name: n }]);
    setQuery("");
  };

  const finish = async () => {
    setBusy(true);
    try {
      await api.updateMe({
        name: name || "User",
        city: city || "Mumbai",
        offered,
        needed: needed.map((n) => ({ ...n, level: "Good" })),
      });
      router.replace("/(tabs)/home");
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.c} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => (step > 1 ? setStep(step - 1) : router.back())}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.progress}>
          <View style={[styles.bar, { width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }]} />
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }}>
            <Text style={styles.h1}>Apna intro do</Text>
            <Text style={styles.sub}>Naam aur shehar — bas itna chahiye.</Text>
            <Text style={styles.label}>NAAM</Text>
            <TextInput
              testID="setup-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Tumhara naam"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />
            <Text style={styles.label}>SHEHAR</Text>
            <TextInput
              testID="setup-city-input"
              value={city}
              onChangeText={setCity}
              placeholder="Mumbai"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />
          </MotiView>
        )}

        {step === 2 && (
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }}>
            <Text style={styles.h1}>Tum kya kar sakte ho?</Text>
            <Text style={styles.sub}>Max 6 skills. Level select karo.</Text>
            <TextInput
              testID="setup-skill-search"
              value={query}
              onChangeText={setQuery}
              placeholder="Skill type karo (e.g. Logo Design)"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />
            {suggest.length > 0 && (
              <View style={styles.suggest}>
                {suggest.map((s) => (
                  <Pressable key={s} onPress={() => addOffered(s)} style={styles.suggestItem}>
                    <Ionicons name="add-circle" color={colors.brand} size={18} />
                    <Text style={{ color: colors.text }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.label}>POPULAR</Text>
            <View style={styles.row}>
              {POPULAR.slice(0, 8).map((p) => (
                <Chip key={p} label={p} onPress={() => addOffered(p)} />
              ))}
            </View>
            <Text style={styles.label}>SELECTED ({offered.length}/6)</Text>
            <View style={{ gap: 10 }}>
              {offered.map((o, i) => (
                <View key={o.name} style={styles.skillRow}>
                  <Text style={{ color: colors.text, flex: 1, fontWeight: "500" }}>{o.name}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {LEVELS.map((l) => (
                      <Chip
                        key={l}
                        label={l}
                        small
                        active={o.level === l}
                        tone="brand"
                        onPress={() => {
                          const n = [...offered];
                          n[i].level = l;
                          setOffered(n);
                        }}
                      />
                    ))}
                  </View>
                  <Pressable onPress={() => setOffered(offered.filter((x) => x.name !== o.name))}>
                    <Ionicons name="close-circle" size={20} color={colors.textDim} />
                  </Pressable>
                </View>
              ))}
            </View>
          </MotiView>
        )}

        {step === 3 && (
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }}>
            <Text style={styles.h1}>Tumhe kya chahiye?</Text>
            <Text style={styles.sub}>Up to 3 skills jo tum learn ya use karna chahte ho.</Text>
            <TextInput
              testID="setup-need-search"
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. Tax Consulting"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />
            {suggest.length > 0 && (
              <View style={styles.suggest}>
                {suggest.map((s) => (
                  <Pressable key={s} onPress={() => addNeeded(s)} style={styles.suggestItem}>
                    <Ionicons name="add-circle" color={colors.teal} size={18} />
                    <Text style={{ color: colors.text }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.label}>POPULAR</Text>
            <View style={styles.row}>
              {POPULAR.slice(0, 8).map((p) => (
                <Chip key={p} label={p} tone="teal" onPress={() => addNeeded(p)} />
              ))}
            </View>
            <Text style={styles.label}>SELECTED ({needed.length}/3)</Text>
            <View style={styles.row}>
              {needed.map((o) => (
                <Chip key={o.name} label={o.name} active tone="teal" onPress={() => setNeeded(needed.filter((x) => x.name !== o.name))} />
              ))}
            </View>
          </MotiView>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          testID="setup-next-btn"
          label={step === 3 ? "SwapKaro Shuru Karo" : "Aage Badho"}
          loading={busy}
          onPress={() => {
            if (step === 1 && !name) return;
            if (step < 3) setStep(step + 1);
            else finish();
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  progress: { flex: 1, height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: "hidden" },
  bar: { height: 4, backgroundColor: colors.brand },
  h1: { color: "#fff", fontSize: 28, fontWeight: "500", letterSpacing: -0.6, marginBottom: 8 },
  sub: { color: colors.textDim, fontSize: 14, marginBottom: 28 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "500", letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  input: {
    height: 56, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 18,
    color: "#fff", fontSize: 16, borderWidth: 1, borderColor: colors.border,
  },
  suggest: { marginTop: 8, backgroundColor: colors.surface, borderRadius: 14, padding: 8, gap: 4, borderWidth: 1, borderColor: colors.border },
  suggestItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: colors.surface, borderRadius: 14 },
  footer: { padding: 20, paddingBottom: 40, backgroundColor: colors.bg },
});
