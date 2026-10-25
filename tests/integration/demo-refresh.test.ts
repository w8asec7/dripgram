import { seedData } from "../../src/mocks/seed";
import { MemoryStore, MockRepository } from "../../src/repositories/mock";
import {
  refreshDesignatedDemoPhotos,
  refreshDesignatedDemoPost,
} from "../../src/mocks/demoRefresh";
import { FashionPostSchema } from "../../src/models/posts";
test("designated demo photos archive exact originals first; real/custom records remain unchanged", async () => {
  const data = seedData(),
    store = new MemoryStore();
  const original = {
    ...data.garments[0],
    id: "garment-mvn7cbhb-2-dm1tjp",
    createdAt: "2026-10-25T02:21:56.639Z",
    image: { uri: "file:///original.jpg", source: "library" as const },
  };
  const custom = { ...original, id: "my-real-upload" };
  data.garments.push(original, custom);
  await refreshDesignatedDemoPhotos(data, store);
  expect(
    JSON.parse((await store.getItem("thread.demo.photo-archive.v1"))!),
  ).toEqual([original]);
  expect(data.garments.find((g) => g.id === original.id)?.image?.uri).toBe(
    "tee-red-photo",
  );
  expect(data.garments.find((g) => g.id === custom.id)).toEqual(custom);
  await refreshDesignatedDemoPhotos(data, store);
  expect(
    JSON.parse((await store.getItem("thread.demo.photo-archive.v1"))!),
  ).toHaveLength(1);
  const changed = {
    ...original,
    updatedAt: "2026-10-25T06:00:00.000Z",
    image: {
      uri: "file:///a-later-user-photo.jpg",
      source: "library" as const,
    },
  };
  data.garments = data.garments.map((g) =>
    g.id === original.id ? changed : g,
  );
  await refreshDesignatedDemoPhotos(data, store);
  expect(data.garments.find((g) => g.id === original.id)).toEqual(changed);
  const real = { ...data, profile: { ...data.profile, id: "real-account" } };
  real.garments = [original];
  await refreshDesignatedDemoPhotos(real, store);
  expect(real.garments).toEqual([original]);
});
test("archive failure does not replace an original; demo name update preserves auth ID/custom name", async () => {
  const data = seedData();
  data.garments = [
    {
      ...data.garments[0],
      id: "garment-mvn7cbhb-2-dm1tjp",
      createdAt: "2026-10-25T02:21:56.639Z",
      image: { uri: "file:///original.jpg", source: "library" },
    },
  ];
  const store = new MemoryStore();
  store.setItem = async () => {
    throw new Error("Storage full");
  };
  await expect(refreshDesignatedDemoPhotos(data, store)).rejects.toThrow(
    "Storage full",
  );
  expect(data.garments[0].image?.uri).toBe("file:///original.jpg");
  const working = new MemoryStore(),
    repo = new MockRepository(working);
  const seed = seedData();
  seed.profile.displayName = "Rishi Patel";
  await working.setItem("thread.demo.v1", JSON.stringify(seed));
  expect((await repo.load("demo")).profile.displayName).toBe("Rishi Nigam");
  expect((await repo.load("demo")).profile.id).toBe("demo");
  seed.profile.displayName = "My Custom Name";
  await working.setItem("thread.demo.v1", JSON.stringify(seed));
  expect((await repo.load("demo")).profile.displayName).toBe("My Custom Name");
});
test("only the designated QA post receives representative photography; originals and other posts survive", async () => {
  const post = FashionPostSchema.parse({
    id: "post-mvnc9ofj-c-3deqxa",
    ownerId: "demo",
    kind: "clothing",
    caption: "Local QA clothing post - my black trousers.",
    visibility: "friends",
    image: { uri: "file:///pants.jpg", path: null, version: "original" },
    pieces: [],
    outfitId: null,
    createdAt: "2026-10-25T02:00:00.000Z",
    updatedAt: "2026-10-25T02:00:00.000Z",
    sample: false,
  });
  const other = { ...post, id: "real-user-post" };
  const store = new MemoryStore();
  const result = await refreshDesignatedDemoPost([post, other], "demo", store);
  expect(result[0].sample).toBe(true);
  expect(result[0].image?.uri).toBe("pants-black");
  expect(result[1]).toEqual(other);
  expect(
    JSON.parse((await store.getItem("thread.posts.photo-archive.v1"))!),
  ).toEqual([post]);
});
