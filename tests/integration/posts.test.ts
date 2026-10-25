import { LocalPostRepository } from "../../src/repositories/posts";
import { MockRepository, MemoryStore } from "../../src/repositories/mock";
import { seedData, products } from "../../src/mocks/seed";
import { FashionPost } from "../../src/models/posts";
import { postPiece } from "../../src/features/feed/domain";
import { isoNow } from "../../src/models";
jest.mock("../../src/repositories/firebase", () => ({ cloudAuth: jest.fn() }));
function fixture(): FashionPost {
  const d = seedData();
  return {
    id: "post-mine",
    ownerId: "demo",
    caption: "My outfit",
    visibility: "friends",
    image: { uri: "file:///fixture-real-photo.jpg", path: null, version: "v1" },
    pieces: [postPiece(d.garments[0]), postPiece(d.garments[2])],
    outfitId: null,
    sample: false,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}
test("posts, likes, comments and saved references persist across repository restart without wear mutations", async () => {
  const data = seedData(),
    before = JSON.stringify(data),
    store = new MemoryStore(),
    repo = new LocalPostRepository(() => data, "demo", store),
    post = fixture();
  await repo.save(post);
  await repo.save(post);
  await repo.like(post.id, true);
  await repo.comment(post.id, "Love the layers", "comment-one");
  await repo.comment(post.id, "Love the layers", "comment-one");
  await repo.bookmark(post.id, true);
  const detail = await new LocalPostRepository(
    () => data,
    "demo",
    store,
  ).detail(post.id);
  expect(detail.likes).toEqual(["demo"]);
  expect(detail.comments).toHaveLength(1);
  expect(detail.saved).toBe(true);
  expect(JSON.stringify(data)).toBe(before);
  await repo.like(post.id, false);
  expect((await repo.detail(post.id)).likes).toEqual([]);
  await repo.remove(post.id);
  await expect(repo.detail(post.id)).rejects.toThrow();
});
test("private posts deny unrelated readers and forged owned garment snapshots", async () => {
  const data = seedData(),
    store = new MemoryStore(),
    repo = new LocalPostRepository(() => data, "demo", store),
    post = fixture();
  await repo.save(post);
  await expect(
    new LocalPostRepository(() => data, "outsider", store).detail(post.id),
  ).rejects.toThrow("private");
  await expect(
    repo.save({
      ...post,
      id: "forged",
      pieces: [{ ...post.pieces[0], primaryColor: "fabricated" }],
    }),
  ).rejects.toThrow("current clothing");
});
test("feed pagination uses distinct sample posts, does not publish personal photos and saved filter works", async () => {
  const data = seedData(),
    repo = new LocalPostRepository(() => data, "demo", new MemoryStore());
  const first = await repo.page(),
    second = await repo.page(first.cursor);
  expect(first.posts).toHaveLength(8);
  expect(second.posts).toHaveLength(4);
  expect(new Set([...first.posts, ...second.posts].map((p) => p.id)).size).toBe(
    12,
  );
  expect(
    first.posts.every(
      (p) =>
        p.sample &&
        !!p.image?.uri &&
        p.image.path === null &&
        p.pieces.every((piece) => piece.brand === null),
    ),
  ).toBe(true);
  await repo.bookmark(first.posts[0].id, true);
  expect((await repo.page({}, undefined, true)).posts.map((p) => p.id)).toEqual(
    [first.posts[0].id],
  );
});
test("cart and bulk text records survive the existing demo repository restart", async () => {
  const store = new MemoryStore(),
    repo = new MockRepository(store),
    product = products[0];
  await repo.execute("demo", {
    type: "cart.add",
    item: { id: product.id, ownerId: "demo", product, createdAt: isoNow() },
  });
  expect((await new MockRepository(store).load("demo")).cart[0].id).toBe(
    product.id,
  );
});

test("only post owners may edit captions/visibility; image version and wardrobe snapshots are preserved", async () => {
  const data = seedData(),
    store = new MemoryStore(),
    repo = new LocalPostRepository(() => data, "demo", store),
    post = fixture();
  await repo.save(post);
  await repo.edit(post.id, {
    caption: "Updated inspiration",
    visibility: "public",
  });
  const updated = (await repo.detail(post.id)).post;
  expect(updated.caption).toBe("Updated inspiration");
  expect(updated.pieces).toEqual(post.pieces);
  expect(updated.image).toEqual(post.image);
  await expect(
    new LocalPostRepository(() => data, "outsider", store).edit(post.id, {
      caption: "Spoof",
      visibility: "public",
    }),
  ).rejects.toThrow("creator");
});

test("sample-photo refresh preserves actual user photos, captions and old garment records", async () => {
  const data = seedData(),
    store = new MemoryStore(),
    own = fixture();
  await store.setItem(
    "thread.posts.v1.demo",
    JSON.stringify({
      posts: [
        own,
        {
          ...own,
          id: "sample-post-1",
          sample: true,
          ownerId: "maya",
          image: null,
        },
      ],
      likes: {},
      comments: {},
      saved: [own.id],
    }),
  );
  const repo = new LocalPostRepository(() => data, "demo", store);
  expect((await repo.detail(own.id)).post).toEqual(own);
  expect((await repo.detail("sample-post-1")).post.image?.uri).toBe(
    "look-smart",
  );
  await expect(
    repo.save({ ...own, id: "no-photo", image: null }),
  ).rejects.toThrow("real photo");
  await repo.save({
    ...own,
    id: "clothing-post",
    kind: "clothing",
    pieces: [],
  });
  expect((await repo.detail("clothing-post")).post.kind).toBe("clothing");
});
