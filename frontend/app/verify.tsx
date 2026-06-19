import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { Chip } from "@/src/components/Chip";
import { Confetti } from "@/src/components/Confetti";
import { api } from "@/src/api";
import { colors, cardShadow } from "@/src/theme";

type Q = { q: string; options: string[]; answer: number };

export default function Verify() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [stage, setStage] = useState<"intro" | "loading" | "quiz" | "result">("intro");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [passed, setPassed] = useState(false);

  useEffect(() => { (async () => setMe(await api.me()))(); }, []);

  const start = async (s: string) => {
    setSkill(s);
    setStage("loading");
    try {
      const r: any = await api.quiz(s);
      setQuestions(r.questions || []);
      setIdx(0);
      setScore(0);
      setPicked(null);
      setStage("quiz");
    } catch {
      setStage("intro");
    }
  };

  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === questions[idx].answer;
    if (correct) setScore((s) => s + 1);
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => {
      if (idx + 1 < questions.length) {
        setIdx(idx + 1);
        setPicked(null);
      } else {
        finish(correct ? score + 1 : score);
      }
    }, 900);
  };

  const finish = async (final: number) => {
    setStage("result");
    try {
      const r: any = await api.quizSubmit({ skill, score: final, total: questions.length });
      setPassed(r.passed);
      if (r.passed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const u = await api.me(); setMe(u);
      }
    } catch {}
  };

  return (
    <View style={[styles.c, { paddingTop: insets.top }]} testID="verify-screen">
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerT}>Skill Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      {stage === "intro" && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={[styles.cert, cardShadow]}>
            <Ionicons name="ribbon" size={48} color={colors.gold} />
            <Text style={styles.certT}>SwapKaro Certified</Text>
            <Text style={styles.certS}>3-question AI quiz · ₹299 per skill</Text>
            <View style={styles.benefits}>
              {["Gold badge on profile", "LinkedIn-shareable certificate", "3x more swap requests"].map((b) => (
                <View key={b} style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.teal} />
                  <Text style={{ color: colors.text, fontSize: 13 }}>{b}</Text>
                </View>
              ))}
            </View>
          </MotiView>

          <Text style={styles.section}>SKILL CHUNO</Text>
          <View style={styles.chipRow}>
            {(me?.offered || []).map((s: any) => (
              <Chip
                key={s.name}
                label={s.verified ? `${s.name} ✓` : s.name}
                tone={s.verified ? "gold" : "brand"}
                active={s.verified}
                onPress={() => !s.verified && start(s.name)}
              />
            ))}
          </View>
          {(me?.offered || []).length === 0 && (
            <Text style={{ color: colors.textDim, marginTop: 12 }}>Setup mein skills add karo pehle.</Text>
          )}
        </ScrollView>
      )}

      {stage === "loading" && (
        <View style={styles.center}>
          <MotiView
            from={{ rotate: "0deg" }}
            animate={{ rotate: "360deg" }}
            transition={{ type: "timing", duration: 1200, loop: true, repeatReverse: false }}
          >
            <Ionicons name="sync" size={48} color={colors.brand} />
          </MotiView>
          <Text style={styles.loadingT}>AI quiz generate kar raha hai...</Text>
        </View>
      )}

      {stage === "quiz" && questions[idx] && (
        <View style={{ flex: 1, padding: 20 }}>
          <Text style={styles.quizProgress}>Question {idx + 1} of {questions.length}</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${((idx) / questions.length) * 100}%` }]} /></View>
          <MotiView key={idx} from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }}>
            <Text style={styles.quizQ}>{questions[idx].q}</Text>
            <View style={{ gap: 10, marginTop: 20 }}>
              {questions[idx].options.map((opt, i) => {
                const correct = i === questions[idx].answer;
                const selected = picked === i;
                const reveal = picked !== null;
                const bg = !reveal
                  ? colors.surface
                  : correct
                  ? "rgba(0,200,150,0.15)"
                  : selected
                  ? "rgba(255,68,68,0.15)"
                  : colors.surface;
                const border = !reveal ? colors.border : correct ? colors.teal : selected ? colors.error : colors.border;
                return (
                  <Pressable
                    key={i}
                    testID={`quiz-opt-${i}`}
                    onPress={() => answer(i)}
                    style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                  >
                    <Text style={{ color: "#fff", fontSize: 15, flex: 1 }}>{opt}</Text>
                    {reveal && correct && <Ionicons name="checkmark-circle" size={20} color={colors.teal} />}
                    {reveal && selected && !correct && <Ionicons name="close-circle" size={20} color={colors.error} />}
                  </Pressable>
                );
              })}
            </View>
          </MotiView>
        </View>
      )}

      {stage === "result" && (
        <View style={styles.center}>
          <Confetti active={passed} />
          <MotiView
            from={{ scale: 0, rotate: "-30deg" }}
            animate={{ scale: 1, rotate: "0deg" }}
            transition={{ type: "spring", damping: 10 }}
          >
            <Ionicons name={passed ? "ribbon" : "alert-circle"} size={96} color={passed ? colors.gold : colors.textDim} />
          </MotiView>
          <Text style={styles.resultT}>{passed ? "Verified! 🎉" : "Almost there"}</Text>
          <Text style={styles.resultS}>
            {passed
              ? `${skill} ab certified hai. Gold badge tumhare profile pe.`
              : `${score}/${questions.length} sahi. Phir try karo.`}
          </Text>
          <View style={{ height: 32 }} />
          <Button label={passed ? "Profile dekho" : "Wapas jao"} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} testID="verify-done" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerT: { color: "#fff", fontSize: 18, fontWeight: "500", flex: 1, textAlign: "center" },
  cert: { padding: 24, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  certT: { color: colors.gold, fontSize: 22, fontWeight: "500", marginTop: 12, letterSpacing: -0.4 },
  certS: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  benefits: { marginTop: 20, gap: 8, alignSelf: "stretch" },
  benefit: { flexDirection: "row", alignItems: "center", gap: 8 },
  section: { color: colors.textDim, fontSize: 11, letterSpacing: 1.2, fontWeight: "500", marginTop: 24, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  loadingT: { color: colors.textDim, marginTop: 20, fontSize: 14 },
  quizProgress: { color: colors.textDim, fontSize: 11, letterSpacing: 1, fontWeight: "500", marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: "hidden", marginBottom: 24 },
  progressFill: { height: 4, backgroundColor: colors.brand },
  quizQ: { color: "#fff", fontSize: 22, fontWeight: "500", letterSpacing: -0.4, lineHeight: 30 },
  option: { padding: 16, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  resultT: { color: "#fff", fontSize: 32, fontWeight: "500", marginTop: 24, letterSpacing: -0.6 },
  resultS: { color: colors.textDim, fontSize: 14, textAlign: "center", marginTop: 12, paddingHorizontal: 30 },
});
