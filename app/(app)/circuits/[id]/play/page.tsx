import { Suspense } from "react";
import { CircuitPlayer } from "@/components/circuit-player";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading circuit…</p></main>}>
      <CircuitPlayer id={id} />
    </Suspense>
  );
}
