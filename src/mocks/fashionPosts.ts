import { FashionPostSchema, StylePiece } from "../models/posts";
import type { AppData } from "../models";
const piece = (
  name: string,
  category: StylePiece["category"],
  primaryColor: string,
  fit = "unknown",
): StylePiece => ({
  name,
  category,
  primaryColor,
  fit,
  pattern: "solid",
  brand: null,
  description: name,
  subcategory: null,
  styleTags: [],
});
const looks = [
  {
    photo: "look-smart",
    caption: "A white shirt, soft tailoring, and a slower afternoon.",
    pieces: [
      piece("White button-up shirt", "shirt", "white"),
      piece("Light beige trousers", "trousers", "beige"),
    ],
  },
  {
    photo: "look-everyday",
    caption: "A plain white tee and dark jeans. Easy every day.",
    pieces: [
      piece("White crew-neck tee", "t-shirt", "white"),
      piece("Dark jeans", "jeans", "black"),
    ],
  },
  {
    photo: "look-tonal",
    caption: "Simple neutrals, relaxed proportions.",
    pieces: [
      piece("Beige knit top", "sweater", "beige"),
      piece("Beige trousers", "trousers", "beige"),
    ],
  },
  {
    photo: "look-hoodie",
    caption: "Grey hoodie, blue denim. Keep it simple.",
    pieces: [
      piece("Grey pullover hoodie", "hoodie", "grey"),
      piece("Blue jeans", "jeans", "blue"),
    ],
  },
  {
    photo: "look-basics",
    caption: "Black tee, beige cargos, white sneakers.",
    pieces: [
      piece("Black tee", "t-shirt", "black"),
      piece("Beige cargo trousers", "trousers", "beige"),
      piece("White sneakers", "shoes", "white"),
    ],
  },
  {
    photo: "look-smart",
    caption: "A plain shirt and relaxed trousers for dinner.",
    pieces: [
      piece("White button-up shirt", "shirt", "white"),
      piece("Beige trousers", "trousers", "beige"),
    ],
  },
  {
    photo: "look-hoodie",
    caption: "Comfortable separates for a casual afternoon.",
    pieces: [
      piece("Grey hoodie", "hoodie", "grey"),
      piece("Blue jeans", "jeans", "blue"),
    ],
  },
  {
    photo: "look-casual",
    caption: "Stripes, denim, and an easy city walk.",
    pieces: [
      {
        ...piece("Cream striped sweater", "sweater", "cream"),
        pattern: "striped",
      },
      piece("Blue jeans", "jeans", "blue"),
      piece("White sneakers", "shoes", "white"),
    ],
  },
  {
    photo: "tee-black",
    caption: "One good black tee. Endless possibilities.",
    kind: "clothing" as const,
    pieces: [piece("Black crew-neck tee", "t-shirt", "black")],
  },
  {
    photo: "shoes-white",
    caption: "Clean white sneakers for the daily rotation.",
    kind: "clothing" as const,
    pieces: [piece("White sneakers", "shoes", "white")],
  },
  {
    photo: "jacket-rust",
    caption: "Warm color, simple styling.",
    kind: "clothing" as const,
    pieces: [piece("Orange chore jacket", "jacket", "orange")],
  },
  {
    photo: "tee-rose",
    caption: "A softer shade for your everyday tee.",
    kind: "clothing" as const,
    pieces: [piece("Rose crew-neck tee", "t-shirt", "rose")],
  },
];
export function photoDemoPosts(data: AppData) {
  const authors = data.directory.filter((p) => p.id !== "demo");
  return looks.map((look, index) =>
    FashionPostSchema.parse({
      id: `sample-post-${index + 1}`,
      ownerId: authors[index % authors.length]?.id || "maya",
      kind: look.kind || "outfit",
      caption: look.caption,
      visibility: "public",
      image: {
        uri: look.photo,
        path: null,
        version: "licensed-simple-photo-v2",
      },
      pieces: look.pieces.map((p, i) => ({
        ...p,
        id: `stock-${index}-${i}`,
        image: null,
      })),
      outfitId: null,
      createdAt: new Date(
        Date.parse("2026-10-24T18:00:00.000Z") - index * 3600000,
      ).toISOString(),
      updatedAt: "2026-10-24T18:00:00.000Z",
      sample: true,
    }),
  );
}
