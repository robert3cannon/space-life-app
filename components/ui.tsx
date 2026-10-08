"use client";

import { useEffect } from "react";

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · Orbit`;
  }, [title]);
  return null;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skel" />
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="err">
      <p style={{ margin: "0 0 8px" }}>{message}</p>
      <button className="btn-ghost" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function Ring({ value, max }: { value: number; max: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <svg className="ring" viewBox="0 0 120 120" aria-hidden>
      <defs>
        <linearGradient id="fuel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b8cff" />
          <stop offset="55%" stopColor="#7aefff" />
          <stop offset="100%" stopColor="#ff8ad4" />
        </linearGradient>
      </defs>
      <circle className="ring-track" cx="60" cy="60" r={radius} />
      <circle
        className="ring-value"
        cx="60"
        cy="60"
        r={radius}
        strokeDasharray={`${circumference * pct} ${circumference}`}
      />
      <text className="ring-label" x="60" y="58" textAnchor="middle" fill="#f6f3ff" fontSize="20" fontFamily="Outfit, sans-serif">
        {value}
      </text>
      <text x="60" y="76" textAnchor="middle" fill="#c8c0e2" fontSize="12" fontFamily="Outfit, sans-serif">
        / {max}
      </text>
    </svg>
  );
}

export function Meter({
  label,
  value,
  max,
  unit,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  tone: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="macro">
      <div className="spread">
        <span>{label}</span>
        <b className="num">
          {value}
          {unit}
        </b>
      </div>
      <div className={`track ${tone}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
