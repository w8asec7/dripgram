import { demoAvatars } from "./demoRefresh";
import {
  AppData,
  AppDataSchema,
  Category,
  Garment,
  Outfit,
  Product,
  Profile,
  dateOffset,
  isoNow,
} from "../models";
const createdAt = "2026-10-24T09:00:00.000Z";
export const defaultPreferences: Profile["preferences"] = {
  clothingMode: "men",
  styles: ["Minimalist", "Casual"],
  size: "M",
  budget: 75,
  brands: [],
  colors: ["sage", "cream"],
  priorities: ["Wear what I own", "Value"],
};
export const makeProfile = (id: string, name: string): Profile => ({
  id,
  displayName: name,
  username:
    id === "demo"
      ? "rishi"
      : `user_${id
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase()
          .slice(0, 16)}`,
  photo: id === "demo" ? demoAvatars.demo : null,
  preferences: defaultPreferences,
  onboardingComplete: false,
  notifications: { daily: false, occasions: true, prices: true, social: true },
  createdAt,
});
const items: [string, Category, string, string, string, string][] = [
  ["Cloud cotton tee", "t-shirt", "cream", "oversized", "Casual", "tee-cream"],
  [
    "Sage everyday hoodie",
    "hoodie",
    "sage",
    "relaxed",
    "Streetwear",
    "hoodie-sage",
  ],
  [
    "Sand pleated trousers",
    "trousers",
    "beige",
    "relaxed",
    "Smart casual",
    "pants-sand",
  ],
  [
    "Everyday white sneakers",
    "shoes",
    "white",
    "regular",
    "Casual",
    "shoes-white",
  ],
  [
    "Midnight boxy tee",
    "t-shirt",
    "black",
    "oversized",
    "Streetwear",
    "tee-black",
  ],
  [
    "Indigo straight jeans",
    "jeans",
    "blue",
    "straight",
    "Casual",
    "jeans-blue",
  ],
  [
    "Olive chore jacket",
    "jacket",
    "olive",
    "relaxed",
    "Vintage",
    "jacket-olive",
  ],
  [
    "Oxford blue shirt",
    "shirt",
    "blue",
    "regular",
    "Business casual",
    "shirt-blue",
  ],
  [
    "Oatmeal knit sweater",
    "sweater",
    "oatmeal",
    "relaxed",
    "Classic",
    "sweater-oat",
  ],
  [
    "Ink tailored trousers",
    "trousers",
    "black",
    "tailored",
    "Formal",
    "pants-black",
  ],
  ["Cocoa suede loafers", "shoes", "brown", "regular", "Formal", "shoes-brown"],
  ["Washed rose tee", "t-shirt", "rose", "relaxed", "Casual", "tee-rose"],
  [
    "Heather grey hoodie",
    "hoodie",
    "grey",
    "oversized",
    "Athletic",
    "hoodie-grey",
  ],
  ["Weekender shorts", "shorts", "beige", "relaxed", "Casual", "shorts-sand"],
  [
    "Canvas crossbody",
    "accessories",
    "black",
    "regular",
    "Streetwear",
    "bag-black",
  ],
  [
    "Terracotta overshirt",
    "jacket",
    "rust",
    "relaxed",
    "Vintage",
    "jacket-rust",
  ],
  [
    "Midnight linen shirt",
    "shirt",
    "navy",
    "regular",
    "Smart casual",
    "shirt-navy",
  ],
  [
    "Forest baseball cap",
    "accessories",
    "green",
    "regular",
    "Casual",
    "cap-green",
  ],
];
export const seedGarments: Garment[] = items.map(
  ([name, category, primaryColor, fit, style, asset], i) => ({
    id: `g${i + 1}`,
    ownerId: "demo",
    name,
    category,
    primaryColor,
    secondaryColors: [],
    pattern: "solid",
    fit,
    styleTags: [style],
    brand: ["Thread studio", "Everyday", "Common ground"][i % 3],
    size: i === 3 || i === 10 ? "10" : "M",
    image: { uri: asset, source: "bundled" },
    availability:
      i === 11 || i === 12
        ? "laundry"
        : i === 5
          ? "reusable"
          : i === 15
            ? "unknown"
            : "available",
    favorite: [0, 1, 2, 6].includes(i),
    visibility: "private",
    sharedWith: [],
    createdAt,
    updatedAt: createdAt,
  }),
);
export const seedOutfits: Outfit[] = [
  {
    id: "o1",
    ownerId: "demo",
    name: "A little everyday ease",
    occasionType: "Classes",
    items: [
      { garmentId: "g1", role: "top" },
      { garmentId: "g3", role: "bottom" },
      { garmentId: "g4", role: "shoes" },
      { garmentId: "g7", role: "outerwear" },
    ],
    explanation:
      "Soft neutrals meet an olive layer. Comfortable for class, considered enough for whatever comes after.",
    createdAt,
    plannedFor: dateOffset(-1),
    confirmedAt: null,
  },
  {
    id: "o2",
    ownerId: "demo",
    name: "After-hours, naturally",
    occasionType: "Dinner",
    items: [
      { garmentId: "g17", role: "top" },
      { garmentId: "g10", role: "bottom" },
      { garmentId: "g11", role: "shoes" },
    ],
    explanation: "A clean navy and charcoal palette, finished with warm suede.",
    createdAt,
    plannedFor: null,
    confirmedAt: null,
  },
  {
    id: "o3",
    ownerId: "demo",
    name: "Off-duty olive",
    occasionType: "Casual day",
    items: [
      { garmentId: "g2", role: "top" },
      { garmentId: "g6", role: "bottom" },
      { garmentId: "g4", role: "shoes" },
    ],
    explanation: "Easy layers and your most versatile denim.",
    createdAt,
    plannedFor: null,
    confirmedAt: null,
  },
];
export function emptyData(id: string, name: string): AppData {
  const profile = makeProfile(id, name);
  return {
    cart: [],
    outfitFeedback: [],
    profile,
    groups: [],
    looks: [],
    sharedGarments: [],
    directory: [
      { id, displayName: name, username: profile.username, photo: null },
    ],
    garments: [],
    essentials: [],
    outfits: [],
    wears: [],
    occasions: [],
    requests: [],
    friendships: [],
    watches: [],
    searches: [],
    notifications: [],
    skippedDates: [],
  };
}
export function seedData(): AppData {
  const data = emptyData("demo", "Rishi Nigam");
  data.directory.push(
    {
      id: "maya",
      displayName: "Maya Chen",
      username: "mayach",
      photo: demoAvatars.maya,
    },
    {
      id: "alex",
      displayName: "Alex Rivera",
      username: "alexr",
      photo: demoAvatars.alex,
    },
    {
      id: "jordan",
      displayName: "Jordan Lee",
      username: "jordanl",
      photo: demoAvatars.jordan,
    },
    {
      id: "sam",
      displayName: "Sam Taylor",
      username: "samt",
      photo: demoAvatars.sam,
    },
  );
  data.sharedGarments = [
    {
      ownerId: "maya",
      friendIds: ["demo"],
      piece: {
        id: "maya-jacket",
        name: "Maya’s olive chore jacket",
        category: "jacket",
        primaryColor: "olive",
        image: { uri: "jacket-olive", source: "bundled" },
      },
    },
  ];
  data.garments = seedGarments;
  data.outfits = seedOutfits;
  data.essentials = [
    { id: "e1", ownerId: "demo", name: "Everyday socks", total: 10, clean: 7 },
    { id: "e2", ownerId: "demo", name: "Gym shirts", total: 5, clean: 3 },
    { id: "e3", ownerId: "demo", name: "Sleep shirts", total: 4, clean: 4 },
  ];
  data.friendships = [
    { id: "demo_maya", members: ["demo", "maya"], createdAt },
    { id: "alex_demo", members: ["alex", "demo"], createdAt },
  ];
  data.requests = [
    {
      id: "demo_jordan",
      fromId: "jordan",
      toId: "demo",
      status: "pending",
      createdAt,
    },
  ];
  data.occasions = [
    {
      id: "oc1",
      ownerId: "demo",
      name: "Dinner, good company",
      date: dateOffset(2),
      time: "19:30",
      type: "Dinner",
      dressCode: "Smart casual",
      description:
        "A table for our favorite people. Earth tones encouraged, being yourself required.",
      participantIds: ["demo", "maya", "alex"],
      participants: [
        { userId: "demo", status: "accepted" },
        { userId: "maya", status: "accepted" },
        { userId: "alex", status: "invited" },
      ],
      theme: "Earth tones & easy layers",
      createdAt,
      submissions: [
        {
          id: "maya",
          ownerId: "maya",
          outfitName: "Maya’s olive moment",
          pieces: [
            {
              id: "m1",
              name: "Olive chore jacket",
              category: "jacket",
              primaryColor: "olive",
              image: { uri: "jacket-olive", source: "bundled" },
            },
            {
              id: "m2",
              name: "Cream cotton tee",
              category: "t-shirt",
              primaryColor: "cream",
              image: { uri: "tee-cream", source: "bundled" },
            },
            {
              id: "m3",
              name: "Straight indigo jeans",
              category: "jeans",
              primaryColor: "blue",
              image: { uri: "jeans-blue", source: "bundled" },
            },
          ],
          votes: ["alex"],
          comments: [
            {
              id: "c1",
              authorId: "alex",
              text: "The olive layer is the move 🌿",
              createdAt,
            },
          ],
        },
      ],
    },
    {
      id: "oc2",
      ownerId: "alex",
      name: "HackTX after hours",
      date: dateOffset(3),
      time: "20:00",
      type: "Party",
      dressCode: "Creative casual",
      description: "From shipping code to celebrating together.",
      participantIds: ["alex", "demo", "maya"],
      participants: [
        { userId: "alex", status: "accepted" },
        { userId: "demo", status: "invited" },
        { userId: "maya", status: "accepted" },
      ],
      theme: "One pop of color",
      createdAt,
      submissions: [],
    },
  ];
  data.watches = [
    {
      id: "w1",
      ownerId: "demo",
      productId: "p3",
      targetPrice: 40,
      history: [
        { date: dateOffset(-10), price: 65 },
        { date: dateOffset(-5), price: 54 },
        { date: dateOffset(0), price: 44 },
      ],
      createdAt,
    },
  ];
  data.notifications = [
    {
      id: "n1",
      ownerId: "demo",
      title: "Your people have plans",
      body: "Alex invited you to HackTX after hours.",
      kind: "occasions",
      read: false,
      createdAt,
    },
    {
      id: "n2",
      ownerId: "demo",
      title: "A little closer to your target",
      body: "Sample: sand trousers moved from $54 to $44. Demo history only.",
      kind: "prices",
      read: false,
      createdAt,
    },
    {
      id: "n3",
      ownerId: "demo",
      title: "A new style connection",
      body: "Jordan sent you a friend request.",
      kind: "social",
      read: false,
      createdAt,
    },
  ];
  data.groups = [
    {
      id: "weekend",
      ownerId: "demo",
      name: "Weekend Crew",
      memberIds: ["demo", "maya", "alex"],
      createdAt: isoNow(),
    },
  ];
  data.looks = [
    {
      id: "maya-dinner",
      ownerId: "maya",
      title: "Friday dinner fits",
      outfitId: null,
      groupId: "weekend",
      parentId: null,
      audienceIds: ["demo", "maya", "alex"],
      pieces: data.sharedGarments
        .filter((g) => g.ownerId === "maya")
        .map((g) => g.piece),
      createdAt: isoNow(),
      reactions: ["alex"],
      comments: [
        {
          id: "first-opinion",
          authorId: "alex",
          text: "The neutral palette works really well. What about your black pants?",
          createdAt: isoNow(),
        },
      ],
    },
  ].filter((l) => l.pieces.length > 0);
  return AppDataSchema.parse(data);
}
export const products: Product[] = [
  [
    "p1",
    "Relaxed organic cotton tee",
    "t-shirt",
    "cream",
    "Everyday",
    "tee-cream",
    18,
    28,
    "Common Ground",
  ],
  [
    "p2",
    "Soft-touch sage hoodie",
    "hoodie",
    "sage",
    "Fieldwork",
    "hoodie-sage",
    38,
    58,
    "Fieldwork",
  ],
  [
    "p3",
    "Sand pleated trousers",
    "trousers",
    "beige",
    "Form",
    "pants-sand",
    44,
    65,
    "Form Studio",
  ],
  [
    "p4",
    "Minimal leather sneakers",
    "shoes",
    "white",
    "Common",
    "shoes-white",
    59,
    89,
    "Common Ground",
  ],
  [
    "p5",
    "Boxy heavyweight tee",
    "t-shirt",
    "black",
    "Everyday",
    "tee-black",
    22,
    32,
    "Common Ground",
  ],
  [
    "p6",
    "Straight selvedge jeans",
    "jeans",
    "blue",
    "Fieldwork",
    "jeans-blue",
    48,
    80,
    "Fieldwork",
  ],
  [
    "p7",
    "Cotton utility jacket",
    "jacket",
    "olive",
    "Fieldwork",
    "jacket-olive",
    64,
    95,
    "Fieldwork",
  ],
  [
    "p8",
    "Oxford weekend shirt",
    "shirt",
    "blue",
    "Form",
    "shirt-blue",
    35,
    55,
    "Form Studio",
  ],
  [
    "p9",
    "Textured knit pullover",
    "sweater",
    "oatmeal",
    "Form",
    "sweater-oat",
    42,
    70,
    "Form Studio",
  ],
  [
    "p10",
    "Tailored everyday trousers",
    "trousers",
    "black",
    "Form",
    "pants-black",
    49,
    75,
    "Form Studio",
  ],
  [
    "p11",
    "Suede penny loafers",
    "shoes",
    "brown",
    "Common",
    "shoes-brown",
    68,
    98,
    "Common Ground",
  ],
  [
    "p12",
    "Canvas everyday bag",
    "accessories",
    "black",
    "Everyday",
    "bag-black",
    24,
    null,
    "Common Ground",
  ],
].map((row) => {
  const [
    id,
    name,
    category,
    color,
    brand,
    image,
    price,
    originalPrice,
    retailer,
  ] = row;
  return {
    id,
    name,
    category,
    color,
    brand,
    image,
    sizes: ["XS", "S", "M", "L", "XL", "10"],
    offer: {
      retailer:
        retailer === "Form Studio"
          ? "Mango"
          : retailer === "Fieldwork"
            ? "UNIQLO"
            : "H&M",
      price,
      originalPrice,
      currency: "USD",
      url:
        retailer === "Form Studio"
          ? "https://shop.mango.com/us/en/"
          : retailer === "Fieldwork"
            ? "https://www.uniqlo.com/us/en/"
            : "https://www2.hm.com/en_us/index.html",
      shipping: id === "p12" ? null : "Sample: $5 standard shipping",
      condition: "New (sample)",
    },
    similarity: 0.88,
    matchType: "similar",
    compatibility: 85,
    sample: true,
  } as Product;
});

