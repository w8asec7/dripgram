import { Garment, categoryLabel, categoryGroup } from "../models";
export function filterGarments(
  garments: Garment[],
  filters: {
    search?: string;
    category?: string;
    availability?: string;
    color?: string;
    style?: string;
    favorites?: boolean;
  },
) {
  return garments.filter(
    (g) =>
      (!filters.search ||
        g.name.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.category ||
        filters.category === "All" ||
        categoryGroup(g.category) === filters.category ||
        g.category === filters.category ||
        categoryLabel(g.category) === filters.category) &&
      (!filters.availability ||
        filters.availability === "Any availability" ||
        g.availability === filters.availability) &&
      (!filters.color ||
        filters.color === "Any color" ||
        g.primaryColor === filters.color) &&
      (!filters.style ||
        filters.style === "Any style" ||
        g.styleTags.includes(filters.style)) &&
      (!filters.favorites || g.favorite),
  );
}
