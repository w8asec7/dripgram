// Optional, explicitly invoked live smoke test. Does not run in npm test.
// Uses disposable example.test accounts, no real email delivery or camera access.
const { chromium } = require("@playwright/test");
const { Buffer } = require("node:buffer");
const project = "thread-hacktx-2026-rp";
async function cloudAdmin(path, method = "GET", body) {
  const cli = require("firebase-tools/lib/auth");
  const account = cli.getGlobalDefaultAccount();
  if (!account)
    throw new Error(
      "Sign in with Firebase CLI to clean up disposable QA records.",
    );
  const token = await cli.getAccessToken(account.tokens.refresh_token, []);
  const r = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Cloud QA cleanup failed (${r.status}).`);
  return result;
}
async function cleanup(uid) {
  const account = await cloudAdmin(
    `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
    "POST",
    { localId: [uid] },
  );
  if (!/^qa-\d+@example\.test$/.test(account.users?.[0]?.email || ""))
    throw new Error("Refusing to remove a non-QA account.");
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  for (const child of [
    "garments",
    "outfits",
    "essentials",
    "wears",
    "watches",
    "searches",
    "notifications",
    "products",
  ]) {
    const list = await cloudAdmin(`${base}/users/${uid}/${child}`);
    for (const d of list.documents || [])
      await cloudAdmin(
        `https://firestore.googleapis.com/v1/${d.name}`,
        "DELETE",
      );
  }
  await cloudAdmin(`${base}/users/${uid}`, "DELETE");
  await cloudAdmin(`${base}/profiles/${uid}`, "DELETE");
  await cloudAdmin(
    `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`,
    "POST",
    { localId: uid },
  );
}
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error(
      "Set THREAD_RUN_LIVE_QA=1 to run against the dedicated test project.",
    );
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const email = `qa-${Date.now()}@example.test`,
    password = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString(
      "base64",
    );
  let uid;
  try {
    await page.goto("http://localhost:8081/auth/sign-up");
    await page.getByLabel("Your name", { exact: true }).fill("Cloud QA");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .waitFor();
    console.log("Live sign-up and Firestore profile: PASS");
    uid = (
      await cloudAdmin(
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
        "POST",
        { email: [email] },
      )
    ).users?.[0]?.localId;
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
    require("node:fs").mkdirSync("docs/screenshots", { recursive: true });
    await page.goto("http://localhost:8081/closet");
    await page.getByText("Your closet.", { exact: true }).waitFor();
    await page.screenshot({ path: "docs/screenshots/phase2-empty-closet.png" });
    await page.goto("http://localhost:8081/garment/new");
    await page
      .getByRole("button", { name: "Photo library", exact: true })
      .waitFor();
    await page.screenshot({ path: "docs/screenshots/phase2-add-garment.png" });
    await page
      .getByLabel("Garment name", { exact: true })
      .fill("Cloud QA cotton shirt");
    await page
      .getByRole("button", { name: "Add to my wardrobe", exact: true })
      .click();
    await page
      .getByText("Cloud QA cotton shirt", { exact: true })
      .last()
      .waitFor();
    console.log("Cloud garment creation: PASS");
    await page.reload();
    await page
      .getByText("Cloud QA cotton shirt", { exact: true })
      .last()
      .waitFor();
    console.log("Cloud session + wardrobe persistence: PASS");
    await page.goto("http://localhost:8081/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText("Today, made easy", { exact: true }).waitFor();
    console.log("Live email/password sign-in: PASS");
  } finally {
    await browser.close();
    if (uid) {
      await cleanup(uid);
      console.log("Disposable QA account and records removed.");
    }
  }
}
module.exports = { cleanup, cloudAdmin };
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
