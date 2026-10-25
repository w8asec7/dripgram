import { Platform } from "react-native";
export interface ReminderResult {
  supported: boolean;
  message: string;
}
export function reminderTime(time = "08:30") {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Choose a time in HH:MM format.");
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}
export const dailyReminderId = "thread-daily";
type NotificationAPI = Pick<
  typeof import("expo-notifications"),
  | "getPermissionsAsync"
  | "requestPermissionsAsync"
  | "getAllScheduledNotificationsAsync"
  | "cancelScheduledNotificationAsync"
  | "scheduleNotificationAsync"
  | "setNotificationChannelAsync"
  | "AndroidImportance"
  | "SchedulableTriggerInputTypes"
>;
export function createNotificationService(
  load: () => Promise<NotificationAPI> = () => import("expo-notifications"),
  platform: () => string = () => Platform.OS,
) {
  return {
    async enableDaily(
      time = "08:30",
      ownerId = "",
      requestPermission = true,
    ): Promise<ReminderResult> {
      const trigger = reminderTime(time);
      if (platform() === "web")
        return {
          supported: false,
          message:
            "Browser preview uses the in-app check-in. Device reminders are not scheduled here.",
        };
      try {
        const n = await load();
        const existing = await n.getPermissionsAsync();
        const permission =
          existing.status === "undetermined" && requestPermission
            ? await n.requestPermissionsAsync()
            : existing;
        if (!permission.granted)
          return {
            supported: false,
            message:
              "Notification permission is off. Your in-app check-in stays available.",
          };
        if (platform() === "android")
          await n.setNotificationChannelAsync("wardrobe", {
            name: "Wardrobe check-in",
            importance: n.AndroidImportance.DEFAULT,
          });
        const scheduled = await n.getAllScheduledNotificationsAsync();
        const matching = scheduled.find(
          (s) =>
            s.identifier === dailyReminderId &&
            s.content.data?.time === time &&
            s.content.data?.ownerId === ownerId,
        );
        if (!matching) {
          await n.cancelScheduledNotificationAsync(dailyReminderId);
          await n.scheduleNotificationAsync({
            identifier: dailyReminderId,
            content: {
              title: "Quick wardrobe check-in",
              body: "What did you wear yesterday?",
              data: { route: "/outfit/checkin", ownerId, time },
            },
            trigger: {
              type: n.SchedulableTriggerInputTypes.DAILY,
              ...trigger,
              channelId: "wardrobe",
            },
          });
        }
        return {
          supported: true,
          message: `Daily check-in scheduled for ${time} in your device’s local timezone.`,
        };
      } catch {
        return {
          supported: false,
          message:
            "Local reminders are unavailable on this device. Your in-app check-in stays available.",
        };
      }
    },
    async disableDaily() {
      if (platform() === "web") return;
      try {
        const n = await load();
        await n.cancelScheduledNotificationAsync(dailyReminderId);
      } catch {
        /* Native module may be unavailable in a preview. */
      }
    },
  };
}
export const notificationService = createNotificationService();
