import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { MotiView, AnimatePresence } from "moti";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button } from "@/src/components/Button";
import { colors } from "@/src/theme";

const slides = [
  {
    icon: "swap-horizontal" as const,
    title: "Apna Hunar Do",
    sub: "Tum jo achha karte ho, woh share karo. Design, coding, cooking — kuch bhi.",
    color: colors.brand,
  },
  {
    icon: "sparkles" as const,
    title: "AI Dhundega Match",
    sub: "Hamara AI Hinglish samajhta hai. Perfect skill-barter partner dhoondh ke laata hai.",
    color: colors.teal,
  },
  {
    icon: "people" as const,
    title: "Barter Karo, Badho",
    sub: "Paise nahi, sirf skills. Trust banao, network grow karo.",
    color: colors.gold,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const slide = slides[idx];

  const finish = async () => {
    await AsyncStorage.setItem("swapkaro_onboarded", "1");
    router.replace("/(auth)/login");
  };

  const next = () => {
    if (idx < 2) setIdx(idx + 1);
    else finish();
  };

  return (
    <View style={styles.container} testID="onboarding-screen">
      <Pressable testID="onboarding-skip" onPress={finish} style={styles.skip}>
        <Text style={{ color: colors.textDim, fontSize: 14 }}>Skip</Text>
      </Pressable>

      <View style={styles.body}>
        <AnimatePresence exitBeforeEnter>
          <MotiView
            key={idx}
            from={{ opacity: 0, translateX: 40 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: -40 }}
            transition={{ type: "timing", duration: 320 }}
            style={styles.slideBox}
          >
            <View style={[styles.iconWrap, Platform.OS === "web" ? { boxShadow: `0 0 30px ${slide.color}80`, borderColor: slide.color } as any : { borderColor: slide.color, shadowColor: slide.color }]}>
              <Ionicons name={slide.icon} size={64} color={slide.color} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.sub}>{slide.sub}</Text>
          </MotiView>
        </AnimatePresence>
      </View>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <MotiView
            key={i}
            animate={{
              width: idx === i ? 24 : 8,
              backgroundColor: idx === i ? colors.brand : colors.surface,
            }}
            style={styles.dot}
          />
        ))}
      </View>

      <View style={styles.cta}>
        <Button
          testID="onboarding-next-btn"
          label={idx === 2 ? "Shuru Karo" : "Aage Badho"}
          onPress={next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  skip: { position: "absolute", top: 60, right: 20, zIndex: 2, padding: 8 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  slideBox: { alignItems: "center", justifyContent: "center" },
  iconWrap: Platform.select({
    web: {
      width: 140, height: 140, borderRadius: 70, borderWidth: 2,
      alignItems: "center", justifyContent: "center", marginBottom: 40,
    },
    default: {
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 40,
      shadowOpacity: 0.5,
      shadowRadius: 30,
      elevation: 10,
    },
  }) as any,
  title: { color: "#fff", fontSize: 32, fontWeight: "500", letterSpacing: -0.8, marginBottom: 12, textAlign: "center" },
  sub: { color: colors.textDim, fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  cta: { paddingHorizontal: 24, paddingBottom: 40 },
});
