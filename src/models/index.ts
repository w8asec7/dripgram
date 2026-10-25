import { WeatherPreferenceSchema } from "../../shared/weather";
import { z } from "zod";
export const categories = [
  "t-shirt",
  "shirt",
  "tank-top",
  "other-top",
  "other-bottom",
  "hoodie",
  "sweater",
  "jacket",
  "jeans",
  "trousers",
  "shorts",
  "shoes",
  "accessories",
] as const;
export const availabilityStates = [
  "available",
  "reusable",
  "laundry",
  "unknown",
] as const;
export const styles = [
  "Streetwear",
  "Minimalist",
  "Casual",
  "Business casual",
  "Formal",
  "Vintage",
  "Athletic",
  "Classic",
  "Smart casual",
] as const;
export const occasionTypes = [
  "Casual day",
  "Classes",
  "Work",
  "Interview",
  "Networking",
  "Date",
  "Dinner",
  "Party",
  "Formal event",
  "Wedding",
  "Outdoor activity",
  "Custom occasion",
  "Gym",
  "Casual hangout",
] as const;
const id = z.string().min(1);
const stamp = z.string().datetime();
export const UserSchema = z.object({
  id,
  email: z.email(),
  mode: z.enum(["demo", "firebase"]),
  demoServices: z.enum(["live", "offline"]).optional(),
});
export const NotificationPreferenceSchema = z.object({
  daily: z.boolean(),
  dailyTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  occasions: z.boolean(),
  prices: z.boolean(),
  social: z.boolean(),
});
export const clothingModes = ["men", "women"] as const;
export const primaryCategories = ["Tops", "Bottoms", "Shoes"] as const;
export type ClothingMode = (typeof clothingModes)[number];
export type PrimaryCategory = (typeof primaryCategories)[number];
export const categoryGroup = (category: string): PrimaryCategory | null =>
  [
    "t-shirt",
    "shirt",
    "tank-top",
    "hoodie",
    "sweater",
    "jacket",
    "other-top",
  ].includes(category)
    ? "Tops"
    : ["jeans", "trousers", "shorts", "other-bottom"].includes(category)
      ? "Bottoms"
      : category === "shoes"
        ? "Shoes"
        : null;
