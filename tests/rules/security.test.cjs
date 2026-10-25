const {
  beforeAll,
  afterAll,
  beforeEach,
  test,
  expect,
} = require("@jest/globals");
const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  writeBatch,
  deleteDoc,
  serverTimestamp,
} = require("firebase/firestore");
const { ref, uploadBytes, getBytes } = require("firebase/storage");
let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-thread",
    firestore: {
      host: "127.0.0.1",
      port: 8088,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: fs.readFileSync("storage.rules", "utf8"),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "profiles", "alice"), {
      id: "alice",
      displayName: "Alice",
      username: "alice",
      photo: null,
    });
    await setDoc(doc(db, "profiles", "bob"), {
      id: "bob",
      displayName: "Bob",
      username: "bobby",
      photo: null,
    });
    await setDoc(doc(db, "users", "alice"), {
      id: "alice",
      displayName: "Alice",
    });
    await setDoc(doc(db, "users", "alice", "garments", "g1"), {
      id: "g1",
      ownerId: "alice",
      name: "Private tee",
      category: "t-shirt",
      primaryColor: "red",
      image: null,
    });
    await setDoc(doc(db, "friendships", "alice_bob"), {
      id: "alice_bob",
      members: ["alice", "bob"],
    });
    await setDoc(doc(db, "occasions", "oc1"), {
      id: "oc1",
      ownerId: "alice",
      participantIds: ["alice", "bob"],
      participants: [
        { userId: "alice", status: "accepted" },
        { userId: "bob", status: "invited" },
      ],
      theme: "Olive",
    });
    await setDoc(doc(db, "occasions", "oc1", "submissions", "alice"), {
      id: "alice",
      ownerId: "alice",
      outfitName: "Only a snapshot",
      pieces: [],
    });
  });
});
test("private wardrobe cannot be retrieved by guessed IDs or friendship", async () => {
  const bob = env.authenticatedContext("bob").firestore();
  await assertFails(getDoc(doc(bob, "users", "alice", "garments", "g1")));
  await assertFails(getDoc(doc(bob, "users", "alice")));
  await assertSucceeds(
    getDoc(
      doc(
        env.authenticatedContext("alice").firestore(),
        "users",
        "alice",
        "garments",
        "g1",
      ),
    ),
  );
});
test("unauthenticated directory and occasions are denied", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(db, "profiles")));
  await assertFails(getDoc(doc(db, "occasions", "oc1")));
});
test("owner cannot forge another owner ID", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertFails(
    setDoc(doc(db, "users", "alice", "garments", "g2"), {
      id: "g2",
      ownerId: "bob",
    }),
  );
  await assertFails(
    setDoc(doc(db, "users", "bob", "garments", "g2"), {
      id: "g2",
      ownerId: "alice",
    }),
  );
});
test("explicit garment sharing requires continuing friendship", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  await assertSucceeds(
    setDoc(doc(alice, "sharedGarments", "g1"), {
      ownerId: "alice",
      friendIds: ["bob"],
      piece: { id: "g1", name: "Shared tee" },
    }),
  );
  await assertSucceeds(getDoc(doc(bob, "sharedGarments", "g1")));
  await assertFails(
    getDoc(
      doc(env.authenticatedContext("eve").firestore(), "sharedGarments", "g1"),
    ),
  );
  await assertSucceeds(deleteDoc(doc(alice, "friendships", "alice_bob")));
  await assertFails(getDoc(doc(bob, "sharedGarments", "g1")));
});
test("only request recipient may accept; friendship needs accepted request", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  await deleteDoc(doc(alice, "friendships", "alice_bob"));
  const req = {
    id: "alice_bob",
    fromId: "alice",
    toId: "bob",
    status: "pending",
    createdAt: "2026-10-24T09:00:00.000Z",
  };
  await assertSucceeds(setDoc(doc(alice, "friendRequests", "alice_bob"), req));
  await assertFails(
    updateDoc(doc(alice, "friendRequests", "alice_bob"), {
      status: "accepted",
    }),
  );
  await assertFails(
    setDoc(doc(bob, "friendships", "alice_bob"), {
      id: "alice_bob",
      members: ["alice", "bob"],
    }),
  );
  const batch = writeBatch(bob);
  batch.update(doc(bob, "friendRequests", "alice_bob"), { status: "accepted" });
  batch.set(doc(bob, "friendships", "alice_bob"), {
    id: "alice_bob",
    members: ["alice", "bob"],
  });
  await assertSucceeds(batch.commit());
});
test("occasion queries require membership and outsider guesses fail", async () => {
  const db = env.authenticatedContext("bob").firestore();
  await assertSucceeds(
    getDocs(
      query(
        collection(db, "occasions"),
        where("participantIds", "array-contains", "bob"),
      ),
    ),
  );
  await assertFails(
    getDoc(
      doc(env.authenticatedContext("eve").firestore(), "occasions", "oc1"),
    ),
  );
});
test("participants can accept own invitation, suggest theme, vote and comment", async () => {
  const bob = env.authenticatedContext("bob").firestore();
  await assertSucceeds(
    updateDoc(doc(bob, "occasions", "oc1"), {
      participants: [
        { userId: "alice", status: "accepted" },
        { userId: "bob", status: "accepted" },
      ],
    }),
  );
  await assertSucceeds(
    updateDoc(doc(bob, "occasions", "oc1"), { theme: "Neutral friends" }),
  );
  await assertSucceeds(
    setDoc(
      doc(bob, "occasions", "oc1", "submissions", "alice", "votes", "bob"),
      { userId: "bob" },
    ),
  );
  await assertFails(
    setDoc(
      doc(bob, "occasions", "oc1", "submissions", "alice", "votes", "alice"),
      { userId: "alice" },
    ),
  );
  await assertSucceeds(
    setDoc(
      doc(bob, "occasions", "oc1", "submissions", "alice", "comments", "c1"),
      {
        id: "c1",
        authorId: "bob",
        text: "Looks great",
        createdAt: "2026-10-24T09:00:00.000Z",
      },
    ),
  );
  await assertFails(
    setDoc(
      doc(bob, "occasions", "oc1", "submissions", "alice", "comments", "c2"),
      { id: "c2", authorId: "alice", text: "Impersonation" },
    ),
  );
});
test("participants cannot change host, invite outsiders or overwrite another outfit", async () => {
  const bob = env.authenticatedContext("bob").firestore();
  await assertFails(
    updateDoc(doc(bob, "occasions", "oc1"), { ownerId: "bob" }),
  );
  await assertFails(
    updateDoc(doc(bob, "occasions", "oc1"), {
      participantIds: ["alice", "bob", "eve"],
    }),
  );
  await assertFails(
    setDoc(doc(bob, "occasions", "oc1", "submissions", "alice"), {
      id: "alice",
      ownerId: "bob",
      outfitName: "Hijacked",
      pieces: [],
    }),
  );
});
test("storage permits own images and denies foreign/non-image uploads", async () => {
  const alice = env.authenticatedContext("alice").storage();
  const bob = env.authenticatedContext("bob").storage();
  const bytes = new Uint8Array([137, 80, 78, 71]);
  await assertSucceeds(
    uploadBytes(ref(alice, "users/alice/garments/test.png"), bytes, {
      contentType: "image/png",
    }),
  );
  await assertFails(getBytes(ref(bob, "users/alice/garments/test.png")));
  await assertFails(
    uploadBytes(ref(bob, "users/alice/garments/hack.png"), bytes, {
      contentType: "image/png",
    }),
  );
  await assertFails(
    uploadBytes(ref(alice, "users/alice/garments/text.txt"), bytes, {
      contentType: "text/plain",
    }),
  );
});

