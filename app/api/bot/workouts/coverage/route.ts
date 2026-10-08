import { withBot } from "@/lib/api";
import { getCoverage } from "@/lib/handlers/workouts";

export const GET = withBot(getCoverage);

export const dynamic = "force-dynamic";
