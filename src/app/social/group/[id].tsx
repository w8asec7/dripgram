import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "../../../features/social/ChatScreen";
export default function GroupChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen key={id} target={{ kind: "group", id }} />;
}
