// Explicit, scoped free Firebase Auth setting. Does not enable billing or other providers.
const { cloudAdmin } = require("./verify-cloud.cjs");
async function main() {
  if (process.env.THREAD_CONFIGURE_DEMO_AUTH !== "1")
    throw Error(
      "Set THREAD_CONFIGURE_DEMO_AUTH=1 to enable anonymous demo authentication.",
    );
  const url =
    "https://identitytoolkit.googleapis.com/admin/v2/projects/thread-hacktx-2026-rp/config";
  const config = await cloudAdmin(url + "?fields=signIn.anonymous");
  if (!config.signIn?.anonymous?.enabled)
    await cloudAdmin(url + "?updateMask=signIn.anonymous.enabled", "PATCH", {
      signIn: { anonymous: { enabled: true } },
    });
  console.log(
    "Anonymous demo auth: enabled. Other providers/billing unchanged.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
