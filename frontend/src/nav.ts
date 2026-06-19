import { router } from "expo-router";

export function safeBack(fallback: any = "/(tabs)/profile") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
