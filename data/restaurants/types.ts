export type RestaurantServing = {
  label: string;
  ounces: number | null;
  grams: number | null;
  calories: number;
  fatG: number;
  carbsG: number;
  proteinG: number;
};

export type NutritionSource = "official" | "third-party";

export type RestaurantItem = {
  id: string;
  name: string;
  aliases?: string[];
  servings: RestaurantServing[];
  /** Official chain table, or a third-party listing used when that table was unavailable. */
  sourceType: NutritionSource;
};

export type RestaurantChain = {
  id: string;
  name: string;
  sourceUrl: string;
  verifiedOn: string;
  sourceType: NutritionSource;
  chainTokens: string[];
  orderNote?: string;
  items: RestaurantItem[];
};