test("shared-look groups protect private closets, restrict reactions/comments, and revoke departed members", async () => {
  const alice = env.authenticatedContext("alice").firestore(),
    bob = env.authenticatedContext("bob").firestore(),
    eve = env.authenticatedContext("eve").firestore();
  const group = {
    id: "crew",
    ownerId: "alice",
    name: "Weekend Crew",
    memberIds: ["alice", "bob"],
    createdAt: new Date().toISOString(),
  };
  await assertSucceeds(setDoc(doc(alice, "styleGroups", "crew"), group));
  await assertFails(getDoc(doc(eve, "styleGroups", "crew")));
  const look = {
    id: "look",
    ownerId: "alice",
    title: "Friday Dinner Fits",
    outfitId: null,
    groupId: "crew",
    parentId: null,
    audienceIds: ["alice", "bob"],
    pieces: [
      {
        id: "g1",
        name: "Only this tee",
        category: "t-shirt",
        primaryColor: "red",
        image: null,
      },
    ],
    createdAt: new Date().toISOString(),
  };
  await assertSucceeds(setDoc(doc(alice, "sharedLooks", "look"), look));
  await assertSucceeds(getDoc(doc(bob, "sharedLooks", "look")));
  await assertFails(getDoc(doc(eve, "sharedLooks", "look")));
  await assertFails(getDoc(doc(bob, "users", "alice", "garments", "g1")));
  await assertFails(
    setDoc(doc(alice, "sharedLooks", "forged"), {
      ...look,
      id: "forged",
      pieces: [{ id: "not-owned" }],
    }),
  );
  await assertFails(
    setDoc(doc(alice, "sharedLooks", "bad-audience"), {
      ...look,
      id: "bad-audience",
      audienceIds: ["alice", "eve"],
    }),
  );
  await assertSucceeds(
    setDoc(doc(bob, "sharedLooks", "look", "reactions", "bob"), {
      userId: "bob",
    }),
  );
  await assertFails(
    setDoc(doc(bob, "sharedLooks", "look", "reactions", "alice"), {
      userId: "alice",
    }),
  );
  await assertSucceeds(
    setDoc(doc(bob, "sharedLooks", "look", "comments", "comment"), {
      id: "comment",
      authorId: "bob",
      text: "Try the black pants.",
      createdAt: new Date().toISOString(),
    }),
  );
  await assertFails(
    updateDoc(doc(bob, "sharedLooks", "look"), {
      title: "I changed your look",
    }),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(bob, "sharedLooks"),
        where("groupId", "==", "crew"),
        where("audienceIds", "array-contains", "bob"),
      ),
    ),
  );
  await assertSucceeds(
    updateDoc(doc(bob, "styleGroups", "crew"), { memberIds: ["alice"] }),
  );
  await assertFails(getDoc(doc(bob, "sharedLooks", "look")));
});
test("direct outfit sharing requires continued friendship, including guessed documents", async () => {
  const alice = env.authenticatedContext("alice").firestore(),
    bob = env.authenticatedContext("bob").firestore();
  await assertSucceeds(
    setDoc(doc(alice, "sharedLooks", "direct"), {
      id: "direct",
      ownerId: "alice",
      title: "Only selected friends",
      outfitId: null,
      groupId: null,
      parentId: null,
      audienceIds: ["alice", "bob"],
      pieces: [{ id: "g1" }],
      createdAt: new Date().toISOString(),
    }),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(bob, "sharedLooks"),
        where("ownerId", "==", "alice"),
        where("groupId", "==", null),
        where("audienceIds", "array-contains", "bob"),
      ),
    ),
  );
  await assertSucceeds(deleteDoc(doc(bob, "friendships", "alice_bob")));
  await assertFails(getDoc(doc(bob, "sharedLooks", "direct")));
});

