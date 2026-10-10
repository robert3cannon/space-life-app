import { withBot } from "@/lib/api";
import { getRoutines, postRoutine } from "@/lib/handlers/routines";

export const GET = withBot(getRoutines);
export const POST = withBot(postRoutine);

export const dynamic = "force-dynamic";
