import { withUser } from "@/lib/api";
import { getRoutines, postRoutine } from "@/lib/handlers/routines";

export const GET = withUser(getRoutines);
export const POST = withUser(postRoutine);

export const dynamic = "force-dynamic";
