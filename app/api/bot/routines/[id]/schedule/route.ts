import { withBot } from "@/lib/api";
import { postRoutineSchedule } from "@/lib/handlers/routines";

export const POST = withBot(postRoutineSchedule);

export const dynamic = "force-dynamic";