// Original, explicitly fictional demo catalog. Stable variants remain distinct even
// when their sample retailer link points to the same homepage.
for (const [index, garment] of seedGarments.entries()) {
  for (const [cut, descriptor] of [
    "Everyday",
    "Relaxed",
    "Weekend",
    "Studio",
    "Essential",
    "Modern",
  ].entries()) {
    const price = 16 + ((index * 7 + cut * 5) % 83);
    products.push({
      id: `sample-${garment.id}-${cut}`,
      name: `${descriptor} ${garment.primaryColor} ${garment.category.replace("t-shirt", "cotton tee")} · ${cut + 1}`,
      category: garment.category,
      color: garment.primaryColor,
      brand: "Thread sample collection",
      sizes: ["XS", "S", "M", "L", "XL", "10"],
      image: garment.image?.uri || null,
      offer: {
        retailer: ["H&M", "UNIQLO", "Mango"][index % 3],
        price,
        originalPrice: cut === 5 ? null : price + 10 + cut * 3,
        currency: "USD",
        url: [
          "https://www2.hm.com/en_us/index.html",
          "https://www.uniqlo.com/us/en/",
          "https://shop.mango.com/us/en/",
        ][index % 3],
        shipping: "Sample shipping information",
        condition: "New (sample)",
      },
      similarity: null,
      matchType: "similar",
      compatibility: null,
      sample: true,
    });
  }
}
