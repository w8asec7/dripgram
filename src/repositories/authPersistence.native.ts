import { FirebaseApp } from "firebase/app";
import { Auth, Persistence, initializeAuth, getAuth } from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";
import * as SecureStore from "expo-secure-store";
// Firebase accepts an AsyncStorage-shaped persistence adapter. Store sessions in
// Keychain/Keystore instead of storing user passwords or manually handling tokens.
const credentials = {
  getItem: (key: string) =>
    SecureStore.getItemAsync(key.replace(/[^a-zA-Z0-9._-]/g, "_")),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key.replace(/[^a-zA-Z0-9._-]/g, "_"), value),
  removeItem: (key: string) =>
    SecureStore.deleteItemAsync(key.replace(/[^a-zA-Z0-9._-]/g, "_")),
};
const auths = new Map<string, Auth>();
export function persistentAuth(app: FirebaseApp): Auth {
  const existing = auths.get(app.name);
  if (existing) return existing;
  let auth: Auth;
  try {
    auth = initializeAuth(app, {
      persistence: (
        FirebaseAuth as typeof FirebaseAuth & {
          getReactNativePersistence: (store: typeof credentials) => Persistence;
        }
      ).getReactNativePersistence(credentials),
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e &&
      "code" in e &&
      e.code === "auth/already-initialized"
    )
      auth = getAuth(app);
    else throw e;
  }
  auths.set(app.name, auth);
  return auth;
}
