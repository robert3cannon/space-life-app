export type RestaurantServing = {
  label: string;
  ounces: number | null;
  grams: number | null;
  calories: number;
  fatG: number;
  carbsG: number;
  proteinG: number;
};

export type RestaurantItem = {
  id: string;
  name: string;
  aliases?: string[];
  servings: RestaurantServing[];
};

export type RestaurantChain = {
  id: string;
  name: string;
  sourceUrl: string;
  verifiedOn: string;
  chainTokens: string[];
  orderNote?: string;
  items: RestaurantItem[];
};
