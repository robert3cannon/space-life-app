import { getTodayRoute } from "@/lib/handlers/today";
import { withUser } from "@/lib/api";

export const GET = withUser(getTodayRoute);

export const dynamic = "force-dynamic";
