import { StylePiece, BulkGarmentsSchema } from "../../models/posts";
import { Garment, makeId, isoNow } from "../../models";
/** Explicit offline fallback; observations are taken only from literal text. */
export function extractOffline(text: string) {
  const garments = text
    .split(/,\s*|\s+and\s+/i)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((value) => {
      const lower = value.toLowerCase();
      const category: Garment["category"] = /sneaker|shoe|boot|sandal/.test(
        lower,
      )
        ? "shoes"
        : /jeans|denim pants/.test(lower)
          ? "jeans"
          : /pant|trouser|chino/.test(lower)
            ? "trousers"
            : /shorts/.test(lower)
              ? "shorts"
              : /hoodie/.test(lower)
                ? "hoodie"
                : /jacket|blazer/.test(lower)
                  ? "jacket"
                  : /sweater|knit/.test(lower)
                    ? "sweater"
                    : /tank/.test(lower)
                      ? "tank-top"
                      : /t-?shirt|tee/.test(lower)
                        ? "t-shirt"
                        : /shirt/.test(lower)
                          ? "shirt"
                          : "other-top";
      const color =
        lower.match(
          /\b(light blue|dark blue|burgundy|charcoal|red|grey|gray|blue|white|black|beige|cream|green|olive|sage|brown|pink|yellow|purple|navy)\b/,
        )?.[0] || "unknown";
      return {
        name: value.slice(0, 90),
        category,
        subcategory: null,
        primaryColor: color,
        fit:
          lower.match(
            /\b(oversized|baggy|relaxed|slim|regular|cropped|wide-leg|straight-leg)\b/,
          )?.[0] || "unknown",
        pattern: /striped/.test(lower)
          ? "striped"
          : /print|graphic/.test(lower)
            ? "graphic"
            : "unknown",
        brand:
          value.match(
            /polo ralph lauren|ralph lauren|nike|adidas|uniqlo|zara/i,
          )?.[0] || null,
        description: value.slice(0, 500),
        styleTags: [],
      };
    });
  return BulkGarmentsSchema.parse({ garments });
}
export function garmentFromDescription(
  piece: StylePiece,
  uid: string,
  size: string,
): Garment {
  return {
    ...piece,
    id: makeId("garment"),
    ownerId: uid,
    secondaryColors: [],
    size: size || null,
    image: null,
    availability: "available",
    favorite: false,
    visibility: "private",
    sharedWith: [],
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}
