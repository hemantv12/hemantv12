import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MotiView, MotiText } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, space } from "@/src/theme";
import { getToken } from "@/src/api";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(async () => {
      const seen = await AsyncStorage.getItem("swapkaro_onboarded");
      const token = await getToken();
      if (token) router.replace("/(tabs)/home");
      else if (seen) router.replace("/(auth)/login");
      else router.replace("/(auth)/onboarding");
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container} testID="splash-screen">
      <LinearGradient
        colors={["#FF6B35", "#0A0A0A"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.7, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.45]}
      />
      {/* floating dots */}
      {[...Array(8)].map((_, i) => (
        <MotiView
          key={i}
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 0.3, translateY: -20 }}
          transition={{ type: "timing", duration: 2400, loop: true, delay: i * 150 }}
          style={{
            position: "absolute",
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: i % 2 ? colors.brand : "#fff",
            left: 30 + i * 38,
            top: 100 + (i % 3) * 120,
          }}
        />
      ))}
      <View style={styles.center}>
        <MotiText
          from={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: "timing", duration: 600 }}
          style={styles.brand}
        >
          Swap<Text style={{ color: colors.brand }}>Karo</Text>
        </MotiText>
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 700, duration: 600 }}
          style={styles.tag}
        >
          Hunar Badlo. Paise Nahi.
        </MotiText>
      </View>
      <Pressable
        testID="splash-skip"
        onPress={() => router.replace("/(auth)/onboarding")}
        style={styles.skip}
      >
        <Text style={{ color: colors.textDim }}>tap to continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  center: { alignItems: "center", gap: 12 },
  brand: { color: "#fff", fontSize: 48, fontWeight: "500", letterSpacing: -1.5 },
  tag: { color: colors.textDim, fontSize: 16, letterSpacing: 1, textTransform: "uppercase" },
  skip: { position: "absolute", bottom: 60 },
});
