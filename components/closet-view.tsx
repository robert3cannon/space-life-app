"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { classifyPhoto, classifyPresentation, colorsInPhoto, scoreClosetPrompt } from "./clothing-detect";
import { cutOutClothing } from "./clothing-cutout";
import { compressClothingPhoto, turnPhotoFile } from "./photo-file";
import { OutfitModel } from "./outfit-model";
import { api } from "@/lib/client";
import type { PhotoTurn } from "@/lib/image-orient";
import { detectionFromScores, matchCategory, wornByPerson, type LabelScore } from "@/lib/closet-detect";
import { OUTFIT_SLOTS } from "@/lib/outfit-picker";
import { VIBE_CHIPS } from "@/lib/outfit-prompt";
import { todayDateString } from "@/lib/time";
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
  hat: "Hat",
};
const CATEGORY_SLOTS: { id: ClosetSlotName; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "layer", label: "Layer" },
  { id: "shoes", label: "Shoes" },
  { id: "hat", label: "Hat" },
  { id: "extra", label: "Accessories" },
];

type ClosetPayload = { count: number; items: ClosetItemDto[]; categories: ClosetCategoryDto[] };
type OutfitPayload = { outfit: OutfitDto | null };

type Draft = {
  id: string;
  local?: boolean;
  previewUrl: string | null;
  name: string;
  categoryId: string;
  colors: string;
  warmth: number;
  tags: string[];
  inLaundry: boolean;
};

type PendingPiece = {
  id: string;
  file: File;
  previewUrl: string;
  cutout?: File | null;
  cutoutPreviewUrl?: string;
  status: "detecting" | "cutting" | "ready";
  name: string;
  categoryId: string;
  categoryName: string;
  colors: string[];
  warmth: number;
  tags: string[];
  inLaundry: boolean;
  lowConfidence: boolean;
  worn: boolean;
};

function weatherLine(outfit: OutfitDto) {
  if (!outfit.weather) return "East Lansing";
  if (!outfit.weather.live) return "Weather didn't load · East Lansing";
  return `${outfit.weather.tempF}°F ${outfit.weather.label} · East Lansing`;
}

