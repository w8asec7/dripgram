import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ShoppingFeed } from "../../features/shopping/ShoppingFeed";
export default function Discover() {
  const { query, group, postId, reason } = useLocalSearchParams();
  return <ShoppingFeed key={JSON.stringify([query, group, postId, reason])} />;
}
