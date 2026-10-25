import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  signInAnonymously,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  writeBatch,
  Firestore,
  DocumentData,
} from "firebase/firestore";
import { z } from "zod";
import {
  AppData,
  CartItemSchema,
  AppDataSchema,
  SocialGroupSchema,
  SharedLookSchema,
  SharedGarmentSchema,
  User,
  PublicProfileSchema,
  GarmentSchema,
  OutfitSchema,
  OutfitFeedbackSchema,
  WearEventSchema,
  EssentialsCategorySchema,
  PriceWatchSchema,
  ShoppingSearchSchema,
  NotificationSchema,
  OccasionSchema,
  SubmissionSchema,
  FriendRequestSchema,
  FriendshipSchema,
  ProfileSchema,
} from "../models";
import { emptyData } from "../mocks/seed";
import { AuthRepository, DataRepository, Command } from "./contracts";
import { persistentAuth } from "./authPersistence";
import { applyCommand } from "./domain";
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = !!(
  config.apiKey &&
  config.authDomain &&
  config.projectId &&
  config.storageBucket &&
  config.appId
);
let app: FirebaseApp | undefined;
function firebaseApp() {
  if (!firebaseConfigured)
    throw new Error(
      "Firebase is not configured. Explore demo or add your Firebase configuration.",
    );
  return (
    app ??
    (app =
      getApps().find((app) => app.name === "[DEFAULT]") ??
      initializeApp(config))
  );
}
export function demoFirebaseApp() {
  if (!firebaseConfigured)
    throw new Error(
      "Live demo services are not configured. Use the offline sample demo instead.",
    );
  return (
    getApps().find((app) => app.name === "thread-demo") ||
    initializeApp(config, "thread-demo")
  );
}
let demoSignIn: Promise<import("firebase/auth").User> | undefined;
export async function demoCloudUser() {
  const auth = persistentAuth(demoFirebaseApp());
  await auth.authStateReady();
  if (auth.currentUser?.isAnonymous) return auth.currentUser;
  if (!demoSignIn)
    demoSignIn = signInAnonymously(auth)
      .then((result) => result.user)
      .catch((error) => {
        if (error?.code === "auth/operation-not-allowed")
          throw new Error(
            "Anonymous demo access is not enabled on Firebase. You can still use the offline sample demo.",
          );
        throw error;
      })
      .finally(() => {
        demoSignIn = undefined;
      });
  return demoSignIn;
}
export function cloudAuth() {
  return persistentAuth(firebaseApp());
}
function checkOwner(auth: Auth, id: string) {
  if (auth.currentUser?.uid !== id)
    throw new Error("Your session expired. Sign in again.");
}
const userFromAuth = (a: { uid: string; email: string | null }): User => ({
  id: a.uid,
  email: a.email ?? "",
  mode: "firebase",
});
export class FirebaseAuthRepository implements AuthRepository {
  async current() {
    const a = cloudAuth();
    await a.authStateReady();
    return a.currentUser ? userFromAuth(a.currentUser) : null;
  }
  async signIn(email: string, password: string) {
    return userFromAuth(
      (await signInWithEmailAndPassword(cloudAuth(), email, password)).user,
    );
  }
  async signUp(email: string, password: string, name: string) {
    const a = cloudAuth();
    const { user } = await createUserWithEmailAndPassword(a, email, password);
    await updateProfile(user, { displayName: name });
    return userFromAuth(user);
  }
  async forgotPassword(email: string) {
    await sendPasswordResetEmail(cloudAuth(), email);
  }
  async signOut() {
    await signOut(cloudAuth());
  }
}
const ownSchemas = {
  outfitFeedback: OutfitFeedbackSchema,
  cart: CartItemSchema,
  garments: GarmentSchema,
  essentials: EssentialsCategorySchema,
  outfits: OutfitSchema,
  wears: WearEventSchema,
  watches: PriceWatchSchema,
  searches: ShoppingSearchSchema,
  notifications: NotificationSchema,
};
const clean = (x: unknown): DocumentData =>
  JSON.parse(JSON.stringify(x)) as DocumentData;
