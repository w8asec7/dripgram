import StyleMe from "../../src/app/outfit/style";
import { MockAIService, generateOutfit } from "../../src/services/ai";
import { Keyboard } from "react-native";
import { ChatScreen } from "../../src/features/social/ChatScreen";
import { chatRepository } from "../../src/repositories/chat";
import React from "react";
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { AuthScreen } from "../../src/features/AuthScreen";
import { GarmentForm } from "../../src/features/GarmentForm";
import Closet from "../../src/app/(tabs)/closet";
import { useApp } from "../../src/state/AppProvider";
import { seedData } from "../../src/mocks/seed";
import { Button, Empty, Chips } from "../../src/components/ui";
jest.mock("../../src/features/weather/useWeather", () => ({
  useWeather: () => ({ weather: null }),
}));
jest.mock("../../src/repositories/chat", () => ({ chatRepository: jest.fn() }));
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
}));
jest.mock("../../src/state/AppProvider", () => ({
  useApp: jest.fn(),
  friendlyError: (e: Error) => e.message,
}));
jest.mock("../../src/repositories/firebase", () => ({
  firebaseConfigured: false,
  firebaseStorageConfigured: false,
}));
jest.mock("../../src/services/camera", () => ({
  cameraService: { selectFromLibrary: jest.fn(), capture: jest.fn() },
}));
const execute = jest.fn().mockResolvedValue(seedData());
const authenticate = jest.fn().mockResolvedValue(undefined);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useApp).mockReturnValue({
    user: { id: "demo", email: "rishi@example.test", mode: "demo" },
    data: seedData(),
    loading: false,
    busy: false,
    offline: false,
    error: null,
    notice: null,
    keepLocalGarment: jest.fn().mockResolvedValue(undefined),
    execute,
    authenticate,
    enterDemo: jest.fn(),
    forgotPassword: jest.fn(),
    signOut: jest.fn(),
    refresh: jest.fn(),
    resetDemo: jest.fn(),
    toast: jest.fn(),
    dismissError: jest.fn(),
    repository: {} as ReturnType<typeof useApp>["repository"],
    services: {} as ReturnType<typeof useApp>["services"],
  });
});
test("sign-in validates email and password before calling authentication", async () => {
  await render(<AuthScreen mode="sign-in" />);
  await fireEvent.changeText(screen.getByLabelText("Email address"), "invalid");
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByText("Enter a valid email address.");
  expect(authenticate).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("Email address"),
    "test@example.test",
  );
  await fireEvent.changeText(screen.getByLabelText("Password"), "short");
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByText("Use at least 8 characters.");
});
test("valid sign-in submits and preserves entered values", async () => {
  await render(<AuthScreen mode="sign-in" />);
  await fireEvent.changeText(
    screen.getByLabelText("Email address"),
    "test@example.test",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Password"),
    "valid-password",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() =>
    expect(authenticate).toHaveBeenCalledWith(
      "sign-in",
      "test@example.test",
      "valid-password",
      "",
    ),
  );
});
test("manual garment review validates and sends typed data without camera access", async () => {
  await render(<GarmentForm />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Add to my wardrobe" }),
  );
  await screen.findByText("Use at least two characters.");
  expect(execute).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("Garment name"),
    "My new jacket",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Add to my wardrobe" }),
  );
  await waitFor(() =>
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "garment.save",
        garment: expect.objectContaining({
          name: "My new jacket",
          visibility: "private",
          sharedWith: [],
        }),
      }),
    ),
  );
});
test("closet search updates the rendered grid and shows an actionable empty state", async () => {
  await render(<Closet />);
  expect(screen.getByRole("button", { name: "Cloud cotton tee" })).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Search your wardrobe"),
    "nonexistent xyz",
  );
  expect(screen.queryByRole("button", { name: "Cloud cotton tee" })).toBeNull();
  expect(screen.getByText("Room for something you love.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add clothing" })).toBeTruthy();
});
test("loading buttons cannot execute actions", async () => {
  const action = jest.fn();
  await render(<Button title="Saving" loading onPress={action} />);
  await fireEvent.press(screen.getByRole("button", { name: "Saving" }));
  expect(action).not.toHaveBeenCalled();
});
test("empty states and filters expose real accessible actions", async () => {
  const action = jest.fn();
  const change = jest.fn();
  await render(
    <>
      <Empty
        title="Nothing here"
        body="Add a piece"
        action="Add now"
        onPress={action}
      />
      <Chips options={["All", "Shoes"]} value="All" onChange={change} />
    </>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add now" }));
  await fireEvent.press(screen.getByRole("button", { name: "Shoes" }));
  expect(action).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenCalledWith("Shoes");
});

test("analysis updates red color even when a custom name already exists", async () => {
  const { cameraService } =
    require("../../src/services/camera") as typeof import("../../src/services/camera");
  const images =
    require("../../src/services/images") as typeof import("../../src/services/images");
  const prepare = jest.spyOn(images, "prepareLocalImages").mockResolvedValue({
    inferenceUri: "data:image/jpeg;base64,fixture",
    thumbnailUri: "data:image/jpeg;base64,thumbnail",
    width: 256,
    height: 256,
  });
  jest.mocked(cameraService.selectFromLibrary).mockResolvedValue({
    uri: "data:image/jpeg;base64,original",
    width: 600,
    height: 600,
    source: "library",
  });
  const ai = {
    analyzeClothing: jest.fn().mockResolvedValue({
      name: "Red Oversized T-Shirt",
      category: "t-shirt",
      primaryColor: "red",
      secondaryColors: [],
      pattern: "solid",
      fit: "oversized",
      styleTags: [],
      brand: null,
      confidence: "medium",
      description: "A red tee",
    }),
  };
  const context = jest.mocked(useApp).getMockImplementation()!();
  jest.mocked(useApp).mockReturnValue({
    ...context,
    services: {
      ...context.services,
      ai: ai as unknown as ReturnType<typeof useApp>["services"]["ai"],
    },
  });
  await render(<GarmentForm />);
  await fireEvent.changeText(
    screen.getByLabelText("Garment name"),
    "My custom shirt",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Photo library" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Primary color").props.value).toBe("red"),
  );
  expect(screen.getByLabelText("Garment name").props.value).toBe(
    "My custom shirt",
  );
  expect(ai.analyzeClothing).toHaveBeenCalledTimes(1);
  expect(ai.analyzeClothing).toHaveBeenCalledWith({
    uri: "data:image/jpeg;base64,fixture",
  });
  expect(cameraService.capture).not.toHaveBeenCalled();
  prepare.mockRestore();
});

