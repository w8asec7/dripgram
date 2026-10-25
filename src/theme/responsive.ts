import { createContext, useContext } from "react";
import { Platform, useWindowDimensions } from "react-native";
export const DesktopInsetContext = createContext(0);
export const contentWidths = {
  feed: 640,
  discover: 1440,
  closet: 1280,
  profile: 1040,
  form: 680,
} as const;
export function screenGutter(width: number, web: boolean) {
  return web && width >= 768 ? 24 : width < 360 ? 12 : 16;
}
export function gridMetrics(
  width: number,
  kind: "discover" | "closet" | "profile",
  web: boolean,
  inset = 0,
) {
  const maxWidth = contentWidths[kind],
    gutter = screenGutter(width, web),
    contentWidth = Math.min(width - inset, maxWidth) - 2 * gutter;
  const gap = kind === "profile" ? 4 : web && width >= 768 ? 16 : 12;
  const phoneColumns = kind === "profile" ? 3 : 2;
  const minimum =
    kind === "discover" ? (inset ? 180 : 200) : kind === "closet" ? 168 : 150;
  const columns =
    web && width >= 600
      ? Math.max(
          phoneColumns,
          Math.min(6, Math.floor((contentWidth + gap) / (minimum + gap))),
        )
      : phoneColumns;
  return {
    maxWidth,
    gap,
    columns,
    cardWidth: (contentWidth - gap * (columns - 1)) / columns,
  };
}
export function useGrid(kind: "discover" | "closet" | "profile") {
  const { width } = useWindowDimensions();
  const inset = useContext(DesktopInsetContext);
  return gridMetrics(width, kind, Platform.OS === "web", inset);
}
