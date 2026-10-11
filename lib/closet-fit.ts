export const FITS = ["slim", "straight", "relaxed", "oversized", "cropped", "hip-length"] as const;
export type Fit = (typeof FITS)[number];

export const OWNERSHIP = ["owned", "borrowed"] as const;
export type Ownership = (typeof OWNERSHIP)[number];

/** Guess a silhouette from the name. Straight is the fallback when the words are quiet. */
export function suggestFit(name: string, category = ""): Fit {
  const text = `${name} ${category}`.toLowerCase();
  if (text.includes("hip-length") || text.includes("hip length") || text.includes("longline")) return "hip-length";
  if (/\bcrop/.test(text)) return "cropped";
  if (text.includes("oversized") || text.includes("oversize") || text.includes("baggy")) return "oversized";
  if (text.includes("relaxed") || text.includes("loose")) return "relaxed";
  if (text.includes("slim") || text.includes("skinny")) return "slim";
  return "straight";
}

export function isFit(value: string): value is Fit {
  return (FITS as readonly string[]).includes(value);
}
