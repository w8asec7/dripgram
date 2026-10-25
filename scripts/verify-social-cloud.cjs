// Optional two-account cloud collaboration smoke test; no real people or emails.
const { chromium, expect } = require("@playwright/test");
const { cloudAdmin, cleanup } = require("./verify-cloud.cjs");
const project = "thread-hacktx-2026-rp";
async function signup(browser, name, suffix) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  const page = await context.newPage();
  const email = `qa-${Date.now() + suffix}@example.test`;
  await page.goto("http://localhost:8081/auth/sign-up");
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`Thread-QA-${Date.now()}!`);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip for now", exact: true })
    .waitFor();
  const uid = (
    await cloudAdmin(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
      "POST",
      { email: [email] },
    )
  ).users[0].localId;
  for (let i = 0; i < 2; i++)
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
  await page
    .getByRole("button", {
      name: "Explore without adding clothes",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Meet your wardrobe", exact: true })
    .click();
  await page.getByText("Today, made easy", { exact: true }).waitFor();
  return { context, page, uid };
}
async function username(page, name) {
  await page.goto("http://localhost:8081/settings/edit-profile");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Your preferences, updated.", { exact: true }),
  ).toBeVisible();
}
async function garment(page, name, category) {
  await page.goto("http://localhost:8081/garment/new");
  await page.getByLabel("Garment name", { exact: true }).fill(name);
  if (category)
    await page.getByRole("button", { name: category, exact: true }).click();
  await page
    .getByRole("button", { name: "Add to my wardrobe", exact: true })
    .click();
  await page.getByText(name, { exact: true }).last().waitFor();
  return page.url().split("/").at(-1);
}
async function cleanupSocial(uid) {
  const account = await cloudAdmin(
    `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
    "POST",
    { localId: [uid] },
  );
  if (!/^qa-\d+@example\.test$/.test(account.users?.[0]?.email || ""))
    throw new Error("Refusing to remove non-QA collaboration records.");
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  async function records(collectionId, fieldPath, op = "EQUAL") {
    const r = await cloudAdmin(`${base}:runQuery`, "POST", {
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op,
            value: { stringValue: uid },
          },
        },
      },
    });
    return r.filter((x) => x.document).map((x) => x.document.name);
  }
  for (const name of await records("occasions", "ownerId")) {
    const submissions = await cloudAdmin(
      `https://firestore.googleapis.com/v1/${name}/submissions`,
    );
    for (const s of submissions.documents || []) {
      for (const kind of ["votes", "comments"]) {
        const children = await cloudAdmin(
          `https://firestore.googleapis.com/v1/${s.name}/${kind}`,
        );
        for (const c of children.documents || [])
          await cloudAdmin(
            `https://firestore.googleapis.com/v1/${c.name}`,
            "DELETE",
          );
      }
      await cloudAdmin(
        `https://firestore.googleapis.com/v1/${s.name}`,
        "DELETE",
      );
    }
    await cloudAdmin(`https://firestore.googleapis.com/v1/${name}`, "DELETE");
  }
  const names = new Set([
    ...(await records("sharedGarments", "ownerId")),
    ...(await records("friendRequests", "fromId")),
    ...(await records("friendRequests", "toId")),
    ...(await records("friendships", "members", "ARRAY_CONTAINS")),
  ]);
  for (const name of names)
    await cloudAdmin(`https://firestore.googleapis.com/v1/${name}`, "DELETE");
  await cleanup(uid);
}
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error("Set THREAD_RUN_LIVE_QA=1 explicitly.");
  const browser = await chromium.launch({ headless: true });
  const users = [];
  try {
    const a = await signup(browser, "Cloud Host QA", 1);
    users.push(a);
    const b = await signup(browser, "Cloud Friend QA", 2);
    users.push(b);
    const stamp = Date.now().toString().slice(-9);
    await username(a.page, `qahost_${stamp}`);
    await username(b.page, `qafriend_${stamp}`);
    const garmentId = await garment(a.page, "QA cloud tee");
    await garment(a.page, "QA cloud trousers", "Trousers");
    await a.page.goto("http://localhost:8081/outfit/build");
    await a.page
      .getByLabel("Name your look", { exact: true })
      .fill("QA shared look");
    await a.page
      .getByRole("button", { name: "Save this look", exact: true })
      .click();
    await a.page.getByText("QA shared look", { exact: true }).waitFor();
    await a.page.goto("http://localhost:8081/settings/friends");
    await a.page
      .getByLabel("Search by username", { exact: true })
      .fill(`qafriend_${stamp}`);
    await a.page
      .getByRole("button", { name: "Add friend", exact: true })
      .click();
    await expect(
      a.page.getByText("PENDING", { exact: true }).first(),
    ).toBeVisible();
    await b.page.goto("http://localhost:8081/settings/friends");
    await b.page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(
      b.page.getByText("Your circle · 1", { exact: true }),
    ).toBeVisible();
    console.log("Cloud friend request + accept: PASS");
    await a.page.goto("http://localhost:8081/occasion/new");
    await a.page
      .getByLabel("Occasion name", { exact: true })
      .fill("QA cloud dinner");
    await a.page
      .getByRole("button", { name: "Cloud Friend QA", exact: true })
      .click();
    await a.page
      .getByRole("button", { name: "Create occasion", exact: true })
      .click();
    await a.page.getByText("QA cloud dinner", { exact: true }).waitFor();
    const occasionUrl = a.page.url();
    await a.page
      .getByRole("button", { name: "Share a saved outfit", exact: true })
      .click();
    await a.page
      .getByRole("button", { name: "QA shared look", exact: true })
      .click();
    await expect(
      a.page.getByText("INTENTIONALLY SHARED", { exact: true }),
    ).toBeVisible();
    await b.page.goto(occasionUrl);
    await b.page
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await b.page.getByRole("button", { name: "Vote · 0", exact: true }).click();
    await expect(
      b.page.getByRole("button", { name: "Voted · 1", exact: true }),
    ).toBeVisible();
    await b.page
      .getByLabel("Comment on Cloud’s look", { exact: true })
      .fill("Cloud coordination works.");
    await b.page
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await a.page.reload();
    await expect(
      a.page.getByText("Cloud coordination works.", { exact: true }),
    ).toBeVisible();
    console.log("Cloud occasion, invitation, snapshot, vote + comment: PASS");
    await a.page.goto(`http://localhost:8081/garment/edit?id=${garmentId}`);
    await a.page
      .getByRole("button", { name: "More details & sharing", exact: true })
      .click();
    await a.page
      .getByRole("button", { name: "Selected friends", exact: true })
      .click();
    await a.page.getByRole("button", { name: "Cloud", exact: true }).click();
    await a.page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      a.page.getByText("Garment updated.", { exact: true }),
    ).toBeVisible();
    await b.page.goto(`http://localhost:8081/settings/profile?id=${a.uid}`);
    await expect(
      b.page.getByText("SHARED WITH YOU", { exact: true }),
    ).toBeVisible();
    console.log("Explicit cloud garment sharing: PASS");
  } catch (error) {
    for (let i = 0; i < users.length; i++) {
      await users[i].page.screenshot({
        path: `/tmp/thread-cloud-social-${i}.png`,
      });
      require("node:fs").writeFileSync(
        `/tmp/thread-cloud-social-${i}.txt`,
        await users[i].page.locator("body").innerText(),
      );
    }
    throw error;
  } finally {
    await browser.close();
    for (const user of users) await cleanupSocial(user.uid);
    console.log("Disposable collaboration records removed.");
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { cleanupSocial };