function OutfitPhotos({ outfit, compact = false }: { outfit: OutfitDto; compact?: boolean }) {
  const slots: OutfitSlotName[] = [...OUTFIT_SLOTS];
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
          <OutfitModel outfit={data.outfit} compact />
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
  const [pending, setPending] = useState<PendingPiece[]>([]);
  const [outfitView, setOutfitView] = useState<"model" | "pieces">("model");
  const [vibe, setVibe] = useState("");
  const [newCat, setNewCat] = useState({ name: "", slot: "top" as ClosetSlotName });
  const savedPrompt = outfit.data?.outfit?.prompt ?? "";

  useEffect(() => {
    setVibe(savedPrompt);
  }, [savedPrompt]);

  const closeEditor = useCallback(() => setDraft(null), []);
  const closeCats = useCallback(() => setCatsOpen(false), []);

  async function reloadAll() {
    await Promise.all([closet.reload(), outfit.reload()]);
  }

  function openItem(item: ClosetItemDto) {
    setDraft({
      id: item.id,
      previewUrl: item.imageUrl,
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
    const prepared: PendingPiece[] = [];
    for (const original of Array.from(list)) {
      try {
        const file = await compressClothingPhoto(original);
        prepared.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: "detecting",
          name: "Detecting...",
          categoryId: "",
          categoryName: "",
          colors: [],
          warmth: 3,
          tags: ["casual"],
          inLaundry: false,
          lowConfidence: false,
          worn: false,
        });
      } catch {
        toast("Couldn't read one of those photos");
      }
    }
    if (libraryRef.current) libraryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    if (!prepared.length) return;
    setPending((current) => [...current, ...prepared]);
    let categories = closet.data?.categories ?? [];
    if (!categories.length) {
      try {
        categories = (await api<ClosetPayload>("/api/closet/items")).categories;
      } catch {
        categories = [];
      }
    }
    for (const piece of prepared) {
      let scores: LabelScore[] | null = null;
      let worn = false;
      try {
        scores = await classifyPhoto(piece.file);
        try {
          worn = wornByPerson(await classifyPresentation(piece.file));
        } catch {
          worn = false;
        }
      } catch {
        scores = null;
      }
      setPending((rows) => rows.map((row) => (row.id === piece.id ? { ...row, status: "cutting", worn } : row)));
      const cutout = await cutOutClothing(piece.file);
      const colors = cutout ? await colorsInPhoto(cutout) : [];
      let next: Partial<PendingPiece> = {
        name: "New item",
        categoryId: categories[0]?.id ?? "",
        categoryName: categories[0]?.name ?? "",
        colors,
        lowConfidence: true,
        worn,
      };
      if (scores) {
        const guess = detectionFromScores(scores, colors);
        const category = matchCategory(categories, guess.category, guess.slot);
        const tags = guess.tags.filter((tag): tag is (typeof TAGS)[number] => (TAGS as readonly string[]).includes(tag));
        next = {
          name: guess.name,
          categoryId: category?.id ?? "",
          categoryName: category?.name ?? guess.category,
          colors: guess.colors,
          warmth: guess.warmth,
          tags,
          lowConfidence: guess.lowConfidence,
          worn,
        };
      }
      const modelCutout = worn ? null : cutout;
      const cutoutPreviewUrl = modelCutout ? URL.createObjectURL(modelCutout) : undefined;
      setPending((rows) => rows.map((row) => (row.id === piece.id ? { ...row, ...next, status: "ready", cutout: modelCutout, cutoutPreviewUrl } : row)));
    }
  }

  function openPending(piece: PendingPiece) {
    if (piece.status !== "ready") return;
    setDraft({
      id: piece.id,
      local: true,
      previewUrl: piece.cutoutPreviewUrl || piece.previewUrl,
      name: piece.name,
      categoryId: piece.categoryId,
      colors: piece.colors.join(", "),
      warmth: piece.warmth,
      tags: piece.tags,
      inLaundry: piece.inLaundry,
    });
  }

  async function turnPending(piece: PendingPiece, turn: PhotoTurn) {
    if (piece.status !== "ready") return;
    setBusy(true);
    try {
      const file = await turnPhotoFile(piece.file, turn);
      const cutout = piece.cutout ? await turnPhotoFile(piece.cutout, turn) : null;
      URL.revokeObjectURL(piece.previewUrl);
      if (piece.cutoutPreviewUrl) URL.revokeObjectURL(piece.cutoutPreviewUrl);
      const previewUrl = URL.createObjectURL(file);
      const cutoutPreviewUrl = cutout ? URL.createObjectURL(cutout) : undefined;
      setPending((rows) => rows.map((row) => (row.id === piece.id ? { ...row, file, previewUrl, cutout, cutoutPreviewUrl } : row)));
      setDraft((current) => (current?.local && current.id === piece.id ? { ...current, previewUrl: cutoutPreviewUrl || previewUrl } : current));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't turn that photo");
    } finally {
      setBusy(false);
    }
  }

  async function orient(turn: PhotoTurn) {
    if (!draft) return;
    if (draft.local) {
      const piece = pending.find((row) => row.id === draft.id);
      if (piece) await turnPending(piece, turn);
      return;
    }
    setBusy(true);
    try {
      const item = await api<ClosetItemDto>(`/api/closet/items/${draft.id}/orient`, {
        method: "POST",
        body: JSON.stringify({ turn }),
      });
      setDraft((current) => (current && current.id === item.id ? { ...current, previewUrl: item.imageUrl } : current));
      await reloadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't turn that photo");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const colors = draft.colors.split(",").map((part) => part.trim()).filter(Boolean);
    const categoryName = categories.find((category) => category.id === draft.categoryId)?.name ?? "";
    if (draft.local) {
      setPending((rows) => rows.map((row) => row.id === draft.id ? {
        ...row,
        name: draft.name.trim(),
        categoryId: draft.categoryId,
        categoryName,
        colors,
        warmth: draft.warmth,
        tags: draft.tags,
        inLaundry: draft.inLaundry,
        lowConfidence: false,
      } : row));
      setDraft(null);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/closet/items/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          colors,
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
    if (draft.local) {
      setPending((rows) => {
        const found = rows.find((row) => row.id === draft.id);
        if (found) {
          URL.revokeObjectURL(found.previewUrl);
          if (found.cutoutPreviewUrl) URL.revokeObjectURL(found.cutoutPreviewUrl);
        }
        return rows.filter((row) => row.id !== draft.id);
      });
      setDraft(null);
      return;
    }
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

  async function askVibe(prompt: string) {
    const text = prompt.trim().slice(0, 200);
    setVibe(text);
    setBusy(true);
    try {
      const clipScores = text ? await scoreClosetPrompt(text, closet.data?.items ?? []) : undefined;
      const data = await api<OutfitPayload>("/api/outfits/request", {
        method: "POST",
        body: JSON.stringify({
          date: outfit.data?.outfit?.date ?? todayDateString(),
          prompt: text,
          ...(clipScores ? { clipScores } : {}),
        }),
      });
      outfit.setData(data);
      setSwapOpen(false);
      toast(text ? "Outfit updated" : "Cleared the vibe");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't match that vibe");
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

  async function addDetected() {
    const ready = pending.filter((piece) => piece.status === "ready" && piece.categoryId);
    if (!ready.length) return;
    setBusy(true);
    try {
      for (const piece of ready) {
        const body = new FormData();
        body.set("file", piece.file);
        body.set("name", piece.name);
        body.set("categoryId", piece.categoryId);
        body.set("colors", piece.colors.join(", "));
        body.set("warmth", String(piece.warmth));
        body.set("tags", piece.tags.join(","));
        body.set("inLaundry", piece.inLaundry ? "true" : "false");
        if (piece.cutout) body.set("cutout", piece.cutout);
        await api<ClosetItemDto>("/api/closet/items", { method: "POST", body });
        URL.revokeObjectURL(piece.previewUrl);
        if (piece.cutoutPreviewUrl) URL.revokeObjectURL(piece.cutoutPreviewUrl);
      }
      setPending((rows) => rows.filter((piece) => !ready.some((item) => item.id === piece.id)));
      toast(ready.length === 1 ? "Added to the closet" : `Added ${ready.length} pieces`);
      await reloadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add those photos");
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
  const detecting = pending.some((piece) => piece.status === "detecting");
  const cutting = pending.some((piece) => piece.status === "cutting");
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
        <form
          className="vibe-box"
          data-testid="outfit-vibe"
          onSubmit={(event) => {
            event.preventDefault();
            void askVibe(vibe);
          }}
        >
          <label className="field">
            <span>What vibe today?</span>
            <input
              data-testid="outfit-prompt"
              placeholder="What vibe today?"
              value={vibe}
              maxLength={200}
              onChange={(event) => setVibe(event.target.value)}
            />
          </label>
          <div className="chips vibe-chips" role="group" aria-label="Quick vibes">
            {VIBE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                className={`chip ${vibe.trim().toLowerCase() === chip.prompt ? "on" : ""}`}
                type="button"
                data-testid={`vibe-${chip.label.toLowerCase().replace(/\s+/g, "-")}`}
                disabled={busy}
                onClick={() => void askVibe(chip.prompt)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <button className="btn" type="submit" data-testid="outfit-prompt-go" disabled={busy}>
            {busy ? "Picking..." : "Pick"}
          </button>
        </form>
        {pick ? (
          <>
            <div className="outfit-toggle" role="group" aria-label="Outfit view">
              <button className={`chip ${outfitView === "model" ? "on" : ""}`} type="button" data-testid="outfit-view-model" onClick={() => setOutfitView("model")}>On model</button>
              <button className={`chip ${outfitView === "pieces" ? "on" : ""}`} type="button" data-testid="outfit-view-pieces" onClick={() => setOutfitView("pieces")}>Pieces</button>
            </div>
            {outfitView === "model" ? <OutfitModel outfit={pick} /> : <OutfitPhotos outfit={pick} />}
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
        <p className="faint closet-upload-tip">Best results: lay the item flat or hang it, one item per photo, plain background.</p>
      </div>

      {pending.length ? (
        <section data-testid="detect-review" aria-label="Review detected clothes">
          <div className="section-title">
            <h2>Review</h2>
            <span className="muted">{detecting ? "Detecting..." : cutting ? "Cutting out..." : `${pending.length} ready`}</span>
          </div>
          <div className="closet-grid">
            {pending.map((piece) => (
              <article
                key={piece.id}
                className={`closet-tile${(piece.lowConfidence || piece.worn) && piece.status === "ready" ? " flagged" : ""}`}
                data-testid="review-item"
                data-confidence={piece.lowConfidence ? "low" : "ok"}
              >
                <button className="closet-tile-open" type="button" onClick={() => openPending(piece)}>
                  <img src={piece.cutoutPreviewUrl || piece.previewUrl} alt="" />
                  <span className="closet-tile-copy">
                    <strong>{piece.name}</strong>
                    {piece.status === "detecting" ? <span>Detecting...</span> : piece.status === "cutting" ? <span>Cutting out...</span> : piece.worn ? <span className="review-flag" data-testid="review-flag">Best with a flat photo of just the clothing</span> : piece.lowConfidence ? <span className="review-flag" data-testid="review-flag">Check this · {piece.categoryName}</span> : <span>{piece.categoryName} · warmth {piece.warmth}</span>}
                  </span>
                </button>
                {piece.status === "ready" ? (
                  <div className="orient-row" role="group" aria-label="Turn photo">
                    <button type="button" data-testid="rotate-left" aria-label="Rotate left" disabled={busy} onClick={() => void turnPending(piece, "left")}>Left</button>
                    <button type="button" data-testid="rotate-right" aria-label="Rotate right" disabled={busy} onClick={() => void turnPending(piece, "right")}>Right</button>
                    <button type="button" data-testid="flip-photo" aria-label="Flip" disabled={busy} onClick={() => void turnPending(piece, "flip")}>Flip</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <button className="btn" type="button" data-testid="add-detected" style={{ marginTop: 12 }} disabled={busy || detecting || cutting || pending.every((piece) => !piece.categoryId)} onClick={() => void addDetected()}>
            {pending.length === 1 ? "Add to closet" : `Add ${pending.length} to closet`}
          </button>
        </section>
      ) : null}

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
            {draft.previewUrl ? <img className="editor-preview" src={draft.previewUrl} alt="" data-testid="editor-preview" /> : null}
            <div className="orient-row" role="group" aria-label="Turn photo">
              <button type="button" data-testid="rotate-left" aria-label="Rotate left" disabled={busy} onClick={() => void orient("left")}>Left</button>
              <button type="button" data-testid="rotate-right" aria-label="Rotate right" disabled={busy} onClick={() => void orient("right")}>Right</button>
              <button type="button" data-testid="flip-photo" aria-label="Flip" disabled={busy} onClick={() => void orient("flip")}>Flip</button>
            </div>
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
