import { Suspense } from "react";
import { ExerciseDetail } from "@/components/exercise-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading exercise…</p></main>}>
      <ExerciseDetail id={id} />
    </Suspense>
  );
}
