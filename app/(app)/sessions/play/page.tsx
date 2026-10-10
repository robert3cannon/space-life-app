import { Suspense } from "react";
import { SessionPlayer } from "@/components/session-player";

export default function Page() {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading workout…</p></main>}>
      <SessionPlayer />
    </Suspense>
  );
}
