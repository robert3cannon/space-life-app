import { withUser } from "@/lib/api";
import { getRoutineById, patchRoutine, removeRoutine } from "@/lib/handlers/routines";

export const GET = withUser(getRoutineById);
export const PATCH = withUser(patchRoutine);
export const DELETE = withUser(removeRoutine);

export const dynamic = "force-dynamic";