export const StylePreferencesSchema = z.object({
  clothingMode: z.enum(clothingModes).optional(),
  styles: z.array(z.string()),
  size: z.string(),
  budget: z.number().nonnegative(),
  brands: z.array(z.string()),
  colors: z.array(z.string()),
  priorities: z.array(z.string()),
});
export const ProfileSchema = z.object({
  id,
  displayName: z.string().min(1).max(60),
  username: z.string().regex(/^[a-z0-9_]{3,24}$/),
  photo: z.string().nullable(),
  bio: z.string().max(180).optional(),
  preferences: StylePreferencesSchema,
  onboardingComplete: z.boolean(),
  notifications: NotificationPreferenceSchema,
  weather: WeatherPreferenceSchema.optional(),
  createdAt: stamp,
});
export const PublicProfileSchema = ProfileSchema.pick({
  id: true,
  displayName: true,
  username: true,
  photo: true,
  bio: true,
});
export const GarmentImageSchema = z.object({
  uri: z.string(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  source: z.enum(["bundled", "camera", "library"]),
  storagePath: z.string().optional(),
  ownerId: z.string().optional(),
  garmentId: z.string().optional(),
  syncStatus: z.enum(["local", "pending", "synced", "failed"]).optional(),
  expiresAt: z.number().optional(),
  syncedAt: z.string().optional(),
});
export const GarmentSchema = z.object({
  id,
  ownerId: id,
  name: z.string().trim().min(2, "Use at least two characters.").max(90),
  category: z.enum(categories),
  subcategory: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  silhouette: z.string().optional(),
  texture: z.array(z.string()).optional(),
  colorReview: z.string().optional(),
  season: z.array(z.string()).optional(),
  occasions: z.array(z.string()).optional(),
  description: z.string().optional(),
  searchKeywords: z.array(z.string()).optional(),
  uncertainFields: z.array(z.string()).optional(),
  primaryColor: z.string().min(1),
  secondaryColors: z.array(z.string()),
  pattern: z.string(),
  fit: z.string(),
  styleTags: z.array(z.string()),
  brand: z.string().nullable(),
  size: z.string().nullable(),
  image: GarmentImageSchema.nullable(),
  availability: z.enum(availabilityStates),
  wearCount: z.number().int().nonnegative().optional(),
  maxWearsBeforeLaundry: z.number().int().min(1).max(100).nullable().optional(),
  lastWornAt: z.string().nullable().optional(),
  lastCleanedAt: z.string().nullable().optional(),
  manuallyOverridden: z.boolean().optional(),
  favorite: z.boolean(),
  visibility: z.enum(["private", "selected-friends"]),
  sharedWith: z.array(id),
  createdAt: stamp,
  updatedAt: stamp,
});
export const EssentialsCategorySchema = z
  .object({
    id,
    ownerId: id,
    name: z.string().trim().min(2).max(50),
    total: z.number().int().nonnegative().max(999),
    clean: z.number().int().nonnegative().max(999),
  })
  .refine((x) => x.clean <= x.total, "Clean count cannot exceed total.");
export const OutfitItemSchema = z.object({
  garmentId: id,
  role: z.enum(["top", "bottom", "outerwear", "shoes", "accessory"]),
});
export const OutfitSchema = z.object({
  id,
  ownerId: id,
  name: z.string().min(2).max(90),
  occasionType: z.enum(occasionTypes),
  items: z.array(OutfitItemSchema).max(8),
  explanation: z.string(),
  createdAt: stamp,
  plannedFor: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  source: z.enum(["meta", "deterministic-demo"]).optional(),
});
export const OutfitFeedbackSchema = z.object({
  id,
  ownerId: id,
  outfitId: id,
  garmentIds: z.array(id).min(1).max(8),
  occasionType: z.enum(occasionTypes),
  response: z.enum(["wore", "did-not-wear"]),
  createdAt: stamp,
  updatedAt: stamp,
});
export type OutfitFeedback = z.infer<typeof OutfitFeedbackSchema>;
export const WearEventSchema = z.object({
  id,
  ownerId: id,
  garmentIds: z.array(id).min(1),
  outfitId: id.nullable(),
  date: z.iso.date(),
  createdAt: stamp,
});
export const OccasionParticipantSchema = z.object({
  userId: id,
  status: z.enum(["invited", "accepted"]),
});
export const SharedGarmentPermissionSchema = z.object({
  garmentId: id,
  ownerId: id,
  friendIds: z.array(id),
});
export const SharedPieceSchema = GarmentSchema.pick({
  id: true,
  name: true,
  category: true,
  primaryColor: true,
  image: true,
});
export const SharedGarmentSchema = z.object({
  ownerId: id,
  friendIds: z.array(id),
  piece: SharedPieceSchema,
});
export const SubmissionSchema = z.object({
  id,
  ownerId: id,
  outfitName: z.string(),
  pieces: z.array(SharedPieceSchema),
  votes: z.array(id),
  comments: z.array(
    z.object({
      id,
      authorId: id,
      text: z.string().trim().min(1).max(180),
      createdAt: stamp,
    }),
  ),
});
export const OccasionSchema = z.object({
  id,
  ownerId: id,
  name: z.string().trim().min(2).max(80),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  type: z.enum(occasionTypes),
  dressCode: z.string().max(80),
  description: z.string().max(500),
  participantIds: z.array(id),
  participants: z.array(OccasionParticipantSchema),
  submissions: z.array(SubmissionSchema),
  theme: z.string().max(100),
  createdAt: stamp,
});
export const FriendRequestSchema = z
  .object({
    id,
    fromId: id,
    toId: id,
    status: z.enum(["pending", "accepted", "rejected"]),
    createdAt: stamp,
  })
  .refine((x) => x.fromId !== x.toId, "Cannot request yourself.");
export const FriendshipSchema = z.object({
  id,
  members: z.array(id).length(2),
  createdAt: stamp,
});
export const ProductOfferSchema = z.object({
  retailer: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  originalPrice: z.number().positive().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  url: z.url().nullable(),
  shipping: z.string().nullable(),
  condition: z.string().nullable(),
});
export const ProductSchema = z.object({
  id,
  name: z.string(),
  category: z.enum(categories).nullable(),
  color: z.string().nullable(),
  brand: z.string().nullable(),
  sizes: z.array(z.string()),
  image: z.string().nullable(),
  checkedAt: z.string().optional(),
  providerId: z.string().nullable().optional(),
  pageToken: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  reviewCount: z.number().nullable().optional(),
  offer: ProductOfferSchema,
  similarity: z.number().min(0).max(1).nullable(),
  matchType: z.enum(["similar", "exact"]),
  compatibility: z.number().min(0).max(100).nullable(),
  sample: z.boolean(),
});
export const PriceSnapshotSchema = z.object({
  date: z.iso.date(),
  price: z.number().nonnegative(),
  currency: z.string().optional(),
  checkedAt: z.string().optional(),
});
export const PriceWatchSchema = z.object({
  id,
  ownerId: id,
  productId: id,
  targetPrice: z.number().positive(),
  history: z.array(PriceSnapshotSchema),
  product: ProductSchema.optional(),
  lastCheckedAt: z.string().optional(),
  syncError: z.string().optional(),
  createdAt: stamp,
});
export const ShoppingSearchSchema = z.object({
  id,
  ownerId: id,
  name: z.string().min(1),
  query: z.string().max(240),
  style: z.string().max(80).optional(),
  fit: z.string().max(60).optional(),
  occasion: z.string().max(80).optional(),
  category: z.enum(categories).optional(),
  group: z.enum(primaryCategories).optional(),
  clothingMode: z.enum(clothingModes).optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  brand: z.string().optional(),
  retailer: z.string().optional(),
  maxPrice: z.number().nonnegative().optional(),
  minPrice: z.number().nonnegative().optional(),
  onSale: z.boolean().optional(),
  sort: z.enum(["relevance", "price", "discount"]).optional(),
});
export const NotificationSchema = z.object({
  id,
  ownerId: id,
  title: z.string(),
  body: z.string(),
  kind: z.enum(["daily", "occasions", "prices", "social"]),
  read: z.boolean(),
  createdAt: stamp,
});
export const SocialGroupSchema = z.object({
  id,
  ownerId: id,
  name: z.string().trim().min(2).max(60),
  memberIds: z.array(id).min(1).max(8),
  createdAt: stamp,
});
export const SharedLookSchema = z.object({
  id,
  ownerId: id,
  title: z.string().trim().min(2).max(90),
  outfitId: id.nullable(),
  groupId: id.nullable(),
  parentId: id.nullable(),
  audienceIds: z.array(id).min(1).max(8),
  pieces: z.array(SharedPieceSchema).min(1).max(8),
  createdAt: stamp,
  reactions: z.array(id),
  comments: z.array(SubmissionSchema.shape.comments.element),
});
export type SocialGroup = z.infer<typeof SocialGroupSchema>;
export type SharedLook = z.infer<typeof SharedLookSchema>;
export const CartItemSchema = z.object({
  id,
  ownerId: id,
  product: ProductSchema,
  createdAt: stamp,
});
export type CartItem = z.infer<typeof CartItemSchema>;
export const AppDataSchema = z.object({
  profile: ProfileSchema,
  cart: z.array(CartItemSchema).default([]),
  outfitFeedback: z.array(OutfitFeedbackSchema).default([]),
  groups: z.array(SocialGroupSchema).default([]),
  looks: z.array(SharedLookSchema).default([]),
  sharedGarments: z.array(SharedGarmentSchema).default([]),
  directory: z.array(PublicProfileSchema),
  garments: z.array(GarmentSchema),
  essentials: z.array(EssentialsCategorySchema),
  outfits: z.array(OutfitSchema),
  wears: z.array(WearEventSchema),
  occasions: z.array(OccasionSchema),
  requests: z.array(FriendRequestSchema),
  friendships: z.array(FriendshipSchema),
  watches: z.array(PriceWatchSchema),
  searches: z.array(ShoppingSearchSchema),
  notifications: z.array(NotificationSchema),
  skippedDates: z.array(z.string()),
});
export type User = z.infer<typeof UserSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Garment = z.infer<typeof GarmentSchema>;
export type Category = Garment["category"];
export type Availability = Garment["availability"];
export type EssentialsCategory = z.infer<typeof EssentialsCategorySchema>;
export type Outfit = z.infer<typeof OutfitSchema>;
export type WearEvent = z.infer<typeof WearEventSchema>;
export type Occasion = z.infer<typeof OccasionSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type PriceWatch = z.infer<typeof PriceWatchSchema>;
export type ShoppingSearch = z.infer<typeof ShoppingSearchSchema>;
export type AppData = z.infer<typeof AppDataSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export const isoNow = () => new Date().toISOString();
export const dateOffset = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const today = () => dateOffset(0);
let sequence = 0;
export const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const categoryLabel = (value: string) =>
  ({
    "t-shirt": "T-shirts",
    shirt: "Shirts",
    "tank-top": "Tank tops",
    "other-top": "Other tops",
    "other-bottom": "Other bottoms",
    hoodie: "Hoodies",
    sweater: "Sweaters",
    jacket: "Jackets",
    jeans: "Jeans",
    trousers: "Trousers",
    shorts: "Shorts",
    shoes: "Shoes",
    accessories: "Accessories",
  })[value] ?? value;
