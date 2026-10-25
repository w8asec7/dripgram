import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ShoppingFeed } from "../../../features/shopping/ShoppingFeed";
/** Exactly the same Discover implementation, with native Back retaining its source breakdown. */
export default function LookShopping() {
  const params = useLocalSearchParams<{
    postId: string;
    pieceIndex?: string;
    query?: string;
  }>();
  return (
    <ShoppingFeed
      key={JSON.stringify([params.postId, params.pieceIndex, params.query])}
      back
    />
  );
}
