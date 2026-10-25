import { FashionPost, RemixResult, StylePiece } from "../../models/posts";
import {
  AppData,
  Garment,
  categoryGroup,
  makeId,
  isoNow,
  Outfit,
} from "../../models";
import { isFriend } from "../../repositories/domain";
export function canReadPost(
  post: FashionPost,
  uid: string,
  data: Pick<AppData, "friendships">,
) {
  return (
    post.visibility === "public" ||
    post.ownerId === uid ||
    isFriend(data as AppData, post.ownerId, uid)
  );
}
export function postPiece(g: Garment, cloud = false) {
  return {
    id: g.id,
    name: g.name,
    category: g.category,
    primaryColor: g.primaryColor,
    pattern: g.pattern,
    fit: g.fit,
    brand: g.brand,
    description: g.description || "",
    subcategory: g.subcategory ?? null,
    styleTags: g.styleTags,
    image:
      cloud && g.image?.source !== "bundled"
        ? g.image?.syncStatus === "synced"
          ? { ...g.image, uri: "" }
          : null
        : g.image,
  };
}
export function comparableCategory(original: StylePiece, actual: Garment) {
  if (original.category === "jacket") return actual.category === "jacket";
  if (["hoodie", "sweater"].includes(original.category))
    return ["hoodie", "sweater"].includes(actual.category);
  return categoryGroup(original.category)
    ? categoryGroup(original.category) === categoryGroup(actual.category)
    : original.category === actual.category;
}
export function validateRemix(
  result: RemixResult,
  garments: Garment[],
  uid: string,
) {
  const indexes = new Set<number>(),
    ids = new Set<string>();
  for (const match of result.matches) {
    const original = result.original.pieces[match.sourceIndex];
    const actual = garments.find(
      (g) => g.id === match.garmentId && g.ownerId === uid,
    );
    if (
      !original ||
      !actual ||
      ids.has(actual.id) ||
      indexes.has(match.sourceIndex) ||
      !comparableCategory(original, actual)
    )
      throw new Error(
        "The remix referenced an unknown, duplicate or unsuitable garment. Please retry.",
      );
    ids.add(actual.id);
    indexes.add(match.sourceIndex);
  }
  for (const missing of result.missing) {
    if (
      !result.original.pieces[missing.sourceIndex] ||
      indexes.has(missing.sourceIndex)
    )
      throw new Error(
        "The remix returned an invalid missing piece. Please retry.",
      );
    indexes.add(missing.sourceIndex);
  }
  if (indexes.size !== result.original.pieces.length)
    throw new Error(
      "The remix did not account for every visible piece. Please retry.",
    );
  return result;
}
export function remixOutfit(
  result: RemixResult,
  garments: Garment[],
  uid: string,
): Outfit {
  validateRemix(result, garments, uid);
  const usedRoles = new Set<string>();
  return {
    id: makeId("outfit"),
    ownerId: uid,
    name: "My closet remix",
    occasionType: "Casual day",
    createdAt: isoNow(),
    plannedFor: null,
    confirmedAt: null,
    explanation: result.summary,
    source: result.source === "meta" ? "meta" : "deterministic-demo",
    items: result.matches.flatMap((m) => {
      const g = garments.find((g) => g.id === m.garmentId)!;
      let role: Outfit["items"][number]["role"] =
        categoryGroup(g.category) === "Bottoms"
          ? "bottom"
          : g.category === "shoes"
            ? "shoes"
            : g.category === "accessories"
              ? "accessory"
              : g.category === "jacket"
                ? "outerwear"
                : "top";
      if (
        role === "top" &&
        usedRoles.has(role) &&
        ["hoodie", "sweater"].includes(g.category)
      )
        role = "outerwear";
      if (usedRoles.has(role)) return [];
      usedRoles.add(role);
      return [{ garmentId: g.id, role }];
    }),
  };
}
export function sampleRemix(
  original: StylePiece[],
  garments: Garment[],
  uid: string,
  postId: string,
): RemixResult {
  const used = new Set<string>();
  const result: RemixResult = {
    postId,
    original: { pieces: original, summary: "Sample inspiration" },
    source: "sample",
    analysisSource: "sample",
    summary:
      "A rule-based sample remix using your own closet. Review the substitutions.",
    matches: [],
    missing: [],
  };
  original.forEach((piece, sourceIndex) => {
    const candidates = garments
      .filter(
        (g) =>
          g.ownerId === uid && !used.has(g.id) && comparableCategory(piece, g),
      )
      .sort(
        (a, b) =>
          Number(b.primaryColor === piece.primaryColor) * 4 +
          Number(b.category === piece.category) * 3 +
          Number(b.fit === piece.fit) -
          (Number(a.primaryColor === piece.primaryColor) * 4 +
            Number(a.category === piece.category) * 3 +
            Number(a.fit === piece.fit)),
      );
    const g = candidates[0];
    if (g) {
      used.add(g.id);
      result.matches.push({
        sourceIndex,
        garmentId: g.id,
        explanation: `Your ${g.primaryColor} ${g.name.toLowerCase()} is the closest category match.`,
      });
    } else
      result.missing.push({
        sourceIndex,
        query:
          `${piece.primaryColor} ${piece.fit === "unknown" ? "" : piece.fit} ${piece.subcategory || piece.category}`.replace(
            /\s+/g,
            " ",
          ),
        reason: "No matching category in your closet.",
      });
  });
  return validateRemix(result, garments, uid);
}
