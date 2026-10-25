import React from "react";
import { Screen } from "../../components/ui";
import { MessageInbox } from "../../features/social/MessageInbox";
export default function Messages() {
  return (
    <Screen back scroll={false} title="Messages">
      <MessageInbox />
    </Screen>
  );
}
