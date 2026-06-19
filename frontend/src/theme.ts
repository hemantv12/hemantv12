import { Platform } from "react-native";

export const colors = {
  bg: "#0A0A0A",
  bg2: "#141414",
  surface: "#1C1C1C",
  surfaceHi: "#242424",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.15)",
  text: "#FFFFFF",
  textDim: "#888888",
  textMute: "#444444",
  brand: "#FF6B35",
  teal: "#00C896",
  gold: "#FFD700",
  success: "#00C896",
  warn: "#FFB800",
  error: "#FF4444",
};

export const radii = { sm: 6, md: 14, lg: 20, pill: 100 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const cardShadow: any = Platform.select({
  web: { boxShadow: "0 8px 32px rgba(0,0,0,0.4)" },
  default: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

export const glow: any = Platform.select({
  web: { boxShadow: "0 0 20px rgba(255,107,53,0.45)" },
  default: {
    shadowColor: colors.brand,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
