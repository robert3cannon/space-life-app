import { removeSleep } from "@/lib/handlers/sleep";
import { withUser } from "@/lib/api";

export const DELETE = withUser(removeSleep);
export const dynamic = "force-dynamic";
