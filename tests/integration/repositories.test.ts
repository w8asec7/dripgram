import {
  MockRepository,
  MemoryStore,
  DemoAuthRepository,
} from "../../src/repositories/mock";
import { MockShoppingService } from "../../src/services/shopping";
import { today, isoNow } from "../../src/models";
import { generateOutfit } from "../../src/services/ai";
describe("persistent demo repositories and services", () => {
  test("explicit demo authentication and sign out persist", async () => {
    const store = new MemoryStore();
    const auth = new DemoAuthRepository(store);
    expect(await auth.current()).toBeNull();
    await auth.enter();
    expect((await new DemoAuthRepository(store).current())?.id).toBe("demo");
    await auth.signOut();
    expect(await auth.current()).toBeNull();
    await expect(auth.signIn()).rejects.toThrow("Explore demo");
  });
  test("garment CRUD persists across repository instances", async () => {
    const store = new MemoryStore();
    const repo = new MockRepository(store);
    const d = await repo.load("demo");
    const g = { ...d.garments[0], id: "new-piece", name: "Integration piece" };
    await repo.execute("demo", { type: "garment.save", garment: g });
    await repo.execute("demo", {
      type: "garment.save",
      garment: { ...g, name: "Updated piece" },
    });
    expect(
      (await new MockRepository(store).load("demo")).garments.find(
        (x) => x.id === g.id,
      )?.name,
    ).toBe("Updated piece");
    await repo.execute("demo", { type: "garment.delete", id: g.id });
    expect((await repo.load("demo")).garments.some((x) => x.id === g.id)).toBe(
      false,
    );
  });
  test("concurrent commands preserve both mutations", async () => {
    const repo = new MockRepository(new MemoryStore());
    await Promise.all([
      repo.execute("demo", {
        type: "laundry",
        ids: ["g1"],
        availability: "laundry",
      }),
      repo.execute("demo", {
        type: "laundry",
        ids: ["g3"],
        availability: "unknown",
      }),
    ]);
    const d = await repo.load("demo");
    expect(d.garments.find((g) => g.id === "g1")?.availability).toBe("laundry");
    expect(d.garments.find((g) => g.id === "g3")?.availability).toBe("unknown");
  });
  test("outfit create, plan, wear and unavailable planning errors", async () => {
    const repo = new MockRepository(new MemoryStore());
    const d = await repo.load("demo");
    const outfit = generateOutfit({
      ownerId: "demo",
      occasionType: "Classes",
      garments: d.garments,
      preferences: d.profile.preferences,
    }).outfit!;
    await repo.execute("demo", { type: "outfit.save", outfit });
    await repo.execute("demo", {
      type: "outfit.plan",
      id: outfit.id,
      date: today(),
    });
    const worn = await repo.execute("demo", {
      type: "wear",
      garmentIds: outfit.items.map((i) => i.garmentId),
      laundryIds: outfit.items
        .filter((i) => i.role === "top")
        .map((i) => i.garmentId),
      outfitId: outfit.id,
      date: today(),
    });
    expect(worn.wears).toHaveLength(1);
    expect(
      worn.outfits.find((o) => o.id === outfit.id)?.confirmedAt,
    ).toBeTruthy();
    await expect(
      repo.execute("demo", {
        type: "outfit.plan",
        id: outfit.id,
        date: today(),
      }),
    ).rejects.toThrow("unavailable");
  });
  test("requests, accepting, removing and revoking access", async () => {
    const repo = new MockRepository(new MemoryStore());
    const d = await repo.load("demo");
    const r = d.requests.find((r) => r.toId === "demo")!;
    await repo.execute("demo", {
      type: "friend.respond",
      id: r.id,
      accept: true,
    });
    await repo.execute("demo", {
      type: "garment.save",
      garment: {
        ...d.garments[0],
        visibility: "selected-friends",
        sharedWith: ["jordan"],
      },
    });
    const removed = await repo.execute("demo", {
      type: "friend.remove",
      friendId: "jordan",
    });
    expect(removed.garments[0].sharedWith).not.toContain("jordan");
    await repo.execute("demo", { type: "friend.request", toId: "sam" });
    await expect(
      repo.execute("demo", { type: "friend.request", toId: "sam" }),
    ).rejects.toThrow("pending");
  });
  test("occasion snapshot sharing, votes and comments do not open wardrobes", async () => {
    const repo = new MockRepository(new MemoryStore());
    const d = await repo.execute("demo", {
      type: "occasion.share",
      id: "oc1",
      outfitId: "o1",
    });
    expect(d.garments.every((g) => g.visibility === "private")).toBe(true);
    const s = d.occasions
      .find((o) => o.id === "oc1")!
      .submissions.find((s) => s.ownerId === "demo")!;
    expect(s.pieces).toHaveLength(4);
    await repo.execute("demo", {
      type: "occasion.vote",
      id: "oc1",
      submissionId: s.id,
    });
    await repo.execute("demo", {
      type: "occasion.comment",
      id: "oc1",
      submissionId: s.id,
      text: "Love this plan.",
    });
    const next = await repo.load("demo");
    expect(
      next.occasions[0].submissions.find((x) => x.id === s.id)?.votes,
    ).toContain("demo");
    expect(
      next.occasions[0].submissions.find((x) => x.id === s.id)?.comments[0]
        .text,
    ).toBe("Love this plan.");
  });
  test("search, details, comparison, partial fields, price watches", async () => {
    const service = new MockShoppingService();
    const results = await service.clearance({
      query: "",
      maxPrice: 50,
      sort: "price",
    });
    expect(results.source).toBe("sample");
    expect(
      results.products.every(
        (p) => p.offer.price !== null && p.offer.price <= 50,
      ),
    ).toBe(true);
    expect(await service.details("missing")).toBeNull();
    expect(await service.compare(["p1", "p2"])).toHaveLength(2);
    const repo = new MockRepository(new MemoryStore());
    await repo.execute("demo", {
      type: "watch.save",
      watch: {
        id: "my-watch",
        ownerId: "demo",
        productId: "p1",
        targetPrice: 15,
        history: await service.history("p1"),
        createdAt: isoNow(),
      },
    });
    expect((await repo.load("demo")).watches).toHaveLength(2);
    await repo.execute("demo", { type: "watch.delete", id: "my-watch" });
    expect((await repo.load("demo")).watches).toHaveLength(1);
  });
  test("partial, offline and rate-limit shopping responses remain explicit", async () => {
    expect(
      (await new MockShoppingService("partial").search({ query: "" })).partial,
    ).toBe(true);
    await expect(
      new MockShoppingService("offline").search({ query: "" }),
    ).rejects.toThrow("connection");
    await expect(
      new MockShoppingService("rate-limit").search({ query: "" }),
    ).rejects.toMatchObject({ kind: "rate-limit", retryAfterSeconds: 60 });
  });
  test("offline storage failures propagate without false success", async () => {
    const store = new MemoryStore();
    const repo = new MockRepository(store);
    await repo.load("demo");
    store.setItem = async () => {
      throw new Error("Storage unavailable");
    };
    await expect(
      repo.execute("demo", {
        type: "laundry",
        ids: ["g1"],
        availability: "laundry",
      }),
    ).rejects.toThrow("Storage unavailable");
  });
  test("corrupted data and cross-user access are rejected", async () => {
    const store = new MemoryStore();
    await store.setItem("thread.demo.v1", '{"profile":{}}');
    await expect(new MockRepository(store).load("demo")).rejects.toThrow();
    await expect(
      new MockRepository(store).load("someone-else"),
    ).rejects.toThrow("demo account");
  });
});
