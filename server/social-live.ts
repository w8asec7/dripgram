/** Live disposable-account chat/image QA. No AI/search calls, real people or camera use. */
import { chromium, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { makeProfile, seedGarments } from "../src/mocks/seed";
import { encodeFields, decodeFields } from "./firestore";
const liveExpect = expect.configure({ timeout: 15000 });
const { cleanup, cloudAdmin } = createRequire(resolve("server/social-live.ts"))(
  "../scripts/verify-cloud.cjs",
) as {
  cleanup: (uid: string) => Promise<void>;
  cloudAdmin: (
    url: string,
    method?: string,
    body?: unknown,
  ) => Promise<unknown>;
};
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw Error("Opt in with THREAD_RUN_LIVE_QA=1");
  const env = parseEnv(readFileSync(".env", "utf8"));
  const db = `https://firestore.googleapis.com/v1/projects/${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const accounts: {
    uid: string;
    token: string;
    email: string;
    password: string;
  }[] = [];
  const docs: string[] = [];
  let diagnosticPage: Page | undefined;
  let secondPage: Page | undefined;
  let thumbnailUploaded = false;
  const browser = await chromium.launch({ headless: true });
  const headers = (a: (typeof accounts)[number]) => ({
    Authorization: `Bearer ${a.token}`,
    "Content-Type": "application/json",
  });
  const put = async (
    a: (typeof accounts)[number],
    path: string,
    data: Record<string, unknown>,
  ) => {
    const r = await fetch(db + "/" + path, {
      method: "PATCH",
      headers: headers(a),
      body: JSON.stringify({ fields: encodeFields(data) }),
    });
    assert.ok(r.ok, `Fixture write failed ${r.status}`);
    docs.push(path);
  };
  const login = async (page: Page, a: (typeof accounts)[number]) => {
    await page.goto("http://localhost:8081/auth/sign-in");
    await page.getByLabel("Email address", { exact: true }).fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(a.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText("Today, made easy", { exact: true }).waitFor();
  };
  try {
    for (let i = 0; i < 2; i++) {
      const email = `qa-${Date.now() + i}@example.test`,
        password = randomBytes(20).toString("hex");
      const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.EXPO_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      assert.ok(r.ok);
      const a = (await r.json()) as { localId: string; idToken: string };
      const account = { uid: a.localId, token: a.idToken, email, password };
      accounts.push(account);
      const profile = {
        ...makeProfile(
          account.uid,
          i ? "Social Fixture Bob" : "Social Fixture Alice",
        ),
        onboardingComplete: true,
      };
      await put(account, `users/${account.uid}`, {
        ...profile,
        revision: 0,
        skippedDates: [],
      });
      await put(account, `profiles/${account.uid}`, {
        id: account.uid,
        displayName: profile.displayName,
        username: profile.username,
        photo: null,
      });
    }
    const [a, b] = accounts;
    const pair = [a.uid, b.uid].sort().join("_");
    const request = {
      id: pair,
      fromId: a.uid,
      toId: b.uid,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await put(a, `friendRequests/${pair}`, request);
    await put(b, `friendRequests/${pair}`, { ...request, status: "accepted" });
    await put(b, `friendships/${pair}`, {
      id: pair,
      members: [a.uid, b.uid].sort(),
      createdAt: new Date().toISOString(),
    });
    await put(a, `users/${a.uid}/garments/fixture-tee`, {
      ...seedGarments[0],
      id: "fixture-tee",
      ownerId: a.uid,
      image: null,
      name: "Social fixture tee",
    });
    const contextA = await browser.newContext({
        viewport: { width: 393, height: 852 },
      }),
      contextB = await browser.newContext({
        viewport: { width: 393, height: 852 },
      });
    const pageA = await contextA.newPage(),
      pageB = await contextB.newPage();
    diagnosticPage = pageA;
    secondPage = pageB;
    await login(pageA, a);
    await pageA.goto("http://localhost:8081/settings");
    await pageA.getByRole("button", { name: "Women’s", exact: true }).click();
    await pageA
      .getByText("Clothing preference saved.", { exact: true })
      .waitFor();
    await pageA.reload();
    await liveExpect(
      pageA.getByRole("button", { name: "Women’s", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const savedProfile = (await cloudAdmin(`${db}/users/${a.uid}`)) as {
      fields: Record<string, unknown>;
    };
    assert.equal(
      (
        decodeFields(savedProfile.fields).preferences as {
          clothingMode: string;
        }
      ).clothingMode,
      "women",
    );
    console.log(
      "Cloud clothing preference persistence through UI / restart: PASS",
    );
    await pageA.goto("http://localhost:8081/social/group/new");
    await pageA
      .getByLabel("Group name", { exact: true })
      .fill("Cloud Fixture Crew");
    await pageA
      .getByRole("button", { name: "Social Fixture Bob", exact: true })
      .click();
    await pageA
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await liveExpect(pageA).toHaveURL(/\/social\/group\/(?!new)[^/]+$/);
    const gid = pageA.url().split("/").at(-1)!;
    docs.push("styleGroups/" + gid);
    console.log("Cloud group creation via app repository: PASS");
    await pageA
      .getByLabel("Message", { exact: true })
      .fill("What do you think of this fit?");
    await pageA
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await liveExpect(
      pageA.getByText("What do you think of this fit?", { exact: true }),
    ).toBeVisible();
    await login(pageB, b);
    await pageB.goto(`http://localhost:8081/social/group/${gid}`);
    await liveExpect(
      pageB.getByText("What do you think of this fit?", { exact: true }),
    ).toBeVisible();
    await pageB
      .getByLabel("Message", { exact: true })
      .fill("Try the black pants.");
    await pageB
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await liveExpect(pageB.getByLabel("Message", { exact: true })).toHaveValue(
      "",
    );
    await liveExpect(
      pageA.getByText("Try the black pants.", { exact: true }),
    ).toBeVisible();
    console.log("Two-account realtime text delivery without refresh: PASS");

    const thumbnail = await fetch("http://127.0.0.1:3001/v1/images/thumbnail", {
      method: "POST",
      headers: headers(a),
      body: JSON.stringify({
        garmentId: "fixture-tee",
        image: {
          base64: readFileSync("tests/fixtures/red-shirt.jpg").toString(
            "base64",
          ),
          mimeType: "image/jpeg",
        },
      }),
    });
    assert.ok(thumbnail.ok, "Private fixture thumbnail upload failed");
    thumbnailUploaded = true;
    const uploaded = (await thumbnail.json()) as {
      path: string;
      syncedAt: string;
    };
    await put(a, `users/${a.uid}/garments/fixture-tee`, {
      ...seedGarments[0],
      id: "fixture-tee",
      ownerId: a.uid,
      name: "Social fixture tee",
      image: {
        uri: "",
        source: "library",
        ownerId: a.uid,
        garmentId: "fixture-tee",
        storagePath: uploaded.path,
        syncStatus: "synced",
        syncedAt: uploaded.syncedAt,
      },
    });
    // Refresh only to load the newly uploaded fixture metadata, not for messages.
    const garmentBeforeSharing = (await cloudAdmin(
      `${db}/users/${a.uid}/garments/fixture-tee`,
    )) as { fields: Record<string, unknown> };
    await pageA.reload();
    await pageA
      .getByRole("button", { name: "Add outfit attachment", exact: true })
      .click();
    await pageA
      .getByRole("button", { name: "Select From My Closet", exact: true })
      .click();
    await pageA
      .getByRole("checkbox", { name: "Social fixture tee", exact: true })
      .click();
    await pageA
      .getByRole("button", { name: "Attach 1 piece", exact: true })
      .click();
    await pageA
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await liveExpect(
      pageB.getByText("My outfit idea", { exact: true }),
    ).toBeVisible();
    await pageB
      .getByRole("button", { name: "Reply to My outfit idea", exact: true })
      .click();
    await pageB
      .getByLabel("Message", { exact: true })
      .fill("That red shirt works.");
    await pageB
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await liveExpect(pageB.getByLabel("Message", { exact: true })).toHaveValue(
      "",
    );
    await liveExpect(
      pageA.getByText("That red shirt works.", { exact: true }),
    ).toBeVisible();
    await pageB.reload();
    await liveExpect(
      pageB.getByText("That red shirt works.", { exact: true }),
    ).toBeVisible();

    const messages = (await cloudAdmin(
      `${db}/styleGroups/${gid}/messages`,
    )) as { documents?: { name: string; fields: Record<string, unknown> }[] };
    const attached = messages.documents?.find((d) =>
      JSON.stringify(d.fields).includes("fixture-tee"),
    );
    assert.ok(attached, "Outfit message was not persisted");
    const mid = attached.name.split("/").at(-1)!;
    const sign = (context: boolean, authorization = true) =>
      fetch("http://127.0.0.1:3001/v1/images/sign", {
        method: "POST",
        headers: authorization
          ? headers(b)
          : { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: a.uid,
          garmentId: "fixture-tee",
          ...(context
            ? { chat: { kind: "group", id: gid, messageId: mid } }
            : {}),
        }),
      });
    assert.equal(
      (await sign(false)).status,
      403,
      "Friendship alone cannot retrieve the private thumbnail",
    );
    assert.equal((await sign(true, false)).status, 401);
    const signed = await sign(true);
    assert.equal(
      signed.status,
      200,
      "Explicit chat attachment must authorize selected image",
    );
    const link = (await signed.json()) as { signedUrl: string };
    const retrieved = await fetch(link.signedUrl);
    assert.ok(
      retrieved.ok && (await retrieved.arrayBuffer()).byteLength > 100,
      "Authorized thumbnail retrieval failed",
    );
    const publicUrl = `${new URL(env.SUPABASE_URL || "").origin}/storage/v1/object/public/hackTx/${uploaded.path}`;
    assert.ok(!(await fetch(publicUrl)).ok, "Bucket must remain private");
    const privateCloset = await fetch(
      `${db}/users/${a.uid}/garments/fixture-tee`,
      { headers: headers(b) },
    );
    assert.equal(privateCloset.status, 403);
    const wears = (await cloudAdmin(`${db}/users/${a.uid}/wears`)) as {
      documents?: unknown[];
    };
    const garmentAfterSharing = (await cloudAdmin(
      `${db}/users/${a.uid}/garments/fixture-tee`,
    )) as { fields: Record<string, unknown> };
    assert.deepEqual(
      decodeFields(garmentAfterSharing.fields),
      decodeFields(garmentBeforeSharing.fields),
      "Sharing must not change garment state or counters",
    );
    assert.equal(
      wears.documents?.length || 0,
      0,
      "Sharing must never create wear events",
    );
    console.log(
      "Persistent outfit attachments/replies, private Supabase image authorization, unchanged wear history: PASS",
    );
    await pageB.screenshot({
      path: "docs/screenshots/refinement-cloud-chat.png",
    });
    const group = (await cloudAdmin(`${db}/styleGroups/${gid}`)) as {
      fields: Record<string, unknown>;
    };
    await put(a, `styleGroups/${gid}`, {
      ...decodeFields(group.fields),
      memberIds: [a.uid],
    });
    assert.equal(
      (await sign(true)).status,
      403,
      "Leaving/removal must revoke new signed URLs",
    );
    console.log("Removed group member image access revoked: PASS");
  } catch (e) {
    if (secondPage && !secondPage.isClosed())
      console.log(
        "Second fixture page:",
        (await secondPage.locator("body").innerText()).slice(-1000),
      );
    if (diagnosticPage) {
      await diagnosticPage.screenshot({
        path: "docs/screenshots/phase3-social-error.png",
      });
      console.log(
        "Social diagnostic:",
        new URL(diagnosticPage.url()).pathname,
        (await diagnosticPage.locator("body").innerText()).slice(-1800),
      );
    }
    throw e;
  } finally {
    await browser.close();
    if (thumbnailUploaded && accounts[0]) {
      const removed = await fetch("http://127.0.0.1:3001/v1/images/thumbnail", {
        method: "DELETE",
        headers: headers(accounts[0]),
        body: JSON.stringify({ garmentId: "fixture-tee" }),
      });
      assert.ok(removed.ok, "Temporary fixture thumbnail cleanup failed");
    }
    for (const group of docs.filter((p) => /^styleGroups\/[^/]+$/.test(p))) {
      const messages = (await cloudAdmin(`${db}/${group}/messages`)) as {
        documents?: { name: string }[];
      };
      messages.documents?.forEach((m) =>
        docs.push(m.name.split("/documents/")[1]),
      );
    }
    for (const path of [
      ...new Set(
        docs.filter(
          (p) => !p.startsWith("users/") && !p.startsWith("profiles/"),
        ),
      ),
    ].reverse())
      await cloudAdmin(db + "/" + path, "DELETE");
    for (const a of accounts) await cleanup(a.uid);
    console.log("Disposable social fixtures removed.");
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Social QA failed");
  process.exitCode = 1;
});
