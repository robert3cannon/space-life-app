export const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", base: "#f4d3c2", shadow: "#e2b49e", deep: "#c48976", blush: "#e7a394" },
  { id: "fair", label: "Fair", base: "#efc2a6", shadow: "#d59a80", deep: "#b47860", blush: "#e09078" },
  { id: "olive", label: "Olive", base: "#c9a27a", shadow: "#a88460", deep: "#866446", blush: "#c48b6c" },
  { id: "tan", label: "Tan", base: "#b07d4e", shadow: "#8f6338", deep: "#6c4a28", blush: "#c48a62" },
  { id: "brown", label: "Brown", base: "#7d4e32", shadow: "#623c26", deep: "#452818", blush: "#8d5a40" },
  { id: "deep", label: "Deep", base: "#4a2c22", shadow: "#351f18", deep: "#24140f", blush: "#5c3a2c" },
] as const;

export type SkinToneId = (typeof SKIN_TONES)[number]["id"];

export function skinToneById(id: string | null | undefined) {
  return SKIN_TONES.find((tone) => tone.id === id) ?? SKIN_TONES[1];
}
