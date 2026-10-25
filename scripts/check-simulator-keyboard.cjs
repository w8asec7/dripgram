/** Validate actual native hierarchy geometry. No screenshots/data leave this computer. */
const fs = require("node:fs");
const source = process.argv[2];
const inputId = process.argv[3] || "chat-message-input";
if (!source) throw new Error("Pass a Maestro native hierarchy JSON file.");
const tree = JSON.parse(fs.readFileSync(source, "utf8"));
const nodes = [];
function walk(node) {
  if (node.attributes) nodes.push(node.attributes);
  (node.children || []).forEach(walk);
}
walk(tree);
const rect = (node) => {
  const values = node.bounds.match(/-?\d+/g)?.map(Number);
  return values?.length === 4
    ? { left: values[0], top: values[1], right: values[2], bottom: values[3] }
    : null;
};
const keyboard = nodes
  .filter((n) =>
    /SystemInputAssistantView|UIKeyboardLayoutStar/.test(n["resource-id"]),
  )
  .map(rect)
  .filter(Boolean);
if (!keyboard.length)
  throw new Error("Native software keyboard is not visible.");
const keyboardTop = Math.min(...keyboard.map((r) => r.top));
const input = nodes.find(
  (n) =>
    n["resource-id"] === inputId ||
    (inputId === "chat-message-input" && n.accessibilityText === "Message"),
);
const inputBounds = input && rect(input);
const send = nodes.find((n) => n.accessibilityText === "Send message");
const sendBounds = send && rect(send);
if (!inputBounds) throw new Error("Native input was not found.");
const pass =
  inputBounds.bottom <= keyboardTop &&
  (!sendBounds || sendBounds.bottom <= keyboardTop);
const report = { inputId, inputBounds, sendBounds, keyboardTop, pass };
console.log(JSON.stringify(report, null, 2));
if (!pass) process.exitCode = 1;
