import { useEffect } from "react";
import { notificationService } from "../../services/notifications";
/** Retire legacy check-in reminders without requesting permissions or altering history. */
export function ReminderBridge() {
  useEffect(() => {
    void notificationService.disableDaily();
  }, []);
  return null;
}
