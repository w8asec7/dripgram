import type { Garment, Outfit } from "../src/models";
export type OutfitRole = Outfit["items"][number]["role"];
export function garmentRole(category: Garment["category"]): OutfitRole {
  if (["jeans", "trousers", "shorts", "other-bottom"].includes(category))
    return "bottom";
  if (category === "shoes") return "shoes";
  if (category === "jacket") return "outerwear";
  if (category === "accessories") return "accessory";
  return "top";
}
export function requireOwnedGarment(
  garments: Garment[],
  uid: string,
  id?: string,
) {
  if (!id) return null;
  const garment = garments.find((g) => g.id === id && g.ownerId === uid);
  if (!garment)
    throw new Error(
      "The selected piece is no longer in your closet. Choose another piece.",
    );
  return garment;
}
export function assertRequiredGarment(items: Outfit["items"], id?: string) {
  if (id && !items.some((i) => i.garmentId === id))
    throw new Error(
      "The recommendation missed your required piece. Please retry.",
    );
}