test("group-chat members can send and read messages; strangers, sender spoofing and edits are rejected", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const stranger = env.authenticatedContext("stranger").firestore();
  await assertSucceeds(
    setDoc(doc(alice, "styleGroups", "chat1"), {
      id: "chat1",
      ownerId: "alice",
      name: "Saturday Dinner",
      memberIds: ["alice", "bob"],
      createdAt: new Date().toISOString(),
    }),
  );
  const value = {
    id: "m1",
    authorId: "alice",
    text: "What do you think?",
    createdAt: new Date().toISOString(),
    sentAt: serverTimestamp(),
    attachment: null,
    replyTo: null,
  };
  await assertSucceeds(
    setDoc(doc(alice, "styleGroups", "chat1", "messages", "m1"), value),
  );
  await assertSucceeds(
    getDoc(doc(bob, "styleGroups", "chat1", "messages", "m1")),
  );
  await assertFails(
    getDoc(doc(stranger, "styleGroups", "chat1", "messages", "m1")),
  );
  await assertFails(
    setDoc(doc(bob, "styleGroups", "chat1", "messages", "forged"), {
      ...value,
      id: "forged",
    }),
  );
  await assertFails(
    updateDoc(doc(alice, "styleGroups", "chat1", "messages", "m1"), {
      text: "edited",
    }),
  );
  await assertFails(
    setDoc(doc(alice, "styleGroups", "chat1", "messages", "empty"), {
      ...value,
      id: "empty",
      text: "",
    }),
  );
  await assertSucceeds(
    setDoc(doc(bob, "styleGroups", "chat1", "messages", "reply"), {
      ...value,
      id: "reply",
      authorId: "bob",
      text: "Looks great",
      replyTo: { id: "m1", preview: "Outfit idea" },
    }),
  );
  await assertSucceeds(
    updateDoc(doc(alice, "styleGroups", "chat1"), { memberIds: ["alice"] }),
  );
  await assertFails(getDoc(doc(bob, "styleGroups", "chat1", "messages", "m1")));
});
test("chat outfit snapshots require actual owned pieces and never write laundry or private wardrobes", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const piece = {
    id: "g1",
    name: "Private tee",
    category: "t-shirt",
    primaryColor: "red",
    image: null,
  };
  const base = {
    id: "fit1",
    authorId: "alice",
    text: "My dinner look",
    createdAt: new Date().toISOString(),
    sentAt: serverTimestamp(),
    attachment: { title: "Dinner fit", outfitId: null, pieces: [piece] },
    replyTo: null,
  };
  await assertSucceeds(
    setDoc(doc(alice, "occasions", "oc1", "messages", "fit1"), base),
  );
  await assertSucceeds(
    getDoc(doc(bob, "occasions", "oc1", "messages", "fit1")),
  );
  await assertFails(getDoc(doc(bob, "users", "alice", "garments", "g1")));
  await assertFails(
    setDoc(doc(bob, "occasions", "oc1", "messages", "steal"), {
      ...base,
      id: "steal",
      authorId: "bob",
    }),
  );
  await assertFails(
    setDoc(doc(alice, "occasions", "oc1", "messages", "fake"), {
      ...base,
      id: "fake",
      attachment: {
        ...base.attachment,
        pieces: [{ ...piece, id: "not-owned" }],
      },
    }),
  );
  await assertFails(
    setDoc(doc(alice, "occasions", "oc1", "messages", "image-spoof"), {
      ...base,
      id: "image-spoof",
      attachment: {
        ...base.attachment,
        pieces: [
          {
            ...piece,
            image: { storagePath: "users/bob/garments/private/thumbnail.jpg" },
          },
        ],
      },
    }),
  );
  const original = await getDoc(doc(alice, "users", "alice", "garments", "g1"));
  expect(original.data()).toEqual({
    id: "g1",
    ownerId: "alice",
    name: "Private tee",
    category: "t-shirt",
    primaryColor: "red",
    image: null,
  });
});

