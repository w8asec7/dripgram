import { styles } from "../../models";
import type { Garment } from "../../models";
export const recognitionFields = [
  "name",
  "category",
  "primaryColor",
  "secondaryColors",
  "pattern",
  "fit",
  "styleTags",
  "brand",
  "subcategory",
  "material",
  "season",
  "occasions",
  "description",
  "searchKeywords",
  "uncertainFields",
  "silhouette",
  "texture",
  "colorReview",
] as const;
/** Apply each observation independently. A custom name must never block the color. */
export function reviewAnalysis(
  current: Garment,
  analysis: Partial<Garment>,
  edited: ReadonlySet<string>,
): Garment {
  const result = { ...current };
  for (const field of recognitionFields) {
    if (analysis[field] !== undefined && !edited.has(field))
      Object.assign(result, {
        [field]:
          field === "styleTags"
            ? analysis.styleTags?.map(
                (tag) =>
                  styles.find((s) => s.toLowerCase() === tag.toLowerCase()) ||
                  tag,
              )
            : analysis[field],
      });
  }
  return result;
}
export function normalizeColor(value: string) {
  const c = value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return (
    (
      {
        gray: "grey",
        "off white": "cream",
        "off-white": "cream",
        "dark gray": "charcoal",
        "dark grey": "charcoal",
        "light gray": "light grey",
        "navy blue": "navy",
        "burgundy red": "burgundy",
      } as Record<string, string>
    )[c] ||
    c ||
    "unknown"
  );
}
