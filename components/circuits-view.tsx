"use client";

import Link from "next/link";
import { BodyMap } from "./body-map";
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
