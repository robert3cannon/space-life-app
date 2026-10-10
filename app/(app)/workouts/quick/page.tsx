import { Suspense } from "react";
import { QuickWorkout } from "@/components/quick-workout";

export default function Page() {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading workout…</p></main>}>
      <QuickWorkout />
    </Suspense>
  );
}
