import { removeSleep } from "@/lib/handlers/sleep";
import { withBot } from "@/lib/api";

export const DELETE = withBot(removeSleep);
export const dynamic = "force-dynamic";
