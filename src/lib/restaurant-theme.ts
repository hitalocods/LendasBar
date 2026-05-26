export type RestaurantTheme = {
  name: string;
  logoUrl: string;
  accent: string;
  background: string;
};

export const defaultRestaurantTheme: RestaurantTheme = {
  name: "LENDAS 2018",
  logoUrl: "/lendas-logo.png",
  accent: "#d71920",
  background: "#050505"
};

export function toThemeStyle(theme: RestaurantTheme) {
  return {
    "--restaurant-accent": theme.accent,
    "--restaurant-background": theme.background
  } as CSSProperties;
}
import type { CSSProperties } from "react";
