import { categoryGroup, type Category } from "../src/models";
/** Reconcile contradictory literal observations, without inferring unseen attributes. */
export function normalizeClothingObservation<
  T extends {
    category: Category;
    name?: string;
    subcategory?: string | null;
    description?: string;
    brand?: string | null;
  },
>(piece: T): T {
  const text = [piece.name, piece.subcategory, piece.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let category = piece.category;
  const top = categoryGroup(piece.category) === "Tops",
    bottom = categoryGroup(piece.category) === "Bottoms";
  if (
    top &&
    /\b(button[- ]up|button[- ]down|oxford|dress shirt|collared shirt)\b/.test(
      text,
    )
  )
    category = "shirt";
  else if (top && /\b(hoodie|hooded sweatshirt)\b/.test(text))
    category = "hoodie";
  else if (top && /\b(tank[- ]top)\b/.test(text)) category = "tank-top";
  else if (top && /\b(t[- ]?shirt|tee)\b/.test(text)) category = "t-shirt";
  else if (bottom && /\b(jeans)\b/.test(text)) category = "jeans";
  else if (
    piece.category === "shoes" &&
    /\b(sneakers|boots|sandals|footwear)\b/.test(text)
  )
    category = "shoes";
  return {
    ...piece,
    category,
    ...(piece.brand !== undefined
      ? {
          brand:
            piece.brand &&
            !/^(unknown|not visible|unbranded|none)$/i.test(piece.brand.trim())
              ? piece.brand
              : null,
        }
      : {}),
  };
}
