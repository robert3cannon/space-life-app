import { Suspense } from "react";
import { ExerciseLibrary } from "@/components/exercise-library";

export default function Page() {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading library…</p></main>}>
      <ExerciseLibrary />
    </Suspense>
  );
}
