"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { ClosetCategoryDto, ClosetItemDto, ClosetSlotName, OutfitDto, OutfitSlotName } from "@/lib/types";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

const TAGS = ["casual", "gym", "dressy", "class", "work"] as const;
const SLOT_LABEL: Record<OutfitSlotName, string> = {
  top: "Top",
  bottom: "Bottom",
  layer: "Layer",
  shoes: "Shoes",
};
const CATEGORY_SLOTS: { id: ClosetSlotName; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "layer", label: "Layer" },
  { id: "shoes", label: "Shoes" },
  { id: "extra", label: "Accessories" },
];

type ClosetPayload = { count: number; items: ClosetItemDto[]; categories: ClosetCategoryDto[] };
type OutfitPayload = { outfit: OutfitDto | null };

type Draft = {
  id: string;
  name: string;
  categoryId: string;
  colors: string;
  warmth: number;
  tags: string[];
  inLaundry: boolean;
};

function blobOf(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressClothingPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Couldn't read that photo");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const webp = await blobOf(canvas, "image/webp", 0.72);
  const blob = webp && webp.type === "image/webp" ? webp : await blobOf(canvas, "image/jpeg", 0.72);
  if (!blob) throw new Error("Couldn't compress that photo");
  const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
  const base = file.name.replace(/\.[a-z0-9]+$/i, "").trim() || "photo";
  return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type });
}

function weatherLine(outfit: OutfitDto) {
  if (!outfit.weather) return "East Lansing";
  if (!outfit.weather.live) return "Weather didn't load · East Lansing";
  return `${outfit.weather.tempF}°F ${outfit.weather.label} · East Lansing`;
}

