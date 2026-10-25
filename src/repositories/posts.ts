import { refreshDesignatedDemoPost } from "../mocks/demoRefresh";
import { photoDemoPosts } from "../mocks/fashionPosts";
import { KeyValueStore } from "./contracts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  documentId,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  getFirestore,
} from "firebase/firestore";
import { z } from "zod";
import { cloudAuth } from "./firebase";
import { AppData, User, PublicProfileSchema, makeId, isoNow } from "../models";
import {
  FashionPost,
  FashionPostSchema,
  PostPieceSchema,
  PostCommentSchema,
  PostDetail,
} from "../models/posts";
import { canReadPost, postPiece } from "../features/feed/domain";
export type FeedCursor = Record<string, { at: string; id: string }>;
export interface PostRepository {
  page(
    cursor?: FeedCursor,
    ownerId?: string,
    savedOnly?: boolean,
  ): Promise<{ posts: FashionPost[]; cursor: FeedCursor; hasMore: boolean }>;
  detail(id: string): Promise<PostDetail>;
  save(post: FashionPost): Promise<void>;
  remove(id: string): Promise<void>;
  edit(
    id: string,
    patch: Pick<FashionPost, "caption" | "visibility">,
  ): Promise<void>;
  like(id: string, on: boolean): Promise<void>;
  bookmark(id: string, on: boolean): Promise<void>;
  comment(id: string, text: string, commentId?: string): Promise<void>;
}
const clean = (value: unknown) => JSON.parse(JSON.stringify(value));
export class FirebasePostRepository implements PostRepository {
  constructor(
    private uid: string,
    private data: () => AppData,
  ) {}
  private db() {
    if (cloudAuth().currentUser?.uid !== this.uid)
      throw new Error("Your session expired. Sign in again.");
    return getFirestore(cloudAuth().app);
  }
  async page(cursor: FeedCursor = {}, ownerId?: string, savedOnly = false) {
    const db = this.db();
    if (savedOnly) {
      const refs = await getDocs(
        query(
          collection(db, "users", this.uid, "savedPosts"),
          orderBy("createdAt", "desc"),
          ...(cursor.saved ? [startAfter(cursor.saved.at)] : []),
          limit(12),
        ),
      );
      const posts = await Promise.all(
        refs.docs.map(async (r) => {
          try {
            const s = await getDoc(doc(db, "posts", r.id));
            return s.exists() ? FashionPostSchema.parse(s.data()) : null;
          } catch {
            return null;
          }
        }),
      );
      const last = refs.docs.at(-1);
      return {
        posts: posts.filter((p): p is FashionPost => !!p),
        cursor: last
          ? { saved: { at: last.data().createdAt, id: last.id } }
          : cursor,
        hasMore: refs.size === 12,
      };
    }
    const friends = this.data().friendships.flatMap((f) =>
      f.members.includes(this.uid)
        ? f.members.filter((id) => id !== this.uid)
        : [],
    );
    const streams = ownerId
      ? [
          {
            key: ownerId,
            filters: [
              where("ownerId", "==", ownerId),
              ...(ownerId === this.uid || friends.includes(ownerId)
                ? []
                : [where("visibility", "==", "public")]),
            ],
          },
        ]
      : [
          { key: "public", filters: [where("visibility", "==", "public")] },
          {
            key: "own",
            filters: [
              where("ownerId", "==", this.uid),
              where("visibility", "==", "friends"),
            ],
          },
          ...friends.map((id) => ({
            key: id,
            filters: [
              where("ownerId", "==", id),
              where("visibility", "==", "friends"),
            ],
          })),
        ];
    const pages = await Promise.all(
      streams.map(async (stream) => ({
        key: stream.key,
        rows: (
          await getDocs(
            query(
              collection(db, "posts"),
              ...stream.filters,
              orderBy("createdAt", "desc"),
              orderBy(documentId(), "desc"),
              ...(cursor[stream.key]
                ? [startAfter(cursor[stream.key].at, cursor[stream.key].id)]
                : []),
              limit(9),
            ),
          )
        ).docs.map((d) => FashionPostSchema.parse(d.data())),
      })),
    );
    const combined = [
      ...new Map(pages.flatMap((p) => p.rows).map((p) => [p.id, p])).values(),
    ].sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
    const posts = combined.slice(0, 8),
      used = new Set(posts.map((p) => p.id)),
      next = { ...cursor };
    for (const page of pages) {
      const last = page.rows.filter((p) => used.has(p.id)).at(-1);
      if (last) next[page.key] = { at: last.createdAt, id: last.id };
    }
    return {
      posts,
      cursor: next,
      hasMore: combined.length > 8 || pages.some((p) => p.rows.length === 9),
    };
  }
  async detail(id: string): Promise<PostDetail> {
    const db = this.db(),
      snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists())
      throw new Error("This post is private or no longer available.");
    const post = FashionPostSchema.parse(snap.data());
    const [creator, likes, comments, saved] = await Promise.all([
      getDoc(doc(db, "profiles", post.ownerId)),
      getDocs(query(collection(db, "posts", id, "likes"), limit(200))),
      getDocs(
        query(
          collection(db, "posts", id, "comments"),
          orderBy("createdAt", "desc"),
          limit(50),
        ),
      ),
      getDoc(doc(db, "users", this.uid, "savedPosts", id)),
    ]);
    return {
      post,
      creator: creator.exists()
        ? PublicProfileSchema.parse(creator.data())
        : null,
      likes: likes.docs.map((d) => d.id),
      comments: comments.docs
        .map((d) => PostCommentSchema.parse(d.data()))
        .reverse(),
      saved: saved.exists(),
    };
  }
  async save(value: FashionPost) {
    const post = FashionPostSchema.parse(value);
    if (!post.image) throw new Error("Add a real photo before publishing.");
    if (post.ownerId !== this.uid || post.sample)
      throw new Error("Publish only your own outfit.");
    const ref = doc(this.db(), "posts", post.id);
    await runTransaction(this.db(), async (tx) => {
      const old = await tx.get(ref);
      if (old.exists()) {
        if (
          JSON.stringify(FashionPostSchema.parse(old.data())) !==
          JSON.stringify(post)
        )
          throw new Error("This post already exists. Open it to manage it.");
        return;
      }
      tx.set(ref, clean(post));
    });
  }
  async edit(id: string, patch: Pick<FashionPost, "caption" | "visibility">) {
    const checked = z
      .object({
        caption: z.string().trim().max(1000),
        visibility: z.enum(["public", "friends"]),
      })
      .parse(patch);
    await updateDoc(doc(this.db(), "posts", id), {
      ...checked,
      updatedAt: isoNow(),
    });
  }
  async remove(id: string) {
    await deleteDoc(doc(this.db(), "posts", id));
  }
  async like(id: string, on: boolean) {
    const ref = doc(this.db(), "posts", id, "likes", this.uid);
    if (on) await setDoc(ref, { userId: this.uid });
    else await deleteDoc(ref);
  }
  async bookmark(id: string, on: boolean) {
    const ref = doc(this.db(), "users", this.uid, "savedPosts", id);
    if (on) {
      await getDoc(doc(this.db(), "posts", id));
      await setDoc(ref, { id, ownerId: this.uid, createdAt: isoNow() });
    } else await deleteDoc(ref);
  }
  async comment(id: string, text: string, commentId = makeId("comment")) {
    const value = PostCommentSchema.parse({
      id: commentId,
      authorId: this.uid,
      text,
      createdAt: isoNow(),
    });
    const ref = doc(this.db(), "posts", id, "comments", value.id);
    await runTransaction(this.db(), async (tx) => {
      const old = await tx.get(ref);
      if (old.exists()) {
        const previous = PostCommentSchema.parse(old.data());
        if (
          previous.authorId !== value.authorId ||
          previous.text !== value.text
        )
          throw new Error(
            "This comment was already sent with different contents.",
          );
        return;
      }
      tx.set(ref, value);
    });
  }
}
const localSchema = z.object({
  posts: z.array(FashionPostSchema),
  likes: z.record(z.string(), z.array(z.string())),
  saved: z.array(z.string()),
  comments: z.record(z.string(), z.array(PostCommentSchema)),
});
export class LocalPostRepository implements PostRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private data: () => AppData,
    private uid = "demo",
    private store: KeyValueStore = AsyncStorage,
  ) {}
  private key = "thread.posts.v1.demo";
  private async read() {
    const raw = await this.store.getItem(this.key);
    const stored = raw ? localSchema.parse(JSON.parse(raw)) : null;
    if (stored) {
      const photos = new Map(photoDemoPosts(this.data()).map((p) => [p.id, p]));
      return {
        ...stored,
        posts: [
          ...(
            await refreshDesignatedDemoPost(stored.posts, this.uid, this.store)
          ).map((post) => (post.sample ? photos.get(post.id) || post : post)),
          ...[...photos.values()].filter(
            (post) => !stored.posts.some((old) => old.id === post.id),
          ),
        ],
      };
    }
    return {
      posts: photoDemoPosts(this.data()),
      likes: {},
      saved: [],
      comments: {},
    } as z.infer<typeof localSchema>;
  }
  private async mutate(fn: (state: z.infer<typeof localSchema>) => void) {
    const task = this.queue.then(async () => {
      const state = await this.read();
      fn(state);
      await this.store.setItem(this.key, JSON.stringify(state));
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
  private accessible(p: FashionPost) {
    if (!canReadPost(p, this.uid, this.data()))
      throw new Error("This post is private or unavailable.");
    return p;
  }
  async page(cursor: FeedCursor = {}, ownerId?: string, savedOnly = false) {
    const s = await this.read();
    const rows = s.posts
      .filter(
        (p) =>
          (!ownerId || p.ownerId === ownerId) &&
          (!savedOnly || s.saved.includes(p.id)) &&
          canReadPost(p, this.uid, this.data()),
      )
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
    const after = cursor.local
      ? rows.findIndex((p) => p.id === cursor.local.id) + 1
      : 0;
    const posts = rows.slice(after, after + 8),
      last = posts.at(-1);
    return {
      posts,
      cursor: last ? { local: { at: last.createdAt, id: last.id } } : cursor,
      hasMore: after + 8 < rows.length,
    };
  }
  async detail(id: string) {
    const s = await this.read(),
      post = s.posts.find((p) => p.id === id);
    if (!post) throw new Error("This post is private or unavailable.");
    this.accessible(post);
    return {
      post,
      creator: this.data().directory.find((p) => p.id === post.ownerId) || null,
      likes: s.likes[id] || [],
      comments: s.comments[id] || [],
      saved: s.saved.includes(id),
    };
  }
  async save(value: FashionPost) {
    const p = FashionPostSchema.parse(value);
    if (!p.image) throw new Error("Add a real photo before publishing.");
    if (p.ownerId !== this.uid || p.sample)
      throw new Error("Publish only your own outfit.");
    for (const piece of p.pieces) {
      const actual = this.data().garments.find(
        (g) => g.id === piece.id && g.ownerId === this.uid,
      );
      if (
        !actual ||
        JSON.stringify(PostPieceSchema.parse(postPiece(actual))) !==
          JSON.stringify(piece)
      )
        throw new Error("Select current clothing from your own closet.");
    }
    return this.mutate((s) => {
      const old = s.posts.find((x) => x.id === p.id);
      if (old && JSON.stringify(old) !== JSON.stringify(p))
        throw new Error("This post already exists.");
      if (!old) s.posts.unshift(p);
    });
  }
  async edit(id: string, patch: Pick<FashionPost, "caption" | "visibility">) {
    return this.mutate((state) => {
      const index = state.posts.findIndex((post) => post.id === id);
      if (index < 0 || state.posts[index].ownerId !== this.uid)
        throw new Error("Only the creator can edit this post.");
      state.posts[index] = FashionPostSchema.parse({
        ...state.posts[index],
        caption: patch.caption,
        visibility: patch.visibility,
        updatedAt: isoNow(),
      });
    });
  }
  async remove(id: string) {
    return this.mutate((s) => {
      const p = s.posts.find((p) => p.id === id);
      if (!p || p.ownerId !== this.uid)
        throw new Error("Only the creator can delete this post.");
      s.posts = s.posts.filter((p) => p.id !== id);
    });
  }
  async like(id: string, on: boolean) {
    await this.detail(id);
    return this.mutate((s) => {
      s.likes[id] = on
        ? [...new Set([...(s.likes[id] || []), this.uid])]
        : (s.likes[id] || []).filter((x) => x !== this.uid);
    });
  }
  async bookmark(id: string, on: boolean) {
    await this.detail(id);
    return this.mutate((s) => {
      s.saved = on
        ? [...new Set([...s.saved, id])]
        : s.saved.filter((x) => x !== id);
    });
  }
  async comment(id: string, text: string, commentId = makeId("comment")) {
    await this.detail(id);
    const c = PostCommentSchema.parse({
      id: commentId,
      authorId: this.uid,
      text,
      createdAt: isoNow(),
    });
    return this.mutate((s) => {
      if (!(s.comments[id] || []).some((x) => x.id === c.id))
        s.comments[id] = [...(s.comments[id] || []), c];
    });
  }
}
/** Photo-only fictional samples never use the user's personal uploads. */
let demo: LocalPostRepository | undefined, latest: AppData;
export function postRepository(user: User, data: AppData): PostRepository {
  if (user.mode !== "demo")
    return new FirebasePostRepository(user.id, () => data);
  latest = data;
  return (demo ??= new LocalPostRepository(() => latest));
}