test("eight-piece chat attachment stays within rule access limits and validates every piece", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const pieces = [];
  for (let i = 0; i < 8; i++) {
    const piece = {
      id: `chat-g${i}`,
      name: `Owned top ${i}`,
      category: "t-shirt",
      primaryColor: "red",
      image: null,
    };
    await setDoc(doc(alice, "users", "alice", "garments", piece.id), {
      ...piece,
      ownerId: "alice",
    });
    pieces.push(piece);
  }
  await assertSucceeds(
    setDoc(doc(alice, "occasions", "oc1", "messages", "eight"), {
      id: "eight",
      authorId: "alice",
      text: "",
      createdAt: new Date().toISOString(),
      sentAt: serverTimestamp(),
      attachment: { title: "All my selected pieces", outfitId: null, pieces },
      replyTo: null,
    }),
  );
});

test("social posts enforce visibility, actor-scoped interactions and explicit selected snapshot ownership", async () => {
  const alice = env.authenticatedContext("alice").firestore(),
    bob = env.authenticatedContext("bob").firestore(),
    eve = env.authenticatedContext("eve").firestore();
  const garment = {
    id: "post-tee",
    ownerId: "alice",
    name: "Red shirt",
    category: "t-shirt",
    primaryColor: "red",
    pattern: "solid",
    fit: "oversized",
    brand: null,
    styleTags: [],
    description: "A red shirt",
    subcategory: "t-shirt",
    image: null,
  };
  await assertSucceeds(
    setDoc(doc(alice, "users", "alice", "garments", garment.id), garment),
  );
  const piece = {
    id: garment.id,
    name: garment.name,
    category: garment.category,
    primaryColor: garment.primaryColor,
    pattern: garment.pattern,
    fit: garment.fit,
    brand: null,
    styleTags: [],
    description: garment.description,
    subcategory: garment.subcategory,
    image: null,
  };
  const post = {
    id: "post-one",
    ownerId: "alice",
    caption: "A real selected outfit",
    visibility: "friends",
    kind: "outfit",
    image: {
      uri: "",
      path: "users/alice/posts/post-one/v1.jpg",
      version: "v1",
    },
    pieces: [piece],
    outfitId: null,
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
    sample: false,
  };
  await assertSucceeds(getDoc(doc(alice, "posts", "post-one")));
  await assertSucceeds(setDoc(doc(alice, "posts", post.id), post));
  await assertSucceeds(getDoc(doc(bob, "posts", post.id)));
  await assertFails(getDoc(doc(eve, "posts", post.id)));
  await assertFails(
    getDocs(query(collection(eve, "posts"), where("ownerId", "==", "alice"))),
  );
  await assertSucceeds(
    getDocs(
      query(collection(eve, "posts"), where("visibility", "==", "public")),
    ),
  );
  await assertFails(
    setDoc(doc(bob, "posts", "forged"), {
      ...post,
      id: "forged",
      ownerId: "bob",
    }),
  );
  await assertFails(
    setDoc(doc(alice, "posts", "changed-piece"), {
      ...post,
      id: "changed-piece",
      pieces: [{ ...piece, primaryColor: "cream" }],
    }),
  );
  await assertSucceeds(
    setDoc(doc(bob, "posts", post.id, "likes", "bob"), { userId: "bob" }),
  );
  await assertFails(
    setDoc(doc(bob, "posts", post.id, "likes", "alice"), { userId: "alice" }),
  );
  await assertSucceeds(
    setDoc(doc(bob, "posts", post.id, "comments", "comment"), {
      id: "comment",
      authorId: "bob",
      text: "Nice outfit",
      createdAt: post.createdAt,
    }),
  );
  await assertFails(
    setDoc(doc(bob, "posts", post.id, "comments", "forged"), {
      id: "forged",
      authorId: "alice",
      text: "Fake",
      createdAt: post.createdAt,
    }),
  );
  await assertFails(
    updateDoc(doc(alice, "posts", post.id), {
      pieces: [{ ...piece, primaryColor: "blue" }],
    }),
  );
  await assertSucceeds(
    updateDoc(doc(alice, "posts", post.id), { visibility: "public" }),
  );
  await assertSucceeds(getDoc(doc(eve, "posts", post.id)));
  await assertSucceeds(
    updateDoc(doc(alice, "posts", post.id), { visibility: "friends" }),
  );
  await assertSucceeds(deleteDoc(doc(alice, "friendships", "alice_bob")));
  await assertFails(getDoc(doc(bob, "posts", post.id)));
  await assertFails(getDoc(doc(bob, "posts", post.id, "comments", "comment")));
});
test("post image metadata cannot point at another user or an arbitrary signed URL", async () => {
  const alice = env.authenticatedContext("alice").firestore();
  const post = {
    id: "photo-post",
    ownerId: "alice",
    caption: "Photo only",
    visibility: "public",
    image: {
      uri: "",
      path: "users/alice/posts/photo-post/v1.jpg",
      version: "v1",
    },
    pieces: [],
    outfitId: null,
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
    sample: false,
  };
  await assertSucceeds(setDoc(doc(alice, "posts", post.id), post));
  await assertSucceeds(
    setDoc(doc(alice, "posts", "clothing-photo"), {
      ...post,
      id: "clothing-photo",
      kind: "clothing",
      image: { ...post.image, path: "users/alice/posts/clothing-photo/v1.jpg" },
    }),
  );
  await assertFails(
    setDoc(doc(alice, "posts", "invalid-kind"), {
      ...post,
      id: "invalid-kind",
      kind: "video",
      image: { ...post.image, path: "users/alice/posts/invalid-kind/v1.jpg" },
    }),
  );
  await assertFails(
    setDoc(doc(alice, "posts", "no-photo"), {
      ...post,
      id: "no-photo",
      image: null,
    }),
  );

  await assertFails(
    setDoc(doc(alice, "posts", "wrong-path"), {
      ...post,
      id: "wrong-path",
      image: { ...post.image, path: "users/bob/posts/wrong-path/v1.jpg" },
    }),
  );
  await assertFails(
    setDoc(doc(alice, "posts", "public-url"), {
      ...post,
      id: "public-url",
      image: {
        ...post.image,
        path: "users/alice/posts/public-url/v1.jpg",
        uri: "https://example.com/secret",
      },
    }),
  );
  await assertSucceeds(
    setDoc(doc(alice, "users", "alice", "cart", "product"), {
      id: "product",
      ownerId: "alice",
      product: { name: "Saved actual listing" },
    }),
  );
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext("bob").firestore(),
        "users",
        "alice",
        "cart",
        "product",
      ),
    ),
  );
});
test("sharing a post into a conversation requires membership and current post visibility", async () => {
  const alice = env.authenticatedContext("alice").firestore(),
    eve = env.authenticatedContext("eve").firestore();
  const post = {
    id: "share-post",
    ownerId: "alice",
    caption: "A fit",
    visibility: "friends",
    image: {
      uri: "",
      path: "users/alice/posts/share-post/v1.jpg",
      version: "v1",
    },
    pieces: [],
    outfitId: null,
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
    sample: false,
  };
  await setDoc(doc(alice, "posts", post.id), post);
  const message = {
    id: "post-message",
    authorId: "alice",
    text: "",
    attachment: null,
    replyTo: null,
    post: { id: post.id, title: "A fit" },
    createdAt: post.createdAt,
    sentAt: serverTimestamp(),
  };
  await assertSucceeds(
    setDoc(doc(alice, "occasions", "oc1", "messages", message.id), message),
  );
  await assertFails(
    setDoc(doc(eve, "occasions", "oc1", "messages", "outsider"), {
      ...message,
      id: "outsider",
      authorId: "eve",
    }),
  );
  await assertFails(
    setDoc(doc(alice, "occasions", "oc1", "messages", "guessed-post"), {
      ...message,
      id: "guessed-post",
      post: { id: "nonexistent-private", title: "Guessed" },
    }),
  );
});

