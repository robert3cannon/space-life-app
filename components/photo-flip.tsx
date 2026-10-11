"use client";

import { useRef, useState } from "react";

export function PhotoFlip({
  front,
  back,
  alt = "",
}: {
  front: string | null;
  back: string | null;
  alt?: string;
}) {
  const [showBack, setShowBack] = useState(false);
  const start = useRef<number | null>(null);
  const swiped = useRef(false);
  const face = showBack && back ? back : front;
  if (!back) {
    return face ? <img src={face} alt={alt} /> : <span className="outfit-fallback" />;
  }
  return (
    <div
      className="photo-flip"
      onPointerDown={(event) => {
        start.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (start.current == null) return;
        const delta = event.clientX - start.current;
        start.current = null;
        if (Math.abs(delta) > 28) {
          swiped.current = true;
          setShowBack((value) => !value);
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        setShowBack((value) => !value);
      }}
    >
      {face ? <img src={face} alt={alt} /> : <span className="outfit-fallback" />}
      <button
        className="photo-flip-toggle"
        type="button"
        data-testid="photo-flip"
        aria-label={showBack ? "Show front" : "Show back"}
        onClick={(event) => {
          event.stopPropagation();
          setShowBack((value) => !value);
        }}
      >
        {showBack ? "Front" : "Back"}
      </button>
    </div>
  );
}
