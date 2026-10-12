import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickOutfit, type PickItem } from "../lib/outfit-picker";
import { harmonyScore, type StyleContext } from "../lib/outfit-style";
import { settingsPatchSchema } from "../lib/validation";

function item(partial: Partial<PickItem> & Pick<PickItem, "id" | "name" | "slot" | "category">): PickItem {
  return {
    colors: ["black"],
    warmth: 3,
    tags: ["casual"],
    inLaundry: false,
    lastWorn: null,
    fit: "straight",
    ...partial,
  };
}

const light: StyleContext = { complexion: "light", occasion: "casual", streetwear: false, age: null };
const deep: StyleContext = { complexion: "deep", occasion: "casual", streetwear: false, age: null };

describe("outfit style", () => {
  const date = "2026-10-10";

  it("lifts a monochrome black outfit with a cream cap", () => {
    const picked = pickOutfit({
      date,
      tempF: 75,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Black tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "pants", name: "Black pants", slot: "bottom", category: "Pants" }),
        item({ id: "cream", name: "Cream cap", slot: "hat", category: "Caps / Hats", warmth: 2, colors: ["cream"] }),
        item({ id: "orange", name: "Orange cap", slot: "hat", category: "Caps / Hats", warmth: 2, colors: ["orange"] }),
      ],
    });
    assert.equal(picked.slots.hat, "cream");
    assert.match(picked.reason, /Monochrome black with a cream cap to lift the look\./);
  });

  it("matches a cap to the top ahead of a cream lift", () => {
    const picked = pickOutfit({
      date,
      tempF: 75,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Black tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "pants", name: "Black pants", slot: "bottom", category: "Pants" }),
        item({ id: "black-cap", name: "Black cap", slot: "hat", category: "Caps / Hats", warmth: 2, colors: ["black"] }),
        item({ id: "cream", name: "Cream cap", slot: "hat", category: "Caps / Hats", warmth: 2, colors: ["cream"] }),
      ],
    });
    assert.equal(picked.slots.hat, "black-cap");
    assert.match(picked.reason, /Monochrome black\./);
  });

  it("prefers shade variation, white sneakers, and a navy-cream pair", () => {
    const shaded = pickOutfit({
      date,
      tempF: 60,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Black tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "flat", name: "Black pants", slot: "bottom", category: "Pants" }),
        item({ id: "charcoal", name: "Charcoal pants", slot: "bottom", category: "Pants", colors: ["charcoal"] }),
      ],
    });
    assert.equal(shaded.slots.bottom, "charcoal");
    assert.match(shaded.reason, /Monochrome black, with shade variation\./);

    const shoes = pickOutfit({
      date,
      tempF: 60,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Black tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "pants", name: "Black pants", slot: "bottom", category: "Pants" }),
        item({ id: "brown", name: "Brown shoes", slot: "shoes", category: "Shoes", colors: ["brown"] }),
        item({ id: "white", name: "White sneakers", slot: "shoes", category: "Shoes", colors: ["white"] }),
      ],
    });
    assert.equal(shoes.slots.shoes, "white");
    assert.match(shoes.reason, /white sneakers to lift the look/);

    const paired = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Navy tee", slot: "top", category: "Shirts/T-shirts", colors: ["navy"] }),
        item({ id: "cream", name: "Cream pants", slot: "bottom", category: "Pants", colors: ["cream"] }),
        item({ id: "orange", name: "Orange pants", slot: "bottom", category: "Pants", colors: ["orange"] }),
      ],
    });
    assert.equal(paired.slots.bottom, "cream");
    assert.match(paired.reason, /Navy and cream\./);
  });

  it("drops a second loud color and a brown shoe on black", () => {
    const loud = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Red tee", slot: "top", category: "Shirts/T-shirts", colors: ["red"] }),
        item({ id: "green", name: "Green pants", slot: "bottom", category: "Pants", colors: ["green"] }),
        item({ id: "navy", name: "Navy pants", slot: "bottom", category: "Pants", colors: ["navy"] }),
      ],
    });
    assert.equal(loud.slots.bottom, "navy");
    assert.match(loud.reason, /one red accent/);

    const clash = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Black tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "pants", name: "Black pants", slot: "bottom", category: "Pants" }),
        item({ id: "brown", name: "Brown shoes", slot: "shoes", category: "Shoes", colors: ["brown"] }),
        item({ id: "black", name: "Black shoes", slot: "shoes", category: "Shoes", colors: ["black"] }),
      ],
    });
    assert.equal(clash.slots.shoes, "black");
  });

  it("balances an oversized top and allows baggy proportions for streetwear", () => {
    const neat = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "tee", name: "Navy tee", slot: "top", category: "Shirts/T-shirts", colors: ["navy"], fit: "oversized" }),
        item({ id: "straight", name: "Gray chinos", slot: "bottom", category: "Pants", colors: ["gray"], fit: "straight" }),
        item({ id: "relaxed", name: "Gray sweats", slot: "bottom", category: "Pants", colors: ["gray"], fit: "relaxed" }),
      ],
    });
    assert.equal(neat.slots.bottom, "straight");
    assert.match(neat.reason, /Oversized top balanced with straight pants\./);

    const street = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      prompt: "streetwear",
      items: [
        item({ id: "tee", name: "Black tee", slot: "top", category: "Shirts/T-shirts", fit: "oversized" }),
        item({ id: "straight", name: "Black chinos", slot: "bottom", category: "Pants", fit: "straight" }),
        item({ id: "relaxed", name: "Black sweats", slot: "bottom", category: "Pants", fit: "relaxed" }),
      ],
    });
    assert.equal(street.slots.bottom, "relaxed");
    assert.match(street.reason, /streetwear ask/);
  });

  it("boosts contrast for a deeper skin tone and keeps a beige top for a light one", () => {
    const closet = [
      item({ id: "beige", name: "Beige tee", slot: "top", category: "Shirts/T-shirts", colors: ["beige"] }),
      item({ id: "white", name: "White tee", slot: "top", category: "Shirts/T-shirts", colors: ["white"] }),
      item({ id: "pants", name: "Olive pants", slot: "bottom", category: "Pants", colors: ["olive"] }),
    ];
    const richer = pickOutfit({ date, tempF: 70, occasion: "casual", profile: { skinTone: "deep", age: 19 }, items: closet });
    assert.equal(richer.slots.top, "white");
    const pale = harmonyScore(
      [item({ id: "beige", name: "Beige tee", slot: "top", category: "Shirts/T-shirts", colors: ["beige"] })],
      light,
    );
    const muddy = harmonyScore(
      [item({ id: "beige", name: "Beige tee", slot: "top", category: "Shirts/T-shirts", colors: ["beige"] })],
      deep,
    );
    assert.ok(muddy < pale);

    const young = harmonyScore(
      [
        item({ id: "tee", name: "Navy tee", slot: "top", category: "Shirts/T-shirts", colors: ["navy"], fit: "oversized" }),
        item({ id: "pants", name: "Chinos", slot: "bottom", category: "Pants", colors: ["khaki"], fit: "straight" }),
      ],
      { ...light, age: 19 },
    );
    const older = harmonyScore(
      [
        item({ id: "tee", name: "Navy tee", slot: "top", category: "Shirts/T-shirts", colors: ["navy"], fit: "oversized" }),
        item({ id: "pants", name: "Chinos", slot: "bottom", category: "Pants", colors: ["khaki"], fit: "straight" }),
      ],
      { ...light, age: 40 },
    );
    assert.ok(young > older);
  });

  it("accepts a saved age and skin tone without requiring either", () => {
    const parsed = settingsPatchSchema.parse({ skinTone: "brown", age: 30 });
    assert.equal(parsed.skinTone, "brown");
    assert.equal(parsed.age, 30);
    settingsPatchSchema.parse({ age: null });
    assert.throws(() => settingsPatchSchema.parse({ age: 12 }));
    assert.throws(() => settingsPatchSchema.parse({ age: 101 }));
  });
});
