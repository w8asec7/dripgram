import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ShoppingFeed } from "../../features/shopping/ShoppingFeed";
export default function Feed() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return (
    <ShoppingFeed back mode={mode === "clearance" ? "clearance" : "complete"} />
  );
}
