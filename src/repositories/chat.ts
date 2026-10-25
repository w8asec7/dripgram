import { LocalPostRepository } from "./posts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getFirestore,
  collection,
  doc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { AppData } from "../models";
import {
  ChatMessage,
  ChatMessageSchema,
  ChatTarget,
  chatPath,
} from "../models/chat";
import { cloudAuth } from "./firebase";
import { KeyValueStore } from "./contracts";
import {
  assertChatMember,
  attachmentFromGarments,
} from "../features/social/chatDomain";
export interface ChatRepository {
  subscribe(
    target: ChatTarget,
    receive: (messages: ChatMessage[]) => void,
    fail: (error: unknown) => void,
  ): () => void;
  older(target: ChatTarget, beforeId: string): Promise<ChatMessage[]>;
  send(target: ChatTarget, message: ChatMessage): Promise<void>;
}
const parseDocument = (raw: Record<string, unknown>) =>
  ChatMessageSchema.parse({
    ...raw,
    createdAt:
      raw.sentAt instanceof Timestamp
        ? raw.sentAt.toDate().toISOString()
        : raw.createdAt,
  });
export class FirebaseChatRepository implements ChatRepository {
  private db() {
    return getFirestore(cloudAuth().app);
  }
  subscribe(
    target: ChatTarget,
    receive: (messages: ChatMessage[]) => void,
    fail: (error: unknown) => void,
  ) {
    return onSnapshot(
      query(
        collection(this.db(), chatPath(target)),
        orderBy("sentAt", "desc"),
        limit(50),
      ),
      (snapshot) => {
        try {
          receive(snapshot.docs.map((d) => parseDocument(d.data())).reverse());
        } catch {
          fail(
            new Error(
              "Some messages could not be read. Refresh the conversation.",
            ),
          );
        }
      },
      fail,
    );
  }
  async older(target: ChatTarget, beforeId: string) {
    const db = this.db();
    const before = await getDoc(doc(db, chatPath(target), beforeId));
    if (!before.exists()) return [];
    const snapshot = await getDocs(
      query(
        collection(db, chatPath(target)),
        orderBy("sentAt", "desc"),
        startAfter(before),
        limit(50),
      ),
    );
    return snapshot.docs.map((d) => parseDocument(d.data())).reverse();
  }
  async send(target: ChatTarget, value: ChatMessage) {
    const message = ChatMessageSchema.parse(value),
      auth = cloudAuth();
    if (message.authorId !== auth.currentUser?.uid)
      throw new Error("Your session expired. Sign in again.");
    const db = this.db(),
      ref = doc(db, chatPath(target), message.id);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists()) {
        const previous = ChatMessageSchema.parse(existing.data());
        if (
          previous.authorId !== message.authorId ||
          previous.text !== message.text ||
          JSON.stringify(previous.attachment) !==
            JSON.stringify(message.attachment) ||
          JSON.stringify(previous.replyTo) !==
            JSON.stringify(message.replyTo) ||
          JSON.stringify(previous.post) !== JSON.stringify(message.post)
        )
          throw new Error(
            "This message was already sent with different contents.",
          );
        return;
      }
      transaction.set(ref, { ...message, sentAt: serverTimestamp() });
    });
  }
}
/** Local deterministic chat for simulated demo friends. Live accounts use Firestore above. */
export class MockChatRepository implements ChatRepository {
  private listeners = new Map<string, Set<(messages: ChatMessage[]) => void>>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private store: KeyValueStore,
    private data: () => AppData,
    private uid = "demo",
  ) {}
  private key(target: ChatTarget) {
    assertChatMember(this.data(), this.uid, target);
    return `thread.chat.v1.${this.uid}.${chatPath(target)}`;
  }
  private async read(target: ChatTarget) {
    const key = this.key(target),
      raw = await this.store.getItem(key);
    if (raw)
      return (JSON.parse(raw) as unknown[]).map((m) =>
        ChatMessageSchema.parse(m),
      );
    const data = this.data();
    const snapshots =
      target.kind === "group"
        ? data.looks
            .filter(
              (l) =>
                l.groupId === target.id && l.audienceIds.includes(this.uid),
            )
            .map((l) => ({
              id: l.id,
              authorId: l.ownerId,
              title: l.title,
              pieces: l.pieces,
              createdAt: l.createdAt,
            }))
        : data.occasions
            .find((o) => o.id === target.id)
            ?.submissions.map((s) => ({
              id: s.id,
              authorId: s.ownerId,
              title: s.outfitName,
              pieces: s.pieces,
              createdAt: data.profile.createdAt,
            })) || [];
    const messages = snapshots
      .filter((s) => s.pieces.length)
      .map((s) =>
        ChatMessageSchema.parse({
          id: `initial-${s.id}`,
          authorId: s.authorId,
          text: "What do you think of this look?",
          createdAt: s.createdAt,
          attachment: { title: s.title, outfitId: null, pieces: s.pieces },
          replyTo: null,
        }),
      );
    await this.store.setItem(key, JSON.stringify(messages));
    return messages;
  }
  subscribe(
    target: ChatTarget,
    receive: (messages: ChatMessage[]) => void,
    fail: (error: unknown) => void,
  ) {
    const key = this.key(target),
      listeners = this.listeners.get(key) || new Set();
    this.listeners.set(key, listeners);
    listeners.add(receive);
    let active = true;
    void this.read(target)
      .then((messages) => {
        if (active) receive(messages.slice(-50));
      })
      .catch((error) => {
        if (active) fail(error);
      });
    return () => {
      active = false;
      listeners.delete(receive);
      if (!listeners.size) this.listeners.delete(key);
    };
  }
  async older(target: ChatTarget, beforeId: string) {
    const all = await this.read(target),
      index = all.findIndex((m) => m.id === beforeId);
    return index > 0 ? all.slice(Math.max(0, index - 50), index) : [];
  }
  send(target: ChatTarget, value: ChatMessage) {
    const job = this.queue.then(async () => {
      const message = ChatMessageSchema.parse(value),
        key = this.key(target);
      if (message.authorId !== this.uid)
        throw new Error("Messages must be sent from your own account.");
      if (message.post)
        await new LocalPostRepository(this.data, this.uid, this.store).detail(
          message.post.id,
        );
      if (message.attachment) {
        const actual = attachmentFromGarments(
          this.data().garments,
          this.uid,
          message.attachment.pieces.map((p) => p.id),
          message.attachment.title,
          message.attachment.outfitId,
        );
        if (JSON.stringify(actual) !== JSON.stringify(message.attachment))
          throw new Error(
            "Share the current details of your own selected clothes.",
          );
      }
      const all = await this.read(target),
        existing = all.find((m) => m.id === message.id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(message))
          throw new Error(
            "This message was already sent with different contents.",
          );
        return;
      }
      if (message.replyTo && !all.some((m) => m.id === message.replyTo?.id))
        throw new Error("The message you replied to is unavailable.");
      const next = [...all, message];
      await this.store.setItem(key, JSON.stringify(next));
      this.listeners.get(key)?.forEach((receive) => receive(next.slice(-50)));
    });
    this.queue = job.catch(() => undefined);
    return job;
  }
}
let local: MockChatRepository | undefined;
let latestData: AppData;
const firebaseChat = new FirebaseChatRepository();
export function chatRepository(demo: boolean, data: AppData): ChatRepository {
  if (!demo) return firebaseChat;
  latestData = data;
  return (local ??= new MockChatRepository(AsyncStorage, () => latestData));
}
