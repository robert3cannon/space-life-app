import { withUser } from "@/lib/api";
import { getCoverage } from "@/lib/handlers/workouts";

export const GET = withUser(getCoverage);

export const dynamic = "force-dynamic";
