jest.mock("react-native-worklets", () =>
  require("react-native-worklets/lib/module/mock"),
);
jest.mock("expo-image", () => ({ Image: require("react-native").Image }));
require("react-native-reanimated").setUpTests();
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Unit rendering has no native font asset registry. Browser/native QA exercises fonts.
jest.mock("expo-font", () => ({
  isLoaded: () => true,
  isLoading: () => false,
  getLoadedFonts: () => ["Feather"],
  loadAsync: jest.fn().mockResolvedValue(undefined),
  useFonts: () => [true, null],
}));
