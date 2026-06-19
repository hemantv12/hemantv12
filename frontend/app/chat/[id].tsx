import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api";
import { colors, radii } from "@/src/theme";

const STEPS = ["Draft", "Started", "Mid-way", "Delivered", "Complete"];

export default function Chat() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, other } = useLocalSearchParams<{ id: string; other?: string }>();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [swap, setSwap] = useState<any>(null);
  const [text, setText] = useState("");
  const [botMode, setBotMode] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try {
      const [u, m, sl] = await Promise.all([api.me(), api.messages(id), api.listSwaps()]);
      setMe(u);
      setMsgs(m.items || []);
      const found = (sl.items || []).find((s: any) => s.id === id);
      setSwap(found);
    } catch {}
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
  }, [msgs.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const t = text;
    setText("");
    try {
      if (botMode) {
        setMsgs((m) => [...m, { id: "tmp-u", sender: me.id, text: t }]);
        const reply: any = await api.askBot(id, t);
        setMsgs((m) => [...m, reply]);
        setBotMode(false);
      } else {
        const r: any = await api.sendMsg(id, t);
        setMsgs((m) => [...m, r]);
      }
    } finally { setSending(false); }
  };

  const advance = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const r: any = await api.advance(id);
    setSwap(r);
    setMsgs((m) => [
      ...m,
      { id: `sys-${Date.now()}`, sender: "bot", is_bot: true, text: `Milestone advanced → ${STEPS[r.milestone]}. ${r.status === "completed" ? "Swap COMPLETE! SwapScore +12 🎉" : ""}` },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
      style={[styles.c, { paddingTop: insets.top }]}
      testID="chat-screen"
    >
      <View style={styles.header}>
        <Pressable testID="chat-back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{other || swap?.other_user?.name || "Swap"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={styles.greenDot} />
            <Text style={styles.status}>{swap?.status === "completed" ? "Swap done" : "Active swap"}</Text>
          </View>
        </View>
        <Pressable
          testID="chat-bot-toggle"
          onPress={() => { Haptics.selectionAsync(); setBotMode((b) => !b); }}
          style={[styles.botChip, botMode && { backgroundColor: colors.brand }]}
        >
          <Ionicons name="sparkles" size={14} color={botMode ? "#0A0A0A" : colors.brand} />
          <Text style={[styles.botChipText, botMode && { color: "#0A0A0A" }]}>SwapBot</Text>
        </Pressable>
      </View>

      {swap && (
        <View style={styles.milestoneBar}>
          {STEPS.map((s, i) => {
            const active = i <= (swap.milestone || 0);
            return (
              <View key={s} style={{ flex: 1, alignItems: "center" }}>
                <View style={[styles.mdot, { backgroundColor: active ? colors.brand : colors.surfaceHi }]} />
                <Text style={[styles.mlabel, { color: active ? colors.text : colors.textMute }]}>{s}</Text>
              </View>
            );
          })}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        renderItem={({ item, index }) => {
          const mine = item.sender === me?.id;
          const bot = item.is_bot;
          return (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: Math.min(index, 5) * 30 }}
              style={[styles.bubbleWrap, mine && { alignItems: "flex-end" }]}
            >
              {bot && <Text style={styles.botLabel}>SwapBot · AI</Text>}
              <View
                style={[
                  styles.bubble,
                  mine && styles.mine,
                  bot && styles.botBubble,
                ]}
              >
                <Text style={[styles.text, mine && { color: "#0A0A0A" }]}>{item.text}</Text>
              </View>
            </MotiView>
          );
        }}
      />

      {swap && swap.status !== "completed" && (
        <Pressable testID="chat-milestone" onPress={advance} style={styles.milestoneBtn}>
          <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
          <Text style={styles.milestoneText}>Mark milestone done →</Text>
        </Pressable>
      )}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          testID="chat-input"
          value={text}
          onChangeText={setText}
          placeholder={botMode ? "SwapBot ko poocho..." : "Message likho..."}
          placeholderTextColor={colors.textMute}
          style={styles.input}
          multiline
        />
        <Pressable testID="chat-send" onPress={send} style={styles.sendBtn}>
          <Ionicons name={botMode ? "sparkles" : "arrow-up"} size={18} color="#0A0A0A" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { color: "#fff", fontSize: 17, fontWeight: "500" },
  status: { color: colors.teal, fontSize: 11 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },
  botChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand },
  botChipText: { color: colors.brand, fontSize: 12, fontWeight: "500" },
  milestoneBar: { flexDirection: "row", padding: 14, backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.border },
  mdot: { width: 10, height: 10, borderRadius: 5 },
  mlabel: { fontSize: 9, fontWeight: "500", marginTop: 6, letterSpacing: 0.5 },
  bubbleWrap: { marginVertical: 4 },
  bubble: { maxWidth: "82%", padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mine: { backgroundColor: colors.brand, borderColor: "transparent" },
  botBubble: { backgroundColor: "rgba(255,215,0,0.08)", borderColor: "rgba(255,215,0,0.25)" },
  text: { color: "#fff", fontSize: 14, lineHeight: 20 },
  botLabel: { color: colors.gold, fontSize: 10, fontWeight: "500", letterSpacing: 1, marginBottom: 4, marginLeft: 4 },
  milestoneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(0,200,150,0.1)", borderWidth: 1, borderColor: "rgba(0,200,150,0.3)" },
  milestoneText: { color: colors.teal, fontWeight: "500", fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.surface, color: "#fff", fontSize: 14, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
