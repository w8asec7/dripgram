import type { Garment } from "../src/models";
export function occasionDirection(occasion: string) {
  if (/Interview|Networking|Formal|Wedding|Work/.test(occasion))
    return "Tailored and polished: collared shirt, refined trousers, conservative palette. Avoid lounge or athletic pieces.";
  if (occasion === "Classes")
    return "Comfort for a day on campus: relaxed hoodie or tee, practical denim or relaxed pants, light layers when cool.";
  if (occasion === "Dinner")
    return "Elevated smart casual: favor a collared shirt or fine knit with tailored trousers and considered color contrast.";
  if (occasion === "Date")
    return "Intentional but comfortable: favor a flattering shirt or knit, softer colors and clean trousers; avoid a gym look.";
  if (occasion === "Party")
    return "Expressive evening styling: favor bold color, interesting textures, black or statement tops, confident contrast and relaxed evening bottoms.";
  if (/Outdoor/.test(occasion))
    return "Practical breathable clothing and weather-appropriate layers.";
  return "Easy everyday casual: a comfortable tee and denim or relaxed trousers; keep layers light.";
}
export function occasionScore(g: Garment, occasion: string) {
  const tags = g.styleTags.join(" ").toLowerCase();
  const rank = (list: string[]) => {
    const i = list.indexOf(g.category);
    return i < 0 ? 0 : (list.length - i) * 3;
  };
  if (/Interview|Networking|Formal|Wedding|Work/.test(occasion))
    return (
      rank(["shirt", "trousers", "sweater"]) +
      (/formal|business|classic/.test(tags) ? 10 : 0)
    );
  if (occasion === "Classes")
    return (
      (g.category === "hoodie" ? 8 : 0) +
      rank(["hoodie", "t-shirt", "jeans", "shorts", "trousers"]) +
      (/casual|athletic|streetwear/.test(tags) ? 4 : 0)
    );
  if (occasion === "Dinner")
    return (
      rank(["shirt", "sweater", "trousers", "jeans"]) +
      (/smart casual|classic|business/.test(tags) ? 8 : 0)
    );
  if (occasion === "Date")
    return (
      rank(["sweater", "shirt", "trousers", "jeans", "t-shirt"]) +
      (/rose|cream|oatmeal|blue/.test(g.primaryColor) ? 4 : 0)
    );
  if (occasion === "Party")
    return (
      rank(["t-shirt", "shirt", "jeans", "trousers"]) +
      (/streetwear|vintage/.test(tags) ? 9 : 0) +
      (/black|rose|rust/.test(g.primaryColor) ? 5 : 0)
    );
  return (
    rank(["t-shirt", "jeans", "shorts", "hoodie", "trousers"]) +
    (/casual/.test(tags) ? 4 : 0)
  );
}
