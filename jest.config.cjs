module.exports = {
  preset: "jest-expo",
  resolver: "react-native-reanimated/jest/resolver",
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  testPathIgnorePatterns: ["/rules/", "/e2e/"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  collectCoverageFrom: [
    "src/repositories/domain.ts",
    "src/services/ai/index.ts",
    "src/services/shopping/index.ts",
    "src/utils/**/*.ts",
  ],
};
