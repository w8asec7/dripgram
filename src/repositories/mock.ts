import { refreshDesignatedDemoPhotos, demoAvatars } from "../mocks/demoRefresh";
import { AppData, AppDataSchema, User, UserSchema } from "../models";
import { seedData } from "../mocks/seed";
import {
  AuthRepository,
  Command,
  DataRepository,
  KeyValueStore,
} from "./contracts";
import { applyCommand } from "./domain";
export class MemoryStore implements KeyValueStore {
  private values = new Map<string, string>();
  async getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  async removeItem(k: string) {
    this.values.delete(k);
  }
}
export class MockRepository implements DataRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private store: KeyValueStore) {}
  private key(id: string) {
    if (id !== "demo")
      throw new Error("Demo data belongs to the demo account.");
    return "thread.demo.v1";
  }
  async load(id: string): Promise<AppData> {
    const raw = await this.store.getItem(this.key(id));
    if (!raw) {
      const d = seedData();
      await this.store.setItem(this.key(id), JSON.stringify(d));
      return d;
    }
    const data = AppDataSchema.parse(JSON.parse(raw));
    data.profile.preferences.clothingMode ??= "men";
    if (data.profile.displayName === "Rishi Patel")
      data.profile.displayName = "Rishi Nigam";
    data.directory.forEach((p) => {
      if (p.id === "demo" && p.displayName === "Rishi Patel")
        p.displayName = "Rishi Nigam";
    });
    await refreshDesignatedDemoPhotos(data, this.store);
    data.profile.photo ??= demoAvatars.demo;
    data.directory.forEach((p) => {
      p.photo ??= demoAvatars[p.id] || null;
    });
    return data;
  }
  execute(id: string, c: Command): Promise<AppData> {
    const job = this.queue.then(async () => {
      const d = applyCommand(await this.load(id), id, c);
      await this.store.setItem(this.key(id), JSON.stringify(d));
      return d;
    });
    this.queue = job.catch(() => undefined);
    return job;
  }
  async reset(id: string) {
    const data = seedData();
    await this.store.setItem(this.key(id), JSON.stringify(data));
    return data;
  }
}
export class DemoAuthRepository implements AuthRepository {
  constructor(private store: KeyValueStore) {}
  async enter(demoServices: "live" | "offline" = "live"): Promise<User> {
    const user: User = {
      id: "demo",
      email: "rishi@example.test",
      mode: "demo",
      demoServices,
    };
    await this.store.setItem("thread.session", JSON.stringify(user));
    return user;
  }
  async signIn(): Promise<User> {
    throw new Error(
      "Use Explore demo for the sample account. Email sign-in requires Firebase configuration.",
    );
  }
  async signUp(): Promise<User> {
    throw new Error(
      "Create an account after configuring Firebase. You can explore demo now.",
    );
  }
  async forgotPassword() {
    throw new Error(
      "Password reset requires configured Firebase authentication.",
    );
  }
  async signOut() {
    await this.store.removeItem("thread.session");
  }
  async current() {
    const raw = await this.store.getItem("thread.session");
    if (!raw) return null;
    return UserSchema.parse(JSON.parse(raw));
  }
}
