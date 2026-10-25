import { categoryGroup, type Garment } from "../../models";
import type { StylePiece } from "../../models/posts";
const colorFamilies: Record<string, string> = {
  white: "light-neutral",
  cream: "light-neutral",
  ivory: "light-neutral",
  offwhite: "light-neutral",
  beige: "warm-neutral",
  sand: "warm-neutral",
  tan: "warm-neutral",
  oatmeal: "warm-neutral",
  gray: "grey",
  charcoal: "grey",
  burgundy: "red",
  maroon: "red",
  indigo: "blue",
};
const normalize = (s: string) => s.toLowerCase().trim().replace(/[ -]/g, "");
const family = (s: string) => colorFamilies[normalize(s)] || normalize(s);
function categoryMatches(piece: StylePiece, garment: Garment) {
  if (piece.category === "shorts" || garment.category === "shorts")
    return piece.category === garment.category;
  if (
    ["hoodie", "sweater", "jacket", "shoes", "accessories"].includes(
      piece.category,
    )
  )
    return piece.category === garment.category;
  if (["hoodie", "sweater", "jacket"].includes(garment.category)) return false;
  return (
    !!categoryGroup(piece.category) &&
    categoryGroup(piece.category) === categoryGroup(garment.category)
  );
}
export function pieceSearchQuery(piece: StylePiece) {
  return [
    piece.primaryColor !== "unknown" ? piece.primaryColor : null,
    piece.fit !== "unknown" ? piece.fit : null,
    piece.subcategory || piece.category,
    piece.pattern !== "solid" && piece.pattern !== "unknown"
      ? piece.pattern
      : null,
    piece.brand,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
export function compareLookToCloset(
  pieces: StylePiece[],
  garments: Garment[],
  uid: string,
) {
  const used = new Set<string>();
  const rows = pieces.map((piece, index) => {
    const candidates = garments
      .filter(
        (g) =>
          g.ownerId === uid && !used.has(g.id) && categoryMatches(piece, g),
      )
      .sort((a, b) => {
        const score = (g: Garment) =>
          (normalize(g.primaryColor) === normalize(piece.primaryColor)
            ? 8
            : family(g.primaryColor) === family(piece.primaryColor)
              ? 5
              : 0) +
          (g.category === piece.category ? 3 : 0) +
          (g.fit === piece.fit ? 1 : 0) +
          (g.pattern === piece.pattern ? 1 : 0);
        return score(b) - score(a) || a.id.localeCompare(b.id);
      });
    const match = candidates[0];
    if (match) used.add(match.id);
    const knownColor =
      piece.primaryColor !== "unknown" && match?.primaryColor !== "unknown";
    const similar =
      !!match &&
      knownColor &&
      family(match.primaryColor) === family(piece.primaryColor) &&
      (piece.pattern === "solid" ||
        piece.pattern === "unknown" ||
        piece.pattern === match.pattern);
    const status = similar
      ? ("owned" as const)
      : !match
        ? ("missing" as const)
        : !knownColor
          ? ("review" as const)
          : ("different" as const);
    const reason = similar
      ? `You already own a similar piece: ${match!.name}. Try it before buying another.`
      : !match
        ? `You don't have a comparable ${piece.subcategory || piece.category} in your closet. This would help recreate the look.`
        : !knownColor
          ? `Review ${match.name}; its color or the source color needs confirmation.`
          : `Your closest piece is ${match.name} (${match.primaryColor}). This search explores the ${piece.primaryColor} ${piece.pattern === "solid" ? "tone" : "style"} in the photo.`;
    return {
      index,
      piece,
      match: match || null,
      status,
      reason,
      query: pieceSearchQuery(piece),
      priority:
        status === "missing"
          ? 3
          : status === "different"
            ? 2
            : status === "review"
              ? 1
              : 0,
    };
  });
  const priority = rows
    .filter((r) => r.priority >= 2)
    .sort((a, b) => b.priority - a.priority || a.index - b.index)[0]?.index;
  return rows.map((row) => ({ ...row, recommended: row.index === priority }));
}
