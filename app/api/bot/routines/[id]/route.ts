import { withBot } from "@/lib/api";
import { getRoutineById, patchRoutine, removeRoutine } from "@/lib/handlers/routines";

export const GET = withBot(getRoutineById);
export const PATCH = withBot(patchRoutine);
export const DELETE = withBot(removeRoutine);

export const dynamic = "force-dynamic";
