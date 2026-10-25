import type { AppData, Category, Garment } from "../../models";
export const defaultWearLimit: Record<Category, number | null> = {
  "t-shirt": 1,
  shirt: 1,
  "tank-top": 1,
  "other-top": 1,
  "other-bottom": 2,
  trousers: 2,
  shorts: 2,
  jeans: 3,
  hoodie: 3,
  sweater: 3,
  jacket: null,
  shoes: null,
  accessories: null,
};
/** Upgrade legacy records without changing availability or deleting historical events. */
export function migrateWearCounters(data: AppData): AppData {
  return {
    ...data,
    garments: data.garments.map((g) => {
      const history = data.wears
        .filter((w) => w.garmentIds.includes(g.id))
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        ...g,
        wearCount: g.wearCount ?? history.length,
        maxWearsBeforeLaundry:
          g.maxWearsBeforeLaundry === undefined
            ? defaultWearLimit[g.category]
            : g.maxWearsBeforeLaundry,
        lastWornAt: g.lastWornAt ?? history.at(-1)?.date ?? null,
        lastCleanedAt: g.lastCleanedAt ?? null,
        manuallyOverridden: g.manuallyOverridden ?? false,
      };
    }),
  };
}
export function wearSummary(g: Garment) {
  const count = g.wearCount ?? 0,
    limit =
      g.maxWearsBeforeLaundry === undefined
        ? defaultWearLimit[g.category]
        : g.maxWearsBeforeLaundry;
  return limit === null
    ? `${count} wears · laundry managed by you`
    : `${count}/${limit} wears since clean${count >= limit ? " · laundry suggested" : ""}`;
}
