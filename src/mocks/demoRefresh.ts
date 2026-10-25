import type { AppData, Garment } from "../models";
import type { FashionPost } from "../models/posts";
import type { KeyValueStore } from "../repositories/contracts";
/** Exact, previously documented demo QA records only. Archive first; no files are removed.
 * Real Firebase repositories and later user-created demo garments never call this migration. */
const designated: Record<string, { createdAt: string; photo: string }> = {
  "garment-mvn7cbhb-2-dm1tjp": {
    createdAt: "2026-10-25T02:21:56.639Z",
    photo: "tee-red-photo",
  },
  "garment-mvn7li8s-g-spez87": {
    createdAt: "2026-10-25T02:29:05.308Z",
    photo: "tee-blue-photo",
  },
  "garment-mvn7nhoc-u-uyejfb": {
    createdAt: "2026-10-25T02:30:37.884Z",
    photo: "pants-black",
  },
};
export async function refreshDesignatedDemoPhotos(
  data: AppData,
  store: KeyValueStore,
) {
  if (data.profile.id !== "demo") return;
  const candidates = data.garments.filter(
    (g) =>
      g.ownerId === "demo" &&
      designated[g.id]?.createdAt === g.createdAt &&
      g.image?.source !== "bundled",
  );
  if (candidates.length) {
    const key = "thread.demo.photo-archive.v1";
    const archive: Garment[] = JSON.parse((await store.getItem(key)) || "[]");
    const originals = candidates.filter((g) => {
      const previous = archive.find((a) => a.id === g.id);
      return (
        !previous ||
        (previous.updatedAt === g.updatedAt &&
          previous.image?.uri === g.image?.uri)
      );
    });
    if (!originals.length) return;
    await store.setItem(
      key,
      JSON.stringify([
        ...archive,
        ...originals.filter((g) => !archive.some((a) => a.id === g.id)),
      ]),
    );
    // This only runs after archive persistence succeeds. Original app-document/camera-roll files remain intact.
    data.garments = data.garments.map((g) =>
      originals.some((o) => o.id === g.id)
        ? {
            ...g,
            image: {
              uri: designated[g.id].photo,
              source: "bundled",
              width: 768,
              height: 960,
            },
          }
        : g,
    );
  }
}
export async function refreshDesignatedDemoPost(
  posts: FashionPost[],
  uid: string,
  store: KeyValueStore,
) {
  if (uid !== "demo") return posts;
  const original = posts.find(
    (p) =>
      p.id === "post-mvnc9ofj-c-3deqxa" &&
      p.ownerId === "demo" &&
      p.caption === "Local QA clothing post - my black trousers." &&
      !p.sample,
  );
  if (!original) return posts;
  const key = "thread.posts.photo-archive.v1";
  const archive: FashionPost[] = JSON.parse((await store.getItem(key)) || "[]");
  if (!archive.some((p) => p.id === original.id))
    await store.setItem(key, JSON.stringify([...archive, original]));
  return posts.map((p) =>
    p.id !== original.id
      ? p
      : {
          ...p,
          caption:
            "Black trousers, ready for a simple everyday look. Representative sample photograph.",
          sample: true,
          image: { uri: "pants-black", path: null, version: "demo-polish-v1" },
          outfitId: null,
          pieces: [],
        },
  );
}
export const demoAvatars: Record<string, string> = {
  demo: "shoes-white",
  maya: "avatar-maya",
  alex: "avatar-alex",
  jordan: "avatar-jordan",
  sam: "look-basics",
};
