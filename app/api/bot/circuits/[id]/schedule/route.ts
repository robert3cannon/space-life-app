import { withBot } from "@/lib/api";
import { postCircuitSchedule } from "@/lib/handlers/circuits";

export const POST = withBot(postCircuitSchedule);

export const dynamic = "force-dynamic";