test("chat attachments dismiss keyboard and focusing the composer closes the menu without losing the draft", async () => {
  const dismiss = jest
    .spyOn(Keyboard, "dismiss")
    .mockImplementation(() => undefined);
  jest.mocked(chatRepository).mockReturnValue({
    subscribe: (_target, receive) => {
      receive([]);
      return () => undefined;
    },
    send: jest.fn().mockResolvedValue(undefined),
    older: jest.fn().mockResolvedValue([]),
  });
  await render(
    <ChatScreen target={{ kind: "group", id: seedData().groups[0].id }} />,
  );
  const composer = screen.getByTestId("chat-message-input");
  await fireEvent.changeText(composer, "My draft stays here");
  await fireEvent.press(
    screen.getByRole("button", { name: "Add outfit attachment" }),
  );
  expect(dismiss).toHaveBeenCalled();
  await screen.findByRole("button", { name: "Select From My Closet" });
  await fireEvent(composer, "focus");
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Select From My Closet" }),
    ).toBeNull(),
  );
  expect(screen.getByTestId("chat-message-input").props.value).toBe(
    "My draft stays here",
  );
  dismiss.mockRestore();
});

test("Style Me renders the successful Meta result immediately and passes current pieces for alternatives", async () => {
  const base = jest.mocked(useApp)();
  const response = generateOutfit({
    ownerId: "demo",
    occasionType: "Dinner",
    garments: base.data!.garments,
    preferences: base.data!.profile.preferences,
  });
  const live = {
    ...response,
    source: "meta" as const,
    outfit: response.outfit
      ? {
          ...response.outfit,
          id: "live-now",
          name: "Fresh Meta choice",
          source: "meta" as const,
        }
      : null,
  };
  const recommend = jest.fn().mockResolvedValue(live);
  jest.mocked(useApp).mockReturnValue({
    ...base,
    services: {
      ...base.services,
      mode: "live",
      ai: Object.assign(new MockAIService(), { generateOutfit: recommend }),
    } as ReturnType<typeof useApp>["services"],
  });
  await render(<StyleMe />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Generate with Meta" }),
  );
  await screen.findByText("Fresh Meta choice");
  expect(recommend.mock.calls[0][0].occasionType).toBe("Casual day");
  expect(recommend.mock.calls[0][0].currentItems).toHaveLength(2);
  await fireEvent.press(
    screen.getByRole("button", { name: "Try another outfit" }),
  );
  await waitFor(() => expect(recommend).toHaveBeenCalledTimes(2));
  expect(recommend.mock.calls[1][0].currentItems).toEqual(live.outfit!.items);
});
