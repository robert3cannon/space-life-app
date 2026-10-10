import { withUser } from "@/lib/api";
import { postRoutineSchedule } from "@/lib/handlers/routines";

export const POST = withUser(postRoutineSchedule);

export const dynamic = "force-dynamic";
