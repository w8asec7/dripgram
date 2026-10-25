import { MockShoppingService } from "./shopping";
import { z } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { demoCloudUser, demoFirebaseApp } from "../repositories/firebase";
import { MockRepository } from "../repositories/mock";
import { apiRequest } from "./api";
import { BackendAIService, BackendShoppingService } from "./backend";
import { MockAIService, OutfitInputSchema } from "./ai";
import { makeProfile } from "../mocks/seed";
export async function demoApiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const user = await demoCloudUser();
  return apiRequest(path, schema, body, method, await user.getIdToken());
}
let synced = "";
let syncing: Promise<void> | undefined;
/** A private text-metadata projection; the demo never uploads original images here. */
export async function syncDemoWardrobe() {
  if (syncing) return syncing;
  syncing = (async () => {
    const user = await demoCloudUser();
    const data = await new MockRepository(AsyncStorage).load("demo");
    const garments = data.garments.map((g) => ({
      ...g,
      ownerId: user.uid,
      image: null,
    }));
    const key =
      user.uid +
      JSON.stringify([
        garments,
        data.profile.preferences,
        data.profile.weather,
        data.cart,
      ]);
    if (key === synced) return;
    const db = getFirestore(demoFirebaseApp());
    const previous = await getDocs(
      collection(db, "users", user.uid, "garments"),
    );
    const batch = writeBatch(db);
    batch.set(
      doc(db, "users", user.uid),
      JSON.parse(
        JSON.stringify({
          ...makeProfile(user.uid, "Demo wardrobe"),
          preferences: data.profile.preferences,
          weather: data.profile.weather,
          onboardingComplete: true,
          revision: 0,
          skippedDates: [],
        }),
      ),
    );
    const previousCart = await getDocs(
      collection(db, "users", user.uid, "cart"),
    );
    for (const item of data.cart)
      batch.set(
        doc(db, "users", user.uid, "cart", item.id),
        JSON.parse(JSON.stringify({ ...item, ownerId: user.uid })),
      );
    for (const item of previousCart.docs)
      if (!data.cart.some((c) => c.id === item.id)) batch.delete(item.ref);
    const ids = new Set(garments.map((g) => g.id));
    for (const g of garments)
      batch.set(
        doc(db, "users", user.uid, "garments", g.id),
        JSON.parse(JSON.stringify(g)),
      );
    for (const g of previous.docs) if (!ids.has(g.id)) batch.delete(g.ref);
    await batch.commit();
    synced = key;
  })().finally(() => {
    syncing = undefined;
  });
  return syncing;
}
export class DemoLiveAIService extends BackendAIService {
  constructor() {
    super(demoApiRequest);
  }
  async generateOutfit(input: z.input<typeof OutfitInputSchema>) {
    await syncDemoWardrobe();
    const result = await super.generateOutfit(input);
    return {
      ...result,
      outfit: result.outfit
        ? { ...result.outfit, ownerId: input.ownerId }
        : null,
    };
  }
  async analyzeWardrobe() {
    await syncDemoWardrobe();
    return super.analyzeWardrobe();
  }
  coordinateGroup(input: Parameters<MockAIService["coordinateGroup"]>[0]) {
    return new MockAIService().coordinateGroup(input);
  }
}
export class DemoLiveShoppingService extends BackendShoppingService {
  private samples = new MockShoppingService();
  private isSample(id: string) {
    return /^p\d+$|^sample-/.test(id);
  }
  async details(id: string) {
    const product = this.isSample(id)
      ? await this.samples.details(id)
      : await super.details(id);
    if (!product)
      throw new Error(
        "This sample listing is unavailable. Browse Discover for more finds.",
      );
    return product;
  }
  async compare(ids: string[]) {
    const results = await Promise.all(ids.map((id) => this.details(id)));
    return results.flatMap((p) => (p ? [p] : []));
  }
  async history(id: string) {
    return this.isSample(id) ? this.samples.history(id) : super.history(id);
  }
  async advice(id: string) {
    await syncDemoWardrobe();
    return super.advice(id);
  }
  constructor() {
    super(demoApiRequest);
  }
}
