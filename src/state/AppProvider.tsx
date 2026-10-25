import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useNetworkState } from "expo-network";
import { Platform } from "react-native";
import { AppData, AppDataSchema, User } from "../models";
import { MockRepository, DemoAuthRepository } from "../repositories/mock";
import {
  FirebaseRepository,
  FirebaseAuthRepository,
  firebaseConfigured,
} from "../repositories/firebase";
import {
  Command,
  DataRepository,
  KeyValueStore,
} from "../repositories/contracts";
import {
  localGarments,
  removeLocalThumbnail,
  clearThumbnailCache,
} from "../services/images";
import { withTimeout } from "../utils/async";
import {
  services as demoServices,
  liveServices,
  demoLiveServices,
  AppServices,
} from "../services";
export const friendlyError = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (/invalid-credential|wrong-password|user-not-found/.test(code))
    return "Email or password is incorrect. Please try again.";
  if (/email-already-in-use/.test(code))
    return "An account already uses this email. Try signing in.";
  if (/permission-denied/.test(code))
    return "You do not have access to this record. Refresh or sign in again.";
  if (/network|unavailable/.test(code))
    return "Could not reach the service. Check your connection and try again.";
  if (/too-many/.test(code))
    return "Too many attempts. Please wait a moment and try again.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
};
const sessionStore: KeyValueStore = {
  getItem: async (k) =>
    Platform.OS === "web"
      ? AsyncStorage.getItem(k)
      : SecureStore.getItemAsync(k),
  setItem: async (k, v) => {
    if (Platform.OS === "web") await AsyncStorage.setItem(k, v);
    else await SecureStore.setItemAsync(k, v);
  },
  removeItem: async (k) => {
    if (Platform.OS === "web") await AsyncStorage.removeItem(k);
    else await SecureStore.deleteItemAsync(k);
  },
};
const demoAuth = new DemoAuthRepository(sessionStore);
const cloudAuth = new FirebaseAuthRepository();
const demoRepo = new MockRepository(AsyncStorage);
const cloudRepo = new FirebaseRepository();
type Context = {
  user: User | null;
  data: AppData | null;
  loading: boolean;
  busy: boolean;
  offline: boolean;
  error: string | null;
  notice: string | null;
  enterDemo: (offline?: boolean) => Promise<void>;
  authenticate: (
    mode: "sign-in" | "sign-up",
    email: string,
    password: string,
    name?: string,
  ) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  execute: (c: Command, success?: string) => Promise<AppData>;
  refresh: () => Promise<void>;
  resetDemo: () => Promise<void>;
  toast: (m: string) => void;
  dismissError: () => void;
  keepLocalGarment: (garment: import("../models").Garment) => Promise<void>;
  repository: DataRepository;
  services: AppServices;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const network = useNetworkState();
  const offline = network.isConnected === false;
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(0);
  const services =
    user?.mode === "firebase"
      ? liveServices
      : user?.mode === "demo" &&
          user.demoServices !== "offline" &&
          firebaseConfigured &&
          !offline
        ? demoLiveServices
        : demoServices;
  const repository = user?.mode === "firebase" ? cloudRepo : demoRepo;
  const toast = useCallback((m: string) => {
    setNotice(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 4200);
  }, []);
  const loadData = useCallback(
    async (current: User) => {
      let snapshot: AppData;
      try {
        snapshot = await withTimeout(
          (current.mode === "demo" ? demoRepo : cloudRepo).load(current.id),
          "Cloud data is unavailable. Check your connection.",
        );
        await AsyncStorage.setItem(
          `thread.data-cache.${current.id}`,
          JSON.stringify(snapshot),
        );
      } catch (error) {
        const cached = await AsyncStorage.getItem(
          `thread.data-cache.${current.id}`,
        );
        if (!cached) throw error;
        snapshot = AppDataSchema.parse(JSON.parse(cached));
        toast(
          "Showing your saved offline copy. Cloud changes still need a connection.",
        );
      }
      const pending = await localGarments.list(current.id);
      return {
        ...snapshot,
        garments: [
          ...snapshot.garments.filter(
            (g) => !pending.some((p) => p.id === g.id),
          ),
          ...pending,
        ],
      };
    },
    [toast],
  );
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const demo = await demoAuth.current();
        const current =
          demo ?? (firebaseConfigured ? await cloudAuth.current() : null);
        if (current && active) {
          setUser(current);
          const d = await loadData(current);
          if (active) setData(d);
        }
      } catch (e) {
        if (active) setError(friendlyError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loadData]);
  const track = async <T,>(action: () => Promise<T>): Promise<T> => {
    pending.current++;
    setBusy(true);
    setError(null);
    try {
      return await withTimeout(
        action(),
        "This is taking longer than expected. Check your connection and refresh before retrying. A submitted cloud write may still complete.",
      );
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    } finally {
      pending.current--;
      setBusy(pending.current > 0);
    }
  };
  const enterDemo = async (offlineDemo = false) =>
    track(async () => {
      const u = await demoAuth.enter(offlineDemo ? "offline" : "live");
      const d = await demoRepo.load(u.id);
      setUser(u);
      setData(d);
    });
  const authenticate = async (
    mode: "sign-in" | "sign-up",
    email: string,
    password: string,
    name?: string,
  ) =>
    track(async () => {
      const u =
        mode === "sign-up"
          ? await cloudAuth.signUp(email, password, name || "Your name")
          : await cloudAuth.signIn(email, password);
      const d = await loadData(u);
      await demoAuth.signOut();
      setUser(u);
      setData(d);
      return d.profile.onboardingComplete;
    });
  const execute = async (c: Command, success?: string) =>
    track(async () => {
      if (!user) throw new Error("Sign in first.");
      const next = await repository.execute(user.id, c);
      if (c.type === "garment.save") {
        await localGarments.remove(user.id, c.garment.id);
      }
      if (c.type === "garment.delete" || c.type === "garment.deleteMany") {
        const ids = c.type === "garment.delete" ? [c.id] : c.ids;
        await Promise.all(
          ids.map(async (id) => {
            await localGarments.remove(user.id, id);
            await removeLocalThumbnail(user.id, id);
          }),
        );
      }
      await AsyncStorage.setItem(
        `thread.data-cache.${user.id}`,
        JSON.stringify(next),
      );
      const retained = await localGarments.list(user.id);
      const merged = {
        ...next,
        garments: [
          ...next.garments.filter((g) => !retained.some((p) => p.id === g.id)),
          ...retained,
        ],
      };
      setData(merged);
      if (success) toast(success);
      return merged;
    });
  const refresh = async () =>
    track(async () => {
      if (user) setData(await loadData(user));
    });
  const signOut = async () =>
    track(async () => {
      if (user?.mode === "firebase") await cloudAuth.signOut();
      await demoAuth.signOut();
      clearThumbnailCache();
      setData(null);
      setUser(null);
    });
  const resetDemo = async () =>
    track(async () => {
      if (user?.mode !== "demo")
        throw new Error("Reset is only available in demo.");
      await AsyncStorage.multiRemove(
        (await AsyncStorage.getAllKeys()).filter((key) =>
          key.startsWith("thread.chat.v1.demo."),
        ),
      );
      setData(await demoRepo.reset(user.id));
      toast("Demo restored. Welcome back.");
    });
  return (
    <AppContext.Provider
      value={{
        user,
        data,
        loading,
        busy,
        offline,
        error,
        notice,
        enterDemo,
        authenticate,
        forgotPassword: (email) => track(() => cloudAuth.forgotPassword(email)),
        signOut,
        execute,
        refresh,
        resetDemo,
        toast,
        dismissError: () => setError(null),
        keepLocalGarment: async (garment) => {
          await localGarments.save(garment);
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  garments: [
                    ...previous.garments.filter((g) => g.id !== garment.id),
                    garment,
                  ],
                }
              : previous,
          );
        },
        repository,
        services,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider is required.");
  return context;
}
