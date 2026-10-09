"use client";

import Link from "next/link";
import { muscleLabel } from "@/lib/muscles";
import { BodyMap } from "./body-map";
import { RatingDots } from "./rating-dots";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type CircuitCard = {
  id: string;
  name: string;
  summary: string;
  exerciseCount: number;
  durationMinutes: { beginner: number; intermediate: number };
  primary: string[];
  secondary: string[];
  targetRating?: { average: number; muscle: string | null } | null;
};

function minutes(card: CircuitCard) {
  const low = card.durationMinutes.beginner;
  const high = card.durationMinutes.intermediate;
  return low === high ? `${low} min` : `${low}–${high} min`;
}

export function CircuitsView() {
  const { data, error, loading, reload } = useLoad<{ circuits: CircuitCard[]; equipmentLabel?: string }>("/api/circuits");

  return (
    <main className="page">
      <PageTitle title="Circuits" />
      <Link href="/workouts" className="text-btn">Train</Link>
      <p className="kicker" style={{ marginTop: 12 }}>Suggested flows</p>
      <h1 className="display">Circuits</h1>
      <p className="sub">
        Ready-made home sessions{data?.equipmentLabel ? ` for ${data.equipmentLabel}` : ""}. Beginner or intermediate, then a guided round.
      </p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data ? (
        <div className="stack" style={{ marginTop: 16 }}>
          {data.circuits.map((circuit) => (
            <Link key={circuit.id} href={`/circuits/${circuit.id}`} className="card circuit-card">
              <span className="circuit-copy">
                <strong>{circuit.name}</strong>
                <span className="faint">{minutes(circuit)} · Beginner or intermediate · {circuit.exerciseCount} exercises</span>
                {circuit.targetRating ? (
                  <span className="rating-line">
                    <RatingDots score={circuit.targetRating.average} label={`Average ${circuit.targetRating.average} out of 5`} />
                    <span className="faint">
                      Avg {circuit.targetRating.average.toFixed(1)}
                      {circuit.targetRating.muscle ? ` · ${muscleLabel(circuit.targetRating.muscle)}` : ""}
                    </span>
                  </span>
                ) : null}
                <span className="muted">{circuit.summary}</span>
              </span>
              <BodyMap
                compact
                primary={circuit.primary}
                secondary={circuit.secondary}
                label={`${circuit.name} muscles`}
              />
            </Link>
          ))}
        </div>
      ) : null}
    </main>
  );
}
