import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { useIsFocused } from "expo-router";
import { ShoppingFeed } from "../../src/features/shopping/ShoppingFeed";
import { apiRequest } from "../../src/services/api";
import { useApp } from "../../src/state/AppProvider";
import { seedData, products } from "../../src/mocks/seed";
jest.mock("expo-router", () => ({
  useIsFocused: jest.fn(() => true),
  useLocalSearchParams: () => ({}),
  router: {
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  },
}));
jest.mock("../../src/state/AppProvider", () => ({
  useApp: jest.fn(),
  friendlyError: (e: Error) => e.message,
}));
jest.mock("../../src/services/api", () => ({ apiRequest: jest.fn() }));
jest.mock("../../src/services/demoLive", () => ({
  demoApiRequest: jest.fn(),
  syncDemoWardrobe: jest.fn(),
}));
const data = seedData();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useIsFocused).mockReturnValue(true);
  jest.mocked(useApp).mockReturnValue({
    data,
    user: { id: "demo", email: "fixture@example.test", mode: "firebase" },
    services: { mode: "live" },
    busy: false,
    error: null,
    offline: false,
    execute: jest.fn(),
    refresh: jest.fn(),
    dismissError: jest.fn(),
  } as unknown as ReturnType<typeof useApp>);
});
test("an initial shopping failure remains recoverable without automatic end-of-list retry loops", async () => {
  jest
    .mocked(apiRequest)
    .mockRejectedValue(
      new Error("Search request budget reached. Retry later."),
    );
  await render(<ShoppingFeed />);
  await screen.findByText("Search request budget reached. Retry later.");
  for (let i = 0; i < 6; i++)
    await fireEvent(screen.getByTestId("shopping-feed"), "onEndReached");
  expect(apiRequest).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "Retry feed" }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
});
test("hidden shopping tabs do not fetch and returning to populated results does not restart loading", async () => {
  jest.mocked(useIsFocused).mockReturnValue(false);
  jest.mocked(apiRequest).mockResolvedValue({
    products: products.slice(0, 2),
    nextPage: null,
    reason: "Fixture",
    query: "fixture",
    source: "live",
    planSource: "rules",
    checkedAt: "2026-10-25T12:00:00.000Z",
    message: "Fixture",
  });
  const view = await render(<ShoppingFeed />);
  expect(apiRequest).not.toHaveBeenCalled();
  jest.mocked(useIsFocused).mockReturnValue(true);
  await view.rerender(<ShoppingFeed />);
  await screen.findByText(products[0].name);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  jest.mocked(useIsFocused).mockReturnValue(false);
  await view.rerender(<ShoppingFeed />);
  jest.mocked(useIsFocused).mockReturnValue(true);
  await view.rerender(<ShoppingFeed />);
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
test("a failed refresh retains loaded products and does not loop into another paid request", async () => {
  jest
    .mocked(apiRequest)
    .mockResolvedValueOnce({
      products: products.slice(0, 2),
      nextPage: 1,
      reason: "Fixture",
      query: "fixture",
      source: "live",
      planSource: "rules",
      checkedAt: "2026-10-25T12:00:00.000Z",
      message: "Fixture",
    })
    .mockRejectedValue(new Error("Network unavailable. Retry later."));
  await render(<ShoppingFeed mode="clearance" />);
  await screen.findByText(products[0].name);
  await fireEvent.press(screen.getByRole("button", { name: "Refresh feed" }));
  await screen.findByText("Network unavailable. Retry later.");
  expect(screen.getByText(products[0].name)).toBeTruthy();
  for (let i = 0; i < 6; i++)
    await fireEvent(screen.getByTestId("shopping-feed"), "onEndReached");
  expect(apiRequest).toHaveBeenCalledTimes(2);
});
