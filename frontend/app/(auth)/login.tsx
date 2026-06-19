import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/src/components/Button";
import { api, setToken } from "@/src/api";
import { colors } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (step === "otp") setTimeout(() => refs.current[0]?.focus(), 100);
  }, [step]);

  const sendOtp = async () => {
    if (phone.length < 10) {
      setErr("Sahi mobile number daalo");
      return;
    }
    setBusy(true); setErr("");
    try {
      await api.requestOtp(phone);
      setStep("otp");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setBusy(true); setErr("");
    try {
      const r: any = await api.verifyOtp(phone, code);
      await setToken(r.token);
      try { await api.seedNotifs(); } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (r.is_new) router.replace("/(auth)/setup");
      else router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr("Galat OTP. Try 123456");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setOtp(["", "", "", "", "", ""]);
      setShakeKey((k) => k + 1);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = clean;
    setOtp(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 6) verify(next.join(""));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      testID="login-screen"
    >
      <Pressable onPress={() => (step === "otp" ? setStep("phone") : router.back())} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.body}>
        {step === "phone" ? (
          <MotiView from={{ translateY: 20, opacity: 0 }} animate={{ translateY: 0, opacity: 1 }}>
            <Text style={styles.h1}>Apna number daalo</Text>
            <Text style={styles.sub}>OTP bhejenge — koi spam nahi.</Text>
            <View style={styles.phoneRow}>
              <View style={styles.cc}>
                <Text style={{ color: colors.text, fontSize: 16 }}>+91</Text>
              </View>
              <TextInput
                testID="login-phone-input"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                keyboardType="number-pad"
                placeholder="98765 43210"
                placeholderTextColor={colors.textMute}
                style={styles.phoneInput}
              />
            </View>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <View style={{ height: 24 }} />
            <Button testID="login-send-otp-btn" label="OTP Bhejo" onPress={sendOtp} loading={busy} />
            <Pressable testID="google-login-btn" style={styles.google} onPress={() => verify("123456")}>
              <Ionicons name="logo-google" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "500" }}>Google se shuru karo</Text>
            </Pressable>
          </MotiView>
        ) : (
          <MotiView
            key={shakeKey}
            from={{ translateX: 0 }}
            animate={{ translateX: 0 }}
            transition={{ type: "timing", duration: 80 }}
          >
            <Text style={styles.h1}>OTP daalo</Text>
            <Text style={styles.sub}>+91 {phone} pe bheja hai. Demo: 123456</Text>
            <MotiView
              key={`shake-${shakeKey}`}
              from={{ translateX: shakeKey > 0 ? -8 : 0 }}
              animate={{ translateX: 0 }}
              transition={{ type: "timing", duration: 80, loop: false }}
              style={styles.otpRow}
            >
              {otp.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { refs.current[i] = r; }}
                  testID={`otp-input-${i}`}
                  value={d}
                  onChangeText={(v) => setDigit(i, v)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
                />
              ))}
            </MotiView>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <View style={{ height: 16 }} />
            <Button
              testID="login-verify-btn"
              label="Verify Karo"
              loading={busy}
              onPress={() => verify(otp.join(""))}
            />
          </MotiView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  back: { padding: 16, width: 56 },
  body: { paddingHorizontal: 24, marginTop: 24 },
  h1: { color: "#fff", fontSize: 32, fontWeight: "500", letterSpacing: -0.8, marginBottom: 8 },
  sub: { color: colors.textDim, fontSize: 15, marginBottom: 32 },
  phoneRow: { flexDirection: "row", gap: 12 },
  cc: {
    height: 56, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  phoneInput: {
    flex: 1, height: 56, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    color: "#fff", fontSize: 20, fontWeight: "500", letterSpacing: 1,
  },
  otpRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  otpBox: {
    flex: 1, height: 56, borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, color: "#fff",
    fontSize: 24, fontWeight: "500", textAlign: "center",
  },
  otpBoxFilled: { borderColor: colors.brand },
  err: { color: colors.error, marginTop: 12, fontSize: 13 },
  google: {
    marginTop: 16, height: 56, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
});