test("outfit preference feedback is owner-only, changeable and removable without garment writes", async () => {
  const alice = env.authenticatedContext("alice").firestore(),
    bob = env.authenticatedContext("bob").firestore();
  const record = {
    id: "look-feedback",
    ownerId: "alice",
    outfitId: "look-feedback",
    garmentIds: ["g1"],
    occasionType: "Casual day",
    response: "wore",
    createdAt: "2026-10-25T12:00:00.000Z",
    updatedAt: "2026-10-25T12:00:00.000Z",
  };
  const path = doc(alice, "users/alice/outfitFeedback/look-feedback");
  const before = (await getDoc(doc(alice, "users/alice/garments/g1"))).data();
  await assertSucceeds(setDoc(path, record));
  await assertSucceeds(updateDoc(path, { response: "did-not-wear" }));
  expect((await getDoc(path)).data().response).toBe("did-not-wear");
  await assertFails(
    getDoc(doc(bob, "users/alice/outfitFeedback/look-feedback")),
  );
  await assertFails(
    setDoc(doc(bob, "users/alice/outfitFeedback/look-feedback"), record),
  );
  expect((await getDoc(doc(alice, "users/alice/garments/g1"))).data()).toEqual(
    before,
  );
  await assertSucceeds(deleteDoc(path));
});
test("feedback rejects foreign references, forged ownership, duplicate IDs and laundry-like responses", async () => {
  const db = env.authenticatedContext("alice").firestore(),
    ref = doc(db, "users/alice/outfitFeedback/feedback");
  const base = {
    id: "feedback",
    ownerId: "alice",
    outfitId: "feedback",
    garmentIds: ["g1"],
    occasionType: "Casual day",
    response: "wore",
    createdAt: "2026-10-25T12:00:00.000Z",
    updatedAt: "2026-10-25T12:00:00.000Z",
  };
  for (const patch of [
    { garmentIds: ["guessed-private-id"] },
    { ownerId: "bob" },
    { garmentIds: ["g1", "g1"] },
    { response: "laundry" },
    { outfitId: "different" },
    { extra: "unapproved" },
  ])
    await assertFails(setDoc(ref, { ...base, ...patch }));
});
