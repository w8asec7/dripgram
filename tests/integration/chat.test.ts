import { MemoryStore, MockRepository } from "../../src/repositories/mock";
import { MockChatRepository } from "../../src/repositories/chat";
import { seedData } from "../../src/mocks/seed";
import {
  attachmentFromGarments,
  createChatMessage,
} from "../../src/features/social/chatDomain";
import { ChatMessage, chatPath } from "../../src/models/chat";
jest.mock("../../src/repositories/firebase", () => ({ cloudAuth: jest.fn() }));
test("chat persists text and outfit replies, deduplicates retries and never changes wear or laundry", async () => {
  const store = new MemoryStore(),
    wardrobe = new MockRepository(store);
  const data = await wardrobe.load("demo");
  const target = { kind: "occasion" as const, id: data.occasions[0].id };
  const chat = new MockChatRepository(store, () => data);
  const before = JSON.stringify({
    garments: data.garments,
    wears: data.wears,
    outfits: data.outfits,
  });
  const attachment = attachmentFromGarments(
    data.garments,
    "demo",
    data.garments.slice(0, 2).map((g) => g.id),
    "Dinner outfit",
  );
  const message = createChatMessage("demo", "What do you think?", attachment);
  let received: ChatMessage[] = [];
  const unsubscribe = chat.subscribe(
    target,
    (messages) => {
      received = messages;
    },
    (e) => {
      throw e;
    },
  );
  await chat.send(target, message);
  await chat.send(target, message);
  const reply = createChatMessage(
    "demo",
    "I might wear the blue jeans.",
    null,
    { id: message.id, preview: "Dinner outfit" },
  );
  await chat.send(target, reply);
  expect(received.filter((m) => m.id === message.id)).toHaveLength(1);
  expect(received.at(-1)?.replyTo?.id).toBe(message.id);
  unsubscribe();
  const restarted = new MockChatRepository(store, () => data);
  const history = await restarted.older(target, reply.id);
  expect(history.some((m) => m.id === message.id)).toBe(true);
  expect(
    JSON.stringify({
      garments: data.garments,
      wears: data.wears,
      outfits: data.outfits,
    }),
  ).toBe(before);
  expect((await wardrobe.load("demo")).wears).toEqual(data.wears);
});
test("chat rejects nonmembers, forged senders, foreign pieces and path traversal", async () => {
  const data = seedData(),
    store = new MemoryStore();
  const target = { kind: "occasion" as const, id: data.occasions[0].id };
  await expect(
    new MockChatRepository(store, () => data, "stranger").send(
      target,
      createChatMessage("stranger", "hello"),
    ),
  ).rejects.toThrow("private");
  await expect(
    new MockChatRepository(store, () => data).send(
      target,
      createChatMessage("someone-else", "hello"),
    ),
  ).rejects.toThrow("own account");
  expect(() =>
    attachmentFromGarments(data.garments, "demo", ["not-owned"], "Private"),
  ).toThrow("own selected");
  expect(() => chatPath({ kind: "group", id: "../private" })).toThrow();
});

test("chat history pages retain messages after restart and reject forged image snapshots", async () => {
  const store = new MemoryStore(),
    data = seedData();
  const target = { kind: "group" as const, id: data.groups[0].id };
  const chat = new MockChatRepository(store, () => data);
  const sent: ChatMessage[] = [];
  for (let i = 0; i < 55; i++) {
    const message = createChatMessage("demo", `History ${i}`);
    sent.push(message);
    await chat.send(target, message);
  }
  const older = await new MockChatRepository(store, () => data).older(
    target,
    sent[54].id,
  );
  expect(older).toHaveLength(50);
  expect(older.at(-1)?.text).toBe("History 53");
  const attachment = attachmentFromGarments(
    data.garments,
    "demo",
    [data.garments[0].id],
    "My look",
  );
  const forged = {
    ...attachment,
    pieces: attachment.pieces.map((p) => ({
      ...p,
      primaryColor: "fabricated",
    })),
  };
  await expect(
    chat.send(target, createChatMessage("demo", "", forged)),
  ).rejects.toThrow("current details");
});
