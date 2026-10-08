"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const place = () => {
      const sheet = sheetRef.current;
      const viewport = window.visualViewport;
      if (!sheet || !viewport) return;
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      sheet.style.bottom = `${keyboard}px`;
      sheet.style.maxHeight = `${Math.max(240, viewport.height - 12)}px`;
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("input, textarea, select")) return;
      window.setTimeout(() => target.scrollIntoView({ block: "center" }), 280);
    };
    const sheet = sheetRef.current;
    document.addEventListener("keydown", onKey);
    sheet?.addEventListener("focusin", onFocus);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    place();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      sheet?.removeEventListener("focusin", onFocus);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <>
      <button className="backdrop" aria-label="Close" onClick={onClose} />
      <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" aria-hidden />
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}
