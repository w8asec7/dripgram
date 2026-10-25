import { useApp } from "../../state/AppProvider";
import { cloudImages } from "../../services/api";
export function useWardrobeActions() {
  const { data, user, execute } = useApp();
  return {
    async deleteGarments(ids: string[]) {
      if (!data || !user) throw new Error("Sign in first.");
      const selected = [...new Set(ids)].map((id) => {
        const g = data.garments.find(
          (g) => g.id === id && g.ownerId === user.id,
        );
        if (!g)
          throw new Error("This piece is unavailable. Refresh your closet.");
        return g;
      });
      for (const g of selected)
        if (
          user.mode === "firebase" &&
          g.image?.storagePath &&
          g.image.syncStatus === "synced"
        )
          await cloudImages.remove(g.id);
      await execute(
        { type: "garment.deleteMany", ids: selected.map((g) => g.id) },
        `${selected.length} garment${selected.length === 1 ? "" : "s"} deleted.`,
      );
    },
    async washed() {
      await execute(
        { type: "wardrobe.washed" },
        "Washed. All clothes are available, wear counts reset, and essentials are clean.",
      );
    },
  };
}
