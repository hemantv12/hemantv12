import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

/**
 * Pick an image and return a compact base64 data-URI (<300KB).
 * Returns null if user cancelled or permission denied.
 */
export async function pickImageBase64(opts?: { square?: boolean }): Promise<string | null> {
  if (Platform.OS !== "web") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    quality: 0.55,
    aspect: opts?.square ? [1, 1] : undefined,
    allowsEditing: !!opts?.square,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || "image/jpeg";
  return `data:${mime};base64,${asset.base64}`;
}
