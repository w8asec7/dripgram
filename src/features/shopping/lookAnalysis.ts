import type { FashionPost, StylePiece } from "../../models/posts";
/** Cache observations only, never authorization. Repositories authorize before this is called. */
const cache = new Map<string, { pieces: StylePiece[]; expires: number }>();
const pending = new Map<string, Promise<StylePiece[]>>();
export async function lookPieces(
  uid: string,
  mode: string,
  post: FashionPost,
  loader: () => Promise<{ original: { pieces: StylePiece[] } }>,
) {
  const key = JSON.stringify([
    uid,
    mode,
    post.id,
    post.updatedAt,
    post.image?.version,
    post.pieces,
  ]);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.pieces;
  let task = pending.get(key);
  if (!task) {
    task = loader()
      .then((r) => {
        cache.set(key, {
          pieces: r.original.pieces,
          expires: Date.now() + 30 * 60000,
        });
        if (cache.size > 32) cache.delete(cache.keys().next().value!);
        return r.original.pieces;
      })
      .finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return task;
}
