import { Platform } from "react-native";
import * as notifications from "expo-notifications";
import {
  createNotificationService,
  dailyReminderId,
} from "../../src/services/notifications";
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));
const originalOS = Platform.OS;
const notificationService = createNotificationService(
  async () => notifications,
  () => Platform.OS,
);
beforeEach(() => {
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  jest.clearAllMocks();
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: true, status: "granted" } as Awaited<
      ReturnType<typeof notifications.getPermissionsAsync>
    >);
  jest
    .mocked(notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([]);
});
afterEach(() =>
  Object.defineProperty(Platform, "OS", {
    value: originalOS,
    configurable: true,
  }),
);
test("native reminder schedules selected wall-clock time with owner-scoped check-in route", async () => {
  const result = await notificationService.enableDaily("09:15", "alice");
  expect(result.supported).toBe(true);
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: dailyReminderId,
      content: expect.objectContaining({
        data: { route: "/outfit/checkin", ownerId: "alice", time: "09:15" },
      }),
      trigger: expect.objectContaining({ type: "daily", hour: 9, minute: 15 }),
    }),
  );
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test("reconciliation never prompts and an identical reminder is not duplicated", async () => {
  jest
    .mocked(notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([
      {
        identifier: dailyReminderId,
        content: { data: { ownerId: "alice", time: "08:30" } },
      },
    ] as unknown as Awaited<
      ReturnType<typeof notifications.getAllScheduledNotificationsAsync>
    >);
  await notificationService.enableDaily("08:30", "alice", false);
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false, status: "undetermined" } as Awaited<
      ReturnType<typeof notifications.getPermissionsAsync>
    >);
  expect(
    (await notificationService.enableDaily("08:30", "alice", false)).supported,
  ).toBe(false);
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test("disabled reminders cancel and denied permission falls back without scheduling", async () => {
  await notificationService.disableDaily();
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    dailyReminderId,
  );
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false, status: "denied" } as Awaited<
      ReturnType<typeof notifications.getPermissionsAsync>
    >);
  expect(
    (await notificationService.enableDaily("08:30", "alice")).supported,
  ).toBe(false);
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
