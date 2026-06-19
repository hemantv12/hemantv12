import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { getToken } from "@/src/api";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    if (!loaded && !error) return;
    (async () => {
      const t = await getToken();
      const first = segments[0];
      if (!t && first !== "(auth)" && first !== undefined && first !== "index") {
        router.replace("/");
      }
    })();
  }, [loaded, error, segments]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0A0A0A" },
              animation: "fade",
            }}
          />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