function OutfitPhotos({ outfit, compact = false }: { outfit: OutfitDto; compact?: boolean }) {
  const slots: OutfitSlotName[] = ["top", "bottom", "layer", "shoes"];
  const shown = slots.flatMap((slot) => {
    const item = outfit.items.find((row) => row.slot === slot);
    return item ? [item] : [];
  });
  if (!shown.length) return <p className="muted">Nothing picked yet.</p>;
  return (
    <div className={compact ? "today-outfit-row" : "outfit-row"}>
      {shown.map((item) => (
        <figure key={item.slot} className="outfit-slot">
          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <span className="outfit-fallback" aria-hidden />}
          <figcaption>{compact ? SLOT_LABEL[item.slot] : item.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function TodayOutfitPeek() {
  const { data, error } = useLoad<OutfitPayload>("/api/outfits");
  if (error || !data) return null;
  return (
    <>
      <div className="section-title">
        <h2>Outfit</h2>
        <Link href="/outfits">Closet</Link>
      </div>
      {data.outfit ? (
        <Link href="/outfits" className="card today-outfit-link" data-testid="today-outfit-peek">
          <p className="kicker">{weatherLine(data.outfit)}</p>
          <OutfitPhotos outfit={data.outfit} compact />
          <p className="muted today-outfit-reason">{data.outfit.reason}</p>
        </Link>
      ) : (
        <Link href="/outfits" className="card link-card">
          <strong>Add clothes</strong>
          <span className="muted">Photos in the closet become today’s outfit.</span>
        </Link>
      )}
    </>
  );
}

export function ClosetView() {
  const closet = useLoad<ClosetPayload>("/api/closet/items");
  const outfit = useLoad<OutfitPayload>("/api/outfits");
  const toast = useToast();
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", slot: "top" as ClosetSlotName });

  const closeEditor = useCallback(() => setDraft(null), []);
  const closeCats = useCallback(() => setCatsOpen(false), []);

  async function reloadAll() {
    await Promise.all([closet.reload(), outfit.reload()]);
  }

  function openItem(item: ClosetItemDto) {
    setDraft({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      colors: item.colors.join(", "),
      warmth: item.warmth,
      tags: item.tags.filter((tag): tag is (typeof TAGS)[number] => (TAGS as readonly string[]).includes(tag)),
      inLaundry: item.inLaundry,
    });
  }

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    let added = 0;
    let first: ClosetItemDto | null = null;
    try {
      for (const original of Array.from(list)) {
        let file = original;
        try {
          file = await compressClothingPhoto(original);
        } catch {
          toast("Couldn't read one of those photos");
          continue;
        }
        const body = new FormData();
        body.set("file", file);
        body.set("name", file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim());
        if (filter !== "all") body.set("categoryId", filter);
        body.set("tags", "casual");
        body.set("warmth", "3");
        const item = await api<ClosetItemDto>("/api/closet/items", { method: "POST", body });
        added += 1;
        first ??= item;
      }
      await reloadAll();
      if (first) openItem(first);
      if (added) toast(added === 1 ? "Added to the closet" : `Added ${added} pieces`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add that photo");
    } finally {
      setBusy(false);
      if (libraryRef.current) libraryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await api(`/api/closet/items/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          colors: draft.colors.split(",").map((part) => part.trim()).filter(Boolean),
          warmth: draft.warmth,
          tags: draft.tags,
          inLaundry: draft.inLaundry,
        }),
      });
      setDraft(null);
      toast("Saved");
      await reloadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem() {
    if (!draft) return;
    setBusy(true);
    try {
      await api(`/api/closet/items/${draft.id}`, { method: "DELETE" });
      setDraft(null);
      toast("Removed");
      await reloadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't remove it");
    } finally {
      setBusy(false);
    }
  }

  async function woreIt() {
    setBusy(true);
    try {
      await api("/api/outfits/wore", { method: "POST" });
      toast("Logged. Those pieces sit out for a few days.");
      await outfit.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't log it");
    } finally {
      setBusy(false);
    }
  }

  async function newOutfit() {
    setBusy(true);
    try {
      await api("/api/outfits/new", { method: "POST" });
      setSwapOpen(false);
      toast("New outfit");
      await outfit.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't pick another");
    } finally {
      setBusy(false);
    }
  }

  async function swap(slot: OutfitSlotName) {
    setBusy(true);
    try {
      await api("/api/outfits/swap", { method: "POST", body: JSON.stringify({ slot }) });
      setSwapOpen(false);
      toast(`Swapped the ${SLOT_LABEL[slot].toLowerCase()}`);
      await outfit.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't swap that");
    } finally {
      setBusy(false);
    }
  }

  async function renameCategory(category: ClosetCategoryDto, name: string) {
    const next = name.trim();
    if (!next || next === category.name) return;
    try {
      await api(`/api/closet/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ name: next }) });
      await closet.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't rename that");
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!newCat.name.trim()) return;
    try {
      await api("/api/closet/categories", { method: "POST", body: JSON.stringify(newCat) });
      setNewCat({ name: "", slot: "top" });
      await closet.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add that");
    }
  }

  const items = closet.data?.items ?? [];
  const categories = closet.data?.categories ?? [];
  const visible = filter === "all" ? items : items.filter((item) => item.categoryId === filter);
  const pick = outfit.data?.outfit ?? null;

  return (
    <main className="page">
      <PageTitle title="Closet" />
      <p className="kicker">Orbit</p>
      <h1 className="display">Closet</h1>
      <p className="sub">Today’s outfit, from the clothes you actually own.</p>

      <section className="card hero closet-outfit" data-testid="today-outfit">
        <p className="kicker">{pick ? weatherLine(pick) : "East Lansing"}</p>
        <h2>Today’s outfit</h2>
        {pick ? (
          <>
            <OutfitPhotos outfit={pick} />
            <p>{pick.reason}</p>
            <p className="faint">{pick.source === "bot" ? "Picked by Outfit Selector." : "Picked in Orbit."}{pick.wornAt ? " Logged as worn." : ""}</p>
            <div className="stack closet-actions">
              <button className="btn" type="button" data-testid="wore-it" disabled={busy} onClick={() => void woreIt()}>Wore it</button>
              <button className="btn-ghost" type="button" data-testid="swap-item" disabled={busy} onClick={() => setSwapOpen((open) => !open)}>Swap item</button>
              {swapOpen ? (
                <div className="chips" role="group" aria-label="Swap a piece">
                  {(Object.keys(SLOT_LABEL) as OutfitSlotName[]).map((slot) => (
                    <button key={slot} className="chip" type="button" disabled={busy} onClick={() => void swap(slot)}>{SLOT_LABEL[slot]}</button>
                  ))}
                </div>
              ) : null}
              <button className="btn-ghost" type="button" data-testid="new-outfit" disabled={busy} onClick={() => void newOutfit()}>New outfit</button>
            </div>
          </>
        ) : (
          <p>Add a top and a bottom. Orbit will pick from the weather in East Lansing, even if the bot is offline.</p>
        )}
      </section>

      <div className="closet-upload">
        <button className="btn" type="button" disabled={busy} onClick={() => cameraRef.current?.click()}>Camera</button>
        <button className="btn-ghost" type="button" data-testid="closet-upload" disabled={busy} onClick={() => libraryRef.current?.click()}>Library</button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => void upload(event.target.files)} />
        <input ref={libraryRef} type="file" accept="image/*" multiple hidden onChange={(event) => void upload(event.target.files)} />
      </div>

      <div className="chips closet-filters" role="tablist" aria-label="Categories">
        <button className={`chip ${filter === "all" ? "on" : ""}`} type="button" onClick={() => setFilter("all")}>All</button>
        {categories.map((category) => (
          <button key={category.id} className={`chip ${filter === category.id ? "on" : ""}`} type="button" onClick={() => setFilter(category.id)}>
            {category.name}
          </button>
        ))}
        <button className="chip" type="button" onClick={() => setCatsOpen(true)}>Edit list</button>
      </div>

      {closet.loading && !closet.data ? <Loading rows={2} /> : null}
      {closet.error ? <ErrorNote message={closet.error} onRetry={closet.reload} /> : null}

      <div className="closet-grid" data-testid="closet-grid">
        {closet.data && visible.length === 0 ? <p className="muted closet-empty">No clothes in this category yet.</p> : null}
        {visible.map((item) => (
          <button key={item.id} className="closet-tile" type="button" data-testid="closet-item" onClick={() => openItem(item)}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="outfit-fallback" />}
            <span className="closet-tile-copy">
              <strong>{item.name}</strong>
              <span>{item.inLaundry ? "In laundry" : item.category}</span>
            </span>
          </button>
        ))}
      </div>

      <Sheet open={Boolean(draft)} title="Edit piece" onClose={closeEditor}>
        {draft ? (
          <form data-testid="closet-editor" onSubmit={(event) => void saveDraft(event)}>
            <label className="field">
              <span>Name</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={80} />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Colors</span>
              <input value={draft.colors} placeholder="navy, white" onChange={(event) => setDraft({ ...draft, colors: event.target.value })} />
            </label>
            <label className="field">
              <span>Warmth, {draft.warmth}</span>
              <input type="range" min={1} max={5} step={1} value={draft.warmth} onChange={(event) => setDraft({ ...draft, warmth: Number(event.target.value) })} />
            </label>
            <p className="faint">Occasion</p>
            <div className="tag-wrap">
              {TAGS.map((tag) => {
                const on = draft.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    className={`chip ${on ? "on" : ""}`}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft({ ...draft, tags: on ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag] })}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <label className="field">
              <span>Laundry</span>
              <select value={draft.inLaundry ? "yes" : "no"} onChange={(event) => setDraft({ ...draft, inLaundry: event.target.value === "yes" })}>
                <option value="no">Ready to wear</option>
                <option value="yes">In laundry</option>
              </select>
            </label>
            <button className="btn" type="submit" disabled={busy}>Save</button>
            <button className="btn-danger" type="button" disabled={busy} style={{ marginTop: 8 }} onClick={() => void removeItem()}>Delete</button>
          </form>
        ) : null}
      </Sheet>

      <Sheet open={catsOpen} title="Categories" onClose={closeCats}>
        <div className="stack">
          {categories.map((category) => (
            <label key={category.id} className="field">
              <span>{CATEGORY_SLOTS.find((slot) => slot.id === category.slot)?.label ?? category.slot}</span>
              <input defaultValue={category.name} maxLength={40} onBlur={(event) => void renameCategory(category, event.target.value)} />
            </label>
          ))}
        </div>
        <form onSubmit={(event) => void addCategory(event)} style={{ marginTop: 12 }}>
          <label className="field">
            <span>New category</span>
            <input value={newCat.name} maxLength={40} onChange={(event) => setNewCat({ ...newCat, name: event.target.value })} />
          </label>
          <label className="field">
            <span>Goes with</span>
            <select value={newCat.slot} onChange={(event) => setNewCat({ ...newCat, slot: event.target.value as ClosetSlotName })}>
              {CATEGORY_SLOTS.map((slot) => (
                <option key={slot.id} value={slot.id}>{slot.label}</option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">Add category</button>
        </form>
      </Sheet>
    </main>
  );
}
