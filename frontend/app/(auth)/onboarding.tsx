import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Dimensions, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button } from "@/src/components/Button";
import { colors, space } from "@/src/theme";

const { width: W } = Dimensions.get("window");

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
  const ref = useRef<FlatList>(null);
  const [idx, setIdx] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem("swapkaro_onboarded", "1");
    router.replace("/(auth)/login");
  };

  const next = () => {
    if (idx < 2) {
      const ni = idx + 1;
      setIdx(ni);
      ref.current?.scrollToIndex({ index: ni, animated: true });
    } else finish();
  };

  return (
    <View style={styles.container} testID="onboarding-screen">
      <Pressable testID="onboarding-skip" onPress={finish} style={styles.skip}>
        <Text style={{ color: colors.textDim, fontSize: 14 }}>Skip</Text>
      </Pressable>
      <FlatList
        ref={ref}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item, index }) => (
          <View style={{ width: W, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <MotiView
              from={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12 }}
              key={index === idx ? "in" : "out"}
              style={[styles.iconWrap, { borderColor: item.color, shadowColor: item.color }]}
            >
              <Ionicons name={item.icon} size={64} color={item.color} />
            </MotiView>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
          </View>
        )}
        keyExtractor={(_, i) => String(i)}
      />
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <MotiView
            key={i}
            animate={{ width: idx === i ? 24 : 8, backgroundColor: idx === i ? colors.brand : colors.surface }}
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
  iconWrap: {
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
  title: { color: "#fff", fontSize: 32, fontWeight: "500", letterSpacing: -0.8, marginBottom: 12 },
  sub: { color: colors.textDim, fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  cta: { paddingHorizontal: 24, paddingBottom: 40 },
});