const changed = (a: unknown, b: unknown) =>
  JSON.stringify(a) !== JSON.stringify(b);
export class FirebaseRepository implements DataRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private db(): Firestore {
    return getFirestore(firebaseApp());
  }

  private async readList<T>(path: string, schema: z.ZodType<T>) {
    const docs = await getDocs(collection(this.db(), path));
    return docs.docs.map((d) => schema.parse(d.data()));
  }
  async load(id: string): Promise<AppData> {
    return (await this.read(id)).data;
  }
  private async read(id: string): Promise<{ data: AppData; revision: number }> {
    checkOwner(cloudAuth(), id);
    const db = this.db();
    const p = doc(db, "users", id);
    let profileDoc = await getDoc(p);
    if (!profileDoc.exists()) {
      const d = emptyData(
        id,
        cloudAuth().currentUser?.displayName || "Your name",
      );
      const batch = writeBatch(db);
      batch.set(p, clean({ ...d.profile, revision: 0, skippedDates: [] }));
      batch.set(doc(db, "profiles", id), clean(d.directory[0]));
      await batch.commit();
      profileDoc = await getDoc(p);
    }
    const raw = profileDoc.data()!;
    const revision = Number(raw.revision) || 0;
    const base = emptyData(id, "Your name");
    base.profile = ProfileSchema.parse(raw);
    base.profile.preferences.clothingMode ??= "men";
    base.skippedDates = z.array(z.string()).parse(raw.skippedDates ?? []);
    const lists = await Promise.all(
      Object.entries(ownSchemas).map(
        async ([key, schema]) =>
          [
            key,
            await this.readList(`users/${id}/${key}`, schema as z.ZodType),
          ] as const,
      ),
    );
    for (const [key, value] of lists) Object.assign(base, { [key]: value });
    const [directory, occasions, sent, received, friendships] =
      await Promise.all([
        this.readList("profiles", PublicProfileSchema),
        getDocs(
          query(
            collection(db, "occasions"),
            where("participantIds", "array-contains", id),
          ),
        ),
        getDocs(
          query(collection(db, "friendRequests"), where("fromId", "==", id)),
        ),
        getDocs(
          query(collection(db, "friendRequests"), where("toId", "==", id)),
        ),
        getDocs(
          query(
            collection(db, "friendships"),
            where("members", "array-contains", id),
          ),
        ),
      ]);
    base.directory = directory;
    base.requests = [
      ...new Map(
        [...sent.docs, ...received.docs].map((d) => [
          d.id,
          FriendRequestSchema.parse(d.data()),
        ]),
      ).values(),
    ];
    base.friendships = friendships.docs.map((d) =>
      FriendshipSchema.parse(d.data()),
    );
    const shared = await Promise.all(
      base.friendships.map(async (f) => {
        const friendId = f.members.find((member) => member !== id)!;
        const snapshots = await getDocs(
          query(
            collection(db, "sharedGarments"),
            where("ownerId", "==", friendId),
            where("friendIds", "array-contains", id),
          ),
        );
        return snapshots.docs.map((s) => SharedGarmentSchema.parse(s.data()));
      }),
    );
    const groupDocs = await getDocs(
      query(
        collection(db, "styleGroups"),
        where("memberIds", "array-contains", id),
      ),
    );
    base.groups = groupDocs.docs.map((d) => SocialGroupSchema.parse(d.data()));
    const lookQueries = await Promise.all([
      getDocs(query(collection(db, "sharedLooks"), where("ownerId", "==", id))),
      ...base.friendships.map((f) =>
        getDocs(
          query(
            collection(db, "sharedLooks"),
            where(
              "ownerId",
              "==",
              f.members.find((m) => m !== id),
            ),
            where("groupId", "==", null),
            where("audienceIds", "array-contains", id),
          ),
        ),
      ),
      ...base.groups.map((g) =>
        getDocs(
          query(
            collection(db, "sharedLooks"),
            where("groupId", "==", g.id),
            where("audienceIds", "array-contains", id),
          ),
        ),
      ),
    ]);
    const lookDocs = [
      ...new Map(
        lookQueries.flatMap((q) => q.docs).map((d) => [d.id, d]),
      ).values(),
    ];
    base.looks = await Promise.all(
      lookDocs.map(async (d) => {
        const [reactions, comments] = await Promise.all([
          this.readList(
            `sharedLooks/${d.id}/reactions`,
            z.object({ userId: z.string() }),
          ),
          this.readList(
            `sharedLooks/${d.id}/comments`,
            SubmissionSchema.shape.comments.element,
          ),
        ]);
        return SharedLookSchema.parse({
          ...d.data(),
          reactions: reactions.map((r) => r.userId),
          comments,
        });
      }),
    );
    base.sharedGarments = shared.flat();
    base.occasions = await Promise.all(
      occasions.docs.map(async (d) => {
        const submissions = await this.readList(
          `occasions/${d.id}/submissions`,
          SubmissionSchema.omit({ votes: true, comments: true }),
        );
        const complete = await Promise.all(
          submissions.map(async (s) => {
            const [votes, comments] = await Promise.all([
              this.readList(
                `occasions/${d.id}/submissions/${s.id}/votes`,
                z.object({ userId: z.string() }),
              ),
              this.readList(
                `occasions/${d.id}/submissions/${s.id}/comments`,
                SubmissionSchema.shape.comments.element,
              ),
            ]);
            return { ...s, votes: votes.map((v) => v.userId), comments };
          }),
        );
        return OccasionSchema.parse({ ...d.data(), submissions: complete });
      }),
    );
    return { data: AppDataSchema.parse(base), revision };
  }
  execute(id: string, command: Command): Promise<AppData> {
    const job = this.queue.then(() => this.commit(id, command));
    this.queue = job.catch(() => undefined);
    return job;
  }
  private async commit(id: string, command: Command): Promise<AppData> {
    checkOwner(cloudAuth(), id);
    const { data: before, revision } = await this.read(id);
    const after = applyCommand(before, id, command);
    const db = this.db();
    await runTransaction(db, async (tx) => {
      const owner = doc(db, "users", id);
      const current = await tx.get(owner);
      if ((current.data()?.revision ?? 0) !== revision)
        throw new Error(
          "Your wardrobe changed on another device. Refresh and try again.",
        );
      tx.set(
        owner,
        clean({
          ...after.profile,
          skippedDates: after.skippedDates,
          revision: revision + 1,
        }),
      );
      const publicProfile = after.directory.find((p) => p.id === id);
      if (publicProfile && changed(before.profile, after.profile))
        tx.set(doc(db, "profiles", id), clean(publicProfile));
      for (const key of Object.keys(
        ownSchemas,
      ) as (keyof typeof ownSchemas)[]) {
        for (const record of after[key])
          if (
            changed(
              before[key].find((r) => r.id === record.id),
              record,
            )
          )
            tx.set(doc(db, "users", id, key, record.id), clean(record));
        for (const record of before[key])
          if (!after[key].some((r) => r.id === record.id))
            tx.delete(doc(db, "users", id, key, record.id));
      }
      for (const key of ["requests", "friendships"] as const) {
        const path = key === "requests" ? "friendRequests" : "friendships";
        for (const r of after[key])
          if (
            changed(
              before[key].find((x) => x.id === r.id),
              r,
            )
          )
            tx.set(doc(db, path, r.id), clean(r));
        for (const r of before[key])
          if (!after[key].some((x) => x.id === r.id))
            tx.delete(doc(db, path, r.id));
      }
      for (const group of after.groups) {
        const old = before.groups.find((g) => g.id === group.id);
        if (changed(old, group))
          tx.set(doc(db, "styleGroups", group.id), clean(group));
      }
      for (const group of before.groups)
        if (
          !after.groups.some((g) => g.id === group.id) &&
          group.ownerId === id
        )
          tx.delete(doc(db, "styleGroups", group.id));
      for (const look of after.looks) {
        const old = before.looks.find((l) => l.id === look.id);
        const { reactions, comments, ...body } = look;
        const oldBody = old
          ? (({ reactions, comments, ...rest }) => rest)(old)
          : undefined;
        if (changed(oldBody, body) && look.ownerId === id)
          tx.set(doc(db, "sharedLooks", look.id), clean(body));
        if (reactions.includes(id) && !old?.reactions.includes(id))
          tx.set(doc(db, "sharedLooks", look.id, "reactions", id), {
            userId: id,
          });
        if (!reactions.includes(id) && old?.reactions.includes(id))
          tx.delete(doc(db, "sharedLooks", look.id, "reactions", id));
        for (const c of comments)
          if (!old?.comments.some((x) => x.id === c.id) && c.authorId === id)
            tx.set(doc(db, "sharedLooks", look.id, "comments", c.id), clean(c));
      }
      for (const look of before.looks)
        if (
          !after.looks.some((l) => l.id === look.id) &&
          look.ownerId === id &&
          command.type === "look.delete"
        )
          tx.delete(doc(db, "sharedLooks", look.id));
      for (const o of after.occasions) {
        const previous = before.occasions.find((x) => x.id === o.id);
        const { submissions, ...metadata } = o;
        const oldMeta = previous
          ? (({ submissions, ...rest }) => rest)(previous)
          : undefined;
        if (changed(oldMeta, metadata)) {
          const target = doc(db, "occasions", o.id);
          if (command.type === "occasion.theme")
            tx.update(target, { theme: o.theme });
          else if (command.type === "occasion.join")
            tx.update(target, { participants: o.participants });
          else tx.set(target, clean(metadata));
        }
        for (const s of submissions) {
          const old = previous?.submissions.find((x) => x.id === s.id);
          const { votes, comments, ...body } = s;
          const oldBody = old
            ? (({ votes, comments, ...rest }) => rest)(old)
            : undefined;
          if (changed(oldBody, body))
            tx.set(
              doc(db, "occasions", o.id, "submissions", s.id),
              clean(body),
            );
          if (votes.includes(id) && !old?.votes.includes(id))
            tx.set(
              doc(db, "occasions", o.id, "submissions", s.id, "votes", id),
              { userId: id },
            );
          if (!votes.includes(id) && old?.votes.includes(id))
            tx.delete(
              doc(db, "occasions", o.id, "submissions", s.id, "votes", id),
            );
          for (const c of comments)
            if (!old?.comments.some((x) => x.id === c.id))
              tx.set(
                doc(
                  db,
                  "occasions",
                  o.id,
                  "submissions",
                  s.id,
                  "comments",
                  c.id,
                ),
                clean(c),
              );
        }
      }
      for (const o of before.occasions)
        if (!after.occasions.some((x) => x.id === o.id))
          tx.delete(doc(db, "occasions", o.id));
      if (
        command.type === "garment.save" ||
        command.type === "garment.delete" ||
        command.type === "garment.deleteMany" ||
        command.type === "friend.remove"
      ) {
        const records =
          command.type === "garment.save"
            ? [command.garment]
            : command.type === "garment.deleteMany"
              ? before.garments.filter((g) => command.ids.includes(g.id))
              : command.type === "garment.delete"
                ? before.garments.filter((g) => g.id === command.id)
                : after.garments;
        for (const g of records) {
          const updated = after.garments.find((x) => x.id === g.id);
          const share = doc(db, "sharedGarments", g.id);
          if (
            updated?.visibility === "selected-friends" &&
            updated.sharedWith.length
          )
            tx.set(
              share,
              clean({
                ownerId: id,
                friendIds: updated.sharedWith,
                piece: (({ id, name, category, primaryColor, image }) => ({
                  id,
                  name,
                  category,
                  primaryColor,
                  image,
                }))(updated),
              }),
            );
          else tx.delete(share);
        }
      }
    });
    return after;
  }
}
