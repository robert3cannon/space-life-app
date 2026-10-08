import { getTodayRoute } from "@/lib/handlers/today";
import { withBot } from "@/lib/api";

export const GET = withBot(getTodayRoute);

export const dynamic = "force-dynamic";
