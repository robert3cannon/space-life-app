import { getFoodSummary } from "@/lib/handlers/food";
import { withBot } from "@/lib/api";

export const GET = withBot(getFoodSummary);

export const dynamic = "force-dynamic";
